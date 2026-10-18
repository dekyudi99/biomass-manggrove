"""Persistent worker for producing and publishing beta AGB prediction rasters."""

from __future__ import annotations

import logging
import asyncio
import inspect as python_inspect
import os
import tempfile
import time
import uuid
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Event
from typing import Callable

import ee
import numpy as np
import rasterio
from rasterio.transform import Affine
from rasterio.windows import Window
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config.database import SessionLocal, engine
from app.models.analysis import AnalysisJob, Notification
from app.models.auth import User
from app.services.agb_analysis.agb_prediction_service import predict_feature_raster
from .feature_tile_provider import (
    EarthEngineFeatureTileProvider,
    FeatureTileProvider,
    RasterGrid,
    RasterTile,
    build_raster_grid,
    is_memory_error,
    split_tile,
)
from app.services.common.email import send_analysis_job_email_safely
from app.services.gee_core import get_agb_palette_style_entries
from app.services.common.geoserver import GeoServerService
from app.services.agb_analysis.model_registry import get_active_model_config
from app.services.common.spatial import record_user_layer


logger = logging.getLogger(__name__)

DOWNLOAD_WORKERS = 3
RETRY_ATTEMPTS = 4
INITIAL_RETRY_DELAY_SECONDS = 1.0
MAX_RETRY_DELAY_SECONDS = 16.0
POLL_INTERVAL_SECONDS = 3.0
PROGRESS_SCHEMA_COLUMN = "progress"
POSTGRES_WORKER_LOCK_ID = 1_947_326_410


@dataclass(frozen=True)
class ClaimedJob:
    id: str
    user_id: str
    aoi_geojson: dict
    tile_count: int
    model_version: str
    model_status: str
    model_unit: str
    disclaimer: str
    user_email: str


class JobCancelled(Exception):
    """Raised when a persisted cancellation request is observed."""


def initialize_earth_engine_high_volume() -> None:
    """Initialize this worker against the Earth Engine high-volume endpoint."""
    project_id = os.getenv("EE_PROJECT_ID") or None
    if project_id in ("your-google-cloud-project-id", ""):
        project_id = None
    service_account = os.getenv("EE_SERVICE_ACCOUNT")
    key_file_path = os.getenv("EE_KEY_FILE_PATH")
    credentials = None
    if service_account and key_file_path and os.path.isfile(key_file_path):
        credentials = ee.ServiceAccountCredentials(service_account, key_file_path)

    try:
        ee.Initialize(
            credentials=credentials,
            project=project_id,
            opt_url="https://earthengine-highvolume.googleapis.com",
        )
    except Exception as exc:
        if project_id is not None:
            logging.getLogger(__name__).warning(
                "EE High Volume init with project %s failed: %s. Retrying without explicit project...",
                project_id,
                exc,
            )
            ee.Initialize(
                credentials=credentials,
                opt_url="https://earthengine-highvolume.googleapis.com",
            )
        else:
            raise


def claim_next_job(db: Session) -> ClaimedJob | None:
    statement = (
        select(AnalysisJob)
        .where(AnalysisJob.status == "queued")
        .order_by(AnalysisJob.created_at, AnalysisJob.id)
        .limit(1)
    )
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        statement = statement.with_for_update(skip_locked=True)
    job = db.scalar(statement)
    if job is None:
        return None

    job.status = "running"
    job.progress = 0
    job.started_at = datetime.now(timezone.utc)
    job.completed_at = None
    job.error_message = None
    db.commit()
    user_email = db.scalar(select(User.email).where(User.id == job.user_id)) or ""
    return _claimed_job_from_record(job, user_email=user_email)


def _claimed_job_from_record(job: AnalysisJob, *, user_email: str = "") -> ClaimedJob:
    return ClaimedJob(
        id=job.id,
        user_id=job.user_id,
        aoi_geojson=job.aoi_geojson,
        tile_count=job.tile_count,
        model_version=job.model_version,
        model_status=job.model_status,
        model_unit=job.model_unit,
        disclaimer=job.disclaimer,
        user_email=user_email,
    )


def _add_terminal_notification(db: Session, job: ClaimedJob, status: str, message: str) -> None:
    db.add(
        Notification(
            user_id=job.user_id,
            job_id=job.id,
            event_type=f"job_{status}",
            title=f"Analisis AGB beta {status}",
            message=(
                f"Job {job.id} · {job.model_version} ({job.model_status}) · "
                f"{job.model_unit}. {message} {job.disclaimer}"
            ),
            is_read=False,
        )
    )


def _is_cancel_requested(job_id: str) -> bool:
    with SessionLocal() as db:
        requested = db.scalar(
            select(AnalysisJob.cancel_requested).where(AnalysisJob.id == job_id)
        )
        return requested is None or bool(requested)


def _set_progress(job_id: str, progress: int) -> bool:
    with SessionLocal() as db:
        job = db.get(AnalysisJob, job_id)
        if job is None or job.status != "running" or job.cancel_requested:
            return False
        job.progress = min(99, max(job.progress, progress))
        db.commit()
        return True


def download_tile_with_retry(
    provider: FeatureTileProvider,
    tile: RasterTile,
    *,
    cancellation_callback: Callable[[], bool] = lambda: False,
    attempts: int = RETRY_ATTEMPTS,
    sleep: Callable[[float], None] = time.sleep,
) -> list[tuple[RasterTile, np.ndarray]]:
    """Retry transient failures and recursively split GEE memory-limited tiles."""
    if cancellation_callback():
        raise JobCancelled
    for attempt in range(attempts):
        try:
            return [(tile, provider.download(tile))]
        except JobCancelled:
            raise
        except Exception as error:
            if is_memory_error(error):
                children = split_tile(tile)
                if not children:
                    raise RuntimeError(
                        f"Earth Engine memory limit exceeded for minimum tile {tile}."
                    ) from error
                results: list[tuple[RasterTile, np.ndarray]] = []
                for child in children:
                    results.extend(
                        download_tile_with_retry(
                            provider,
                            child,
                            cancellation_callback=cancellation_callback,
                            attempts=attempts,
                            sleep=sleep,
                        )
                    )
                return results
            if attempt + 1 >= attempts:
                raise RuntimeError(
                    f"Tile download failed after {attempts} attempts: {tile}."
                ) from error
            delay = min(INITIAL_RETRY_DELAY_SECONDS * (2**attempt), MAX_RETRY_DELAY_SECONDS)
            logger.warning(
                "Tile %s failed (attempt %s/%s); retrying in %ss.",
                tile,
                attempt + 1,
                attempts,
                delay,
            )
            sleep(delay)
            if cancellation_callback():
                raise JobCancelled
    raise AssertionError("Retry loop exited unexpectedly.")


def write_tile_with_retries(
    raster,
    features: np.ndarray,
    tile: RasterTile,
    *,
    attempts: int = RETRY_ATTEMPTS,
    sleep: Callable[[float], None] = time.sleep,
) -> None:
    """Retry one raster write from RAM without downloading the tile again."""
    for attempt in range(attempts):
        try:
            raster.write(
                features,
                window=Window(tile.x, tile.y, tile.width, tile.height),
            )
            return
        except Exception:
            if attempt + 1 >= attempts:
                raise
            sleep(min(INITIAL_RETRY_DELAY_SECONDS * (2**attempt), MAX_RETRY_DELAY_SECONDS))


def _set_inference_progress(job_id: str, progress: int) -> bool:
    return _set_progress(job_id, progress)


def _run_awaitable(value):
    return asyncio.run(value) if python_inspect.isawaitable(value) else value


def _extract_published_layer(response: dict, expected_name: str) -> dict:
    if not isinstance(response, dict) or response.get("success") is False:
        raise ValueError("GeoServer did not confirm raster publication.")
    layer = response.get("layer") or response.get("data") or response
    if isinstance(layer, dict) and isinstance(layer.get("data"), dict):
        layer = layer["data"]
    if not isinstance(layer, dict):
        raise ValueError("GeoServer publication response did not include layer metadata.")
    if layer.get("success") is False:
        raise ValueError("GeoServer did not confirm raster publication.")
    layer_name = (
        layer.get("geoserver_name")
        or layer.get("layer_name")
        or layer.get("name")
        or layer.get("title")
        or layer.get("store_name")
    )
    if not layer_name or layer_name.split(":")[-1] != expected_name:
        if not (layer.get("store_name") == expected_name or layer.get("title") == expected_name):
            raise ValueError(f"GeoServer published a layer with an unexpected name: {layer_name} vs {expected_name}.")
    if not (layer.get("id") or layer.get("layer_id")):
        fallback_id = layer.get("store_name") or expected_name
        layer["id"] = fallback_id
        layer["layer_id"] = fallback_id
    return layer


def _publish_agb_raster(job: ClaimedJob, raster_path: Path) -> dict:
    palette = get_agb_palette_style_entries(get_active_model_config().display_range)

    async def publish():
        with raster_path.open("rb") as raster_file:
            return await GeoServerService.publish_agb_raster(
                job_id=job.id,
                model_version=job.model_version,
                model_status=job.model_status,
                model_unit=job.model_unit,
                disclaimer=job.disclaimer,
                file_bytes=raster_file,
                style=palette,
            )

    response = _run_awaitable(publish())
    return _extract_published_layer(response, f"agb_{job.id}")


def write_feature_raster(
    *,
    job: ClaimedJob,
    grid: RasterGrid,
    provider: FeatureTileProvider,
    temporary_path: Path,
    output_path: Path,
    progress_callback: Callable[[str, int], bool] = _set_progress,
    cancellation_callback: Callable[[str], bool] = _is_cancel_requested,
) -> dict:
    """Download tiles concurrently and use one ordered raster writer."""
    model = get_active_model_config()
    if model.version != job.model_version or model.status != job.model_status:
        raise ValueError("The active model snapshot differs from the queued job snapshot.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path.parent.mkdir(parents=True, exist_ok=True)
    feature_names = model.features
    completed_tiles = 0
    total_tiles = len(grid.tiles)
    profile = {
        "driver": "GTiff",
        "width": grid.width,
        "height": grid.height,
        "count": len(feature_names),
        "dtype": "float32",
        "crs": grid.crs,
        "transform": Affine(
            grid.pixel_size, 0, grid.origin_x, 0, -grid.pixel_size, grid.origin_y
        ),
        "nodata": float(model.preprocessing["nodata"]),
        "compress": "deflate",
        "predictor": 3,
        "tiled": True,
        "blockxsize": 256,
        "blockysize": 256,
    }

    tile_iterator = iter(enumerate(grid.tiles))
    pending: dict[Future, int] = {}
    downloaded: dict[int, list[tuple[RasterTile, np.ndarray]]] = {}
    next_to_write = 0
    next_to_schedule = 0
    with rasterio.open(temporary_path, "w", **profile) as raster:
        with ThreadPoolExecutor(
            max_workers=DOWNLOAD_WORKERS, thread_name_prefix="agb-tile"
        ) as pool:
            def schedule_next_tile() -> bool:
                nonlocal next_to_schedule
                if next_to_schedule >= total_tiles:
                    return False
                tile_index, tile = next(tile_iterator)
                future = pool.submit(
                    download_tile_with_retry,
                    provider,
                    tile,
                    cancellation_callback=lambda: cancellation_callback(job.id),
                )
                pending[future] = tile_index
                next_to_schedule += 1
                return True

            for _ in range(min(DOWNLOAD_WORKERS, total_tiles)):
                schedule_next_tile()

            while pending or downloaded:
                if cancellation_callback(job.id):
                    for future in pending:
                        future.cancel()
                    raise JobCancelled
                if pending:
                    completed_futures, _ = wait(pending, return_when=FIRST_COMPLETED)
                    for future in completed_futures:
                        tile_index = pending.pop(future)
                        downloaded[tile_index] = future.result()

                wrote_tiles = False
                while next_to_write in downloaded:
                    wrote_tiles = True
                    for tile, raw_features in downloaded.pop(next_to_write):
                        if cancellation_callback(job.id):
                            raise JobCancelled
                        features = np.asarray(raw_features, dtype=np.float32)
                        expected_shape = (len(feature_names), tile.height, tile.width)
                        if features.shape != expected_shape:
                            raise ValueError(
                                f"Feature provider returned shape {features.shape}; expected {expected_shape}."
                            )
                        write_tile_with_retries(raster, features, tile)
                        del features, raw_features

                    completed_tiles += 1
                    if not progress_callback(
                        job.id, int(completed_tiles * 60 / max(total_tiles, 1))
                    ):
                        raise JobCancelled
                    next_to_write += 1
                if wrote_tiles:
                    while len(pending) + len(downloaded) < DOWNLOAD_WORKERS:
                        if not schedule_next_tile():
                            break

    os.replace(temporary_path, output_path)
    return {
        "artifact": {
            "name": output_path.name,
            "format": "GeoTIFF",
            "bands": list(feature_names),
            "crs": grid.crs,
            "pixel_size_meters": grid.pixel_size,
            "width": grid.width,
            "height": grid.height,
        },
    }


def process_claimed_job(
    job: ClaimedJob,
    *,
    provider_factory: Callable[[dict, RasterGrid, object], FeatureTileProvider] | None = None,
    output_dir: Path | None = None,
) -> None:
    """Process one claimed job and persist its terminal state."""
    output_dir = output_dir or Path(os.getenv("AGB_RESULTS_DIR", "/data/analysis-results"))
    temporary_path: Path | None = None
    feature_output_path = output_dir / f"{job.id}.features.tif"
    agb_temporary_path: Path | None = None
    output_path = output_dir / f"{job.id}.agb.tif"
    published_layer: dict | None = None
    user_email = job.user_email
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        file_descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{job.id}.", suffix=".partial.tif", dir=output_dir
        )
        os.close(file_descriptor)
        temporary_path = Path(temporary_name)
        model = get_active_model_config()
        if model.version != job.model_version or model.status != job.model_status:
            raise ValueError("The active model snapshot differs from the queued job snapshot.")
        grid, projected_aoi = build_raster_grid(job.aoi_geojson)
        if len(grid.tiles) != job.tile_count:
            raise ValueError("Rebuilt raster grid tile count differs from the queued job snapshot.")
        provider = (
            provider_factory(job.aoi_geojson, grid, projected_aoi)
            if provider_factory
            else EarthEngineFeatureTileProvider(job.aoi_geojson, grid)
        )
        result = write_feature_raster(
            job=job,
            grid=grid,
            provider=provider,
            temporary_path=temporary_path,
            output_path=feature_output_path,
        )
        file_descriptor, agb_temporary_name = tempfile.mkstemp(
            prefix=f".{job.id}.agb.", suffix=".partial.tif", dir=output_dir
        )
        os.close(file_descriptor)
        agb_temporary_path = Path(agb_temporary_name)
        result = predict_feature_raster(
            feature_path=feature_output_path,
            output_path=agb_temporary_path,
            grid=grid,
            projected_aoi=projected_aoi,
            progress_callback=lambda progress: _set_inference_progress(job.id, progress),
            cancellation_callback=lambda: _is_cancel_requested(job.id),
        )
        if _is_cancel_requested(job.id):
            raise JobCancelled
        if not _set_progress(job.id, 95):
            raise JobCancelled
        published_layer = _publish_agb_raster(job, agb_temporary_path)
        os.replace(agb_temporary_path, output_path)
        agb_temporary_path = None
        result["layer"] = {
            "name": published_layer.get("geoserver_name")
            or published_layer.get("layer_name")
            or published_layer.get("name")
            or f"agb_{job.id}",
            "id": published_layer.get("id") or published_layer.get("layer_id"),
            "workspace_name": published_layer.get("workspace_name"),
            "wms_url": published_layer.get("wms_url"),
            "wms_layers_param": published_layer.get("wms_layers_param"),
        }
        result["artifact"]["download_url"] = f"/api/analysis/{job.id}/download"
        feature_output_path.unlink(missing_ok=True)
        with SessionLocal() as db:
            record = db.get(AnalysisJob, job.id)
            if record is None or record.cancel_requested:
                raise JobCancelled
            user_email = db.scalar(select(User.email).where(User.id == record.user_id)) or user_email
            record.status = "succeeded"
            record.progress = 100
            record.result = result
            record.error_message = None
            record.completed_at = datetime.now(timezone.utc)
            _add_terminal_notification(
                db,
                job,
                "succeeded",
                f"Prediksi raster AGB beta selesai dan dipublikasikan sebagai {result['layer']['name']}.",
            )
            layer_id = result.get("layer", {}).get("id")
            layer_name = result.get("layer", {}).get("name")
            if layer_id and job.user_id:
                try:
                    record_user_layer(
                        db=db,
                        user_id=job.user_id,
                        layer_id=layer_id,
                        layer_name=layer_name,
                        source="agb_job",
                    )
                except Exception as rec_err:
                    logger.warning("Failed to record user layer ownership for job %s: %s", job.id, rec_err)
            db.commit()
        send_analysis_job_email_safely(
            to_email=user_email,
            job_id=job.id,
            status="succeeded",
            disclaimer=job.disclaimer,
            model_version=job.model_version,
            model_status=job.model_status,
            model_unit=job.model_unit,
            result_summary=(
                f"Layer {result['layer']['name']}; "
                f"{result['statistics']['valid_pixel_count']} piksel valid; "
                f"extrapolation {result['statistics']['extrapolation_percentage']}%."
            ),
        )
    except (JobCancelled, InterruptedError):
        feature_output_path.unlink(missing_ok=True)
        if agb_temporary_path is not None:
            agb_temporary_path.unlink(missing_ok=True)
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        if published_layer:
            try:
                _run_awaitable(GeoServerService.delete_layer(published_layer.get("id") or published_layer.get("layer_id")))
            except Exception:
                logger.exception("Could not remove a cancelled AGB layer from GeoServer.")
        with SessionLocal() as db:
            record = db.get(AnalysisJob, job.id)
            if record is not None and record.status == "running":
                record.status = "cancelled"
                record.completed_at = datetime.now(timezone.utc)
                user_email = db.scalar(select(User.email).where(User.id == record.user_id)) or user_email
                _add_terminal_notification(db, job, "cancelled", "Job dibatalkan sesuai permintaan.")
                db.commit()
        send_analysis_job_email_safely(
            to_email=user_email,
            job_id=job.id,
            status="cancelled",
            disclaimer=job.disclaimer,
            model_version=job.model_version,
            model_status=job.model_status,
            model_unit=job.model_unit,
        )
    except Exception as error:
        logger.exception("Raster processing failed for analysis job %s.", job.id)
        feature_output_path.unlink(missing_ok=True)
        if agb_temporary_path is not None:
            agb_temporary_path.unlink(missing_ok=True)
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        if published_layer:
            try:
                _run_awaitable(GeoServerService.delete_layer(published_layer.get("id") or published_layer.get("layer_id")))
            except Exception:
                logger.exception("Could not remove a failed AGB layer from GeoServer.")
        terminal_status = "failed"
        terminal_email = job.user_email
        with SessionLocal() as db:
            record = db.get(AnalysisJob, job.id)
            if record is not None and record.status == "running":
                was_cancelled = record.cancel_requested
                terminal_email = db.scalar(select(User.email).where(User.id == record.user_id)) or terminal_email
                record.status = "cancelled" if was_cancelled else "failed"
                err_detail = str(error).strip()
                record.error_message = None if was_cancelled else (
                    f"{type(error).__name__}: {err_detail}"
                    if err_detail
                    else f"Pemrosesan gagal ({type(error).__name__})."
                )
                record.completed_at = datetime.now(timezone.utc)
                terminal_status = "cancelled" if was_cancelled else "failed"
                terminal_message = (
                    "Job dibatalkan sesuai permintaan."
                    if was_cancelled
                    else f"Pemrosesan gagal ({type(error).__name__})."
                )
                _add_terminal_notification(db, job, terminal_status, terminal_message)
                db.commit()
        send_analysis_job_email_safely(
            to_email=terminal_email,
            job_id=job.id,
            status=terminal_status,
            disclaimer=job.disclaimer,
            model_version=job.model_version,
            model_status=job.model_status,
            model_unit=job.model_unit,
        )


def run_worker(
    *, stop_event: Event | None = None, poll_interval: float = POLL_INTERVAL_SECONDS
) -> None:
    """Poll jobs serially while holding a session-level PostgreSQL advisory lock."""
    stop_event = stop_event or Event()
    while not stop_event.is_set():
        try:
            columns = {
                column["name"] for column in inspect(engine).get_columns(AnalysisJob.__tablename__)
            }
            if PROGRESS_SCHEMA_COLUMN in columns:
                break
            logger.info("Waiting for the analysis progress migration to finish.")
        except SQLAlchemyError:
            logger.info("Waiting for the analysis database schema to become available.")
        stop_event.wait(poll_interval)
    if stop_event.is_set():
        return

    lock_connection = engine.connect()
    lock_acquired = False
    try:
        if lock_connection.dialect.name == "postgresql":
            lock_acquired = bool(
                lock_connection.execute(
                    text("SELECT pg_try_advisory_lock(:lock_id)"),
                    {"lock_id": POSTGRES_WORKER_LOCK_ID},
                ).scalar_one()
            )
            lock_connection.commit()
            if not lock_acquired:
                logger.info("Another AGB worker already owns the PostgreSQL advisory lock.")
                return

        _recover_interrupted_jobs()
        _remove_partial_rasters()
        logger.info("AGB raster worker started.")
        while not stop_event.is_set():
            try:
                with SessionLocal() as db:
                    job = claim_next_job(db)
                if job is None:
                    stop_event.wait(poll_interval)
                    continue
                logger.info("Processing AGB feature-raster job %s.", job.id)
                process_claimed_job(job)
            except SQLAlchemyError:
                logger.exception("Database error in worker loop; retrying after poll interval.")
                stop_event.wait(poll_interval)
    finally:
        if lock_acquired:
            try:
                lock_connection.execute(
                    text("SELECT pg_advisory_unlock(:lock_id)"),
                    {"lock_id": POSTGRES_WORKER_LOCK_ID},
                )
                lock_connection.commit()
            except SQLAlchemyError:
                logger.exception("Failed to release PostgreSQL advisory lock.")
        lock_connection.close()


def _recover_interrupted_jobs() -> None:
    with SessionLocal() as db:
        cancelled_jobs = db.scalars(
            select(AnalysisJob).where(
                AnalysisJob.status == "running",
                AnalysisJob.cancel_requested.is_(True),
            )
        ).all()
        for job in cancelled_jobs:
            job.status = "cancelled"
            job.completed_at = datetime.now(timezone.utc)
            _add_terminal_notification(
                db, _claimed_job_from_record(job), "cancelled", "Job dibatalkan saat pemulihan worker."
            )
        if cancelled_jobs:
            db.commit()

        interrupted_jobs = db.scalars(
            select(AnalysisJob).where(
                AnalysisJob.status == "running",
                AnalysisJob.cancel_requested.is_(False),
            )
        ).all()
        for job in interrupted_jobs:
            job.status = "queued"
            job.progress = 0
            job.started_at = None
            job.error_message = None
        if interrupted_jobs:
            db.commit()
            logger.warning("Requeued %s interrupted raster job(s).", len(interrupted_jobs))


def _remove_partial_rasters() -> None:
    results_dir = Path(os.getenv("AGB_RESULTS_DIR", "/data/analysis-results"))
    if results_dir.is_dir():
        for partial_raster in results_dir.glob(".*.partial.tif"):
            partial_raster.unlink(missing_ok=True)