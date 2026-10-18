"""Tile-wise AGB prediction and mangrove-mask application for worker outputs."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Callable

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.transform import Affine
from rasterio.windows import Window
from shapely import make_valid
from shapely.geometry import box, mapping
from shapely.strtree import STRtree

from .agb_feature_contract import get_training_feature_ranges, valid_feature_mask
from .ml_agb_service import MlAgbService
from .model_registry import get_active_model_config

if TYPE_CHECKING:
    from app.services.agb_worker.feature_tile_provider import RasterGrid, RasterTile


def _load_mangrove_geometries(mask_path: Path, raster_crs: str):
    if not mask_path.is_file():
        return [], None
    try:
        frame = gpd.read_file(mask_path)
        if frame.empty or frame.crs is None:
            return [], None
        frame = frame.to_crs(raster_crs)
        geometries = []
        for geometry in frame.geometry:
            if geometry is None or geometry.is_empty:
                continue
            fixed = geometry if geometry.is_valid else make_valid(geometry)
            if not fixed.is_empty:
                geometries.append(fixed)
        if not geometries:
            return [], None
        return geometries, STRtree(geometries)
    except Exception:
        return [], None


def _query_geometries(tree: STRtree, geometries: list, bounds):
    """Support Shapely 2 index results and legacy geometry-returning indexes."""
    results = tree.query(bounds)
    if not len(results):
        return []
    first = results[0]
    if isinstance(first, (int, np.integer)):
        return [geometries[int(index)] for index in results]
    return list(results)


def _tile_mangrove_mask(
    tree: STRtree | None,
    geometries: list | None,
    *,
    aoi_geometry,
    tile: RasterTile,
    tile_transform: Affine,
    apply_mangrove_mask: bool = True,
) -> np.ndarray:
    shape = (tile.height, tile.width)
    aoi = geometry_mask(
        [mapping(aoi_geometry)],
        out_shape=shape,
        transform=tile_transform,
        invert=True,
        all_touched=False,
    )
    if not apply_mangrove_mask or not tree or not geometries:
        return aoi

    tile_bounds = box(
        tile_transform.c,
        tile_transform.f + tile.height * tile_transform.e,
        tile_transform.c + tile.width * tile_transform.a,
        tile_transform.f,
    )
    candidates = _query_geometries(tree, geometries, tile_bounds)
    if not candidates:
        # Jika tile berada di luar poligon masker lokal, tetap izinkan prediksi berbasis AOI
        return aoi
    mangrove = geometry_mask(
        [mapping(geometry) for geometry in candidates],
        out_shape=shape,
        transform=tile_transform,
        invert=True,
        all_touched=False,
    )
    return mangrove & aoi


def predict_feature_raster(
    *,
    feature_path: Path,
    output_path: Path,
    grid: RasterGrid,
    projected_aoi,
    progress_callback: Callable[[int], bool] = lambda _progress: True,
    cancellation_callback: Callable[[], bool] = lambda: False,
    apply_mangrove_mask: bool = True,
) -> dict:
    """Predict the feature raster a tile at a time and write a nodata-safe AGB GeoTIFF."""
    model = get_active_model_config()
    feature_names = model.features
    training_ranges = get_training_feature_ranges()
    geometries, tree = _load_mangrove_geometries(model.mangrove_mask_path, grid.crs)
    feature_min = {feature: float("inf") for feature in feature_names}
    feature_max = {feature: float("-inf") for feature in feature_names}
    prediction_min = float("inf")
    prediction_max = float("-inf")
    valid_pixels = 0
    extrapolated_pixels = 0
    nodata = float(model.preprocessing["nodata"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    with rasterio.open(feature_path) as source:
        if (
            source.count != len(feature_names)
            or source.width != grid.width
            or source.height != grid.height
            or source.crs.to_string() != grid.crs
        ):
            raise ValueError("Feature raster does not match the queued model grid contract.")
        profile = source.profile.copy()
        profile.update(count=1, dtype="float32", nodata=nodata, compress="deflate", predictor=3)
        with rasterio.open(output_path, "w", **profile) as destination:
            for tile_index, tile in enumerate(grid.tiles):
                if cancellation_callback():
                    raise InterruptedError("AGB job cancellation requested during inference.")
                window = Window(tile.x, tile.y, tile.width, tile.height)
                features = source.read(window=window).astype(np.float32, copy=False)
                available = dict(zip(feature_names, features, strict=True))
                feature_valid = valid_feature_mask(
                    available["VV"], available["VH"], available["NDVI"]
                )
                mangrove_mask = _tile_mangrove_mask(
                    tree,
                    geometries,
                    aoi_geometry=projected_aoi,
                    tile=tile,
                    tile_transform=source.window_transform(window),
                    apply_mangrove_mask=apply_mangrove_mask,
                )
                output = np.full((tile.height, tile.width), nodata, dtype=np.float32)
                prediction = np.full((tile.height, tile.width), np.nan, dtype=np.float64)
                if np.any(feature_valid & mangrove_mask):
                    masked_features = {
                        name: np.where(mangrove_mask, available[name], np.nan)
                        for name in feature_names
                    }
                    prediction = MlAgbService.predict_features(
                        masked_features["VV"],
                        masked_features["VH"],
                        masked_features["NDVI"],
                    )
                valid = feature_valid & mangrove_mask & np.isfinite(prediction)
                output[valid] = prediction[valid].astype(np.float32)
                count = int(np.count_nonzero(valid))
                if count:
                    values = output[valid].astype(np.float64)
                    valid_pixels += count
                    prediction_min = min(prediction_min, float(values.min()))
                    prediction_max = max(prediction_max, float(values.max()))
                    outside_range = np.zeros(valid.shape, dtype=bool)
                    for feature in feature_names:
                        feature_values = available[feature][valid]
                        if feature_values.size:
                            feature_min[feature] = min(feature_min[feature], float(feature_values.min()))
                            feature_max[feature] = max(feature_max[feature], float(feature_values.max()))
                        lower, upper = training_ranges[feature]
                        outside_range |= valid & (
                            (available[feature] < lower) | (available[feature] > upper)
                        )
                    extrapolated_pixels += int(np.count_nonzero(outside_range))

                destination.write(output, 1, window=window)
                progress = 60 + int((tile_index + 1) * 30 / max(len(grid.tiles), 1))
                if not progress_callback(progress):
                    raise InterruptedError("AGB job cancellation requested during inference.")

    if valid_pixels == 0:
        output_path.unlink(missing_ok=True)
        raise ValueError(
            "Tidak ada piksel satelit vegetasi valid di dalam area AOI yang dipilih (pastikan area memiliki tutupan vegetasi dan bukan seluruhnya perairan/awan)."
        )

    return {
        "artifact": {
            "name": output_path.name,
            "format": "GeoTIFF",
            "bands": ["AGB_Revised_kg"],
            "crs": grid.crs,
            "pixel_size_meters": grid.pixel_size,
            "width": grid.width,
            "height": grid.height,
            "nodata": nodata,
        },
        "statistics": {
            "valid_pixel_count": valid_pixels,
            "minimum_kg_per_pixel": prediction_min,
            "maximum_kg_per_pixel": prediction_max,
            "valid_pixels_outside_training_range": extrapolated_pixels,
            "extrapolation_percentage": round(extrapolated_pixels / valid_pixels * 100, 4),
            "feature_ranges": {
                feature: {
                    "minimum": feature_min[feature],
                    "maximum": feature_max[feature],
                    "training_minimum": training_ranges[feature][0],
                    "training_maximum": training_ranges[feature][1],
                }
                for feature in feature_names
            },
        },
        "warnings": [
            "Peta estimasi AGB beta belum divalidasi dengan data lapangan; jangan tafsirkan sebagai hasil pengukuran.",
            "Nilai adalah kg per piksel 10x10 m; total biomassa AOI dan konversi ton/ha tidak disajikan.",
        ],
    }