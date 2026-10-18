import os
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.csrf import require_csrf
from app.models.auth import User
from app.schemas.analysis import (
    AnalysisJobResponse,
    CreateAnalysisJobRequest,
    NotificationResponse,
)
from app.services.agb_analysis.analysis_job_service import AnalysisJobService
from app.services.common.email import send_analysis_job_email_safely
from app.services.agb_analysis.model_registry import get_active_model_config

ANALYSIS_EMAIL_BACKGROUND_TASK = send_analysis_job_email_safely
ANALYSIS_RESULTS_DIR = Path(os.getenv("AGB_RESULTS_DIR", "./analysis-results"))


router = APIRouter(prefix="/analysis", tags=["AGB Analysis Jobs"])


@router.post("", response_model=AnalysisJobResponse, status_code=202)
def create_analysis_job(
    payload: CreateAnalysisJobRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_csrf),
):
    job = AnalysisJobService(db).create_job(payload, current_user)
    background_tasks.add_task(
        ANALYSIS_EMAIL_BACKGROUND_TASK,
        to_email=current_user.email,
        job_id=job.id,
        status=job.status,
        disclaimer=job.disclaimer,
        model_version=job.model_version,
        model_status=job.model_status,
        model_unit=job.model_unit,
    )
    return AnalysisJobResponse.from_job(job)


@router.get("", response_model=list[AnalysisJobResponse])
def list_analysis_jobs(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [AnalysisJobResponse.from_job(job) for job in AnalysisJobService(db).list_jobs(current_user, limit)]


@router.get("/model")
def get_model_status(current_user: User = Depends(get_current_user)):
    model = get_active_model_config()
    return {
        "model_version": model.version,
        "model_status": model.status,
        "features": list(model.features),
        "disclaimer": model.disclaimer,
        "metrics_display_allowed": model.metrics_display_allowed,
        "unit": model.target["unit"],
        "ground_truth_validated": model.target.get("ground_truth_validated", False),
        "target_provenance": model.target.get("provenance", ""),
        "mask_coverage": {
            "name": "Thailand Selatan & Laut Andaman (Ranong, Phang Nga, Krabi, Phuket)",
            "bounds": [[6.4227, 98.2123], [10.4650, 100.1428]],
            "center": [9.9300, 98.6000],
            "recommended_zoom": 11,
            "convex_hull": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [100.1202, 6.4227], [99.6705, 6.5341], [99.6216, 6.5661],
                        [98.3001, 8.2046], [98.2757, 8.2779], [98.2177, 8.5234],
                        [98.2123, 8.5550], [98.2489, 9.0080], [98.2695, 9.1645],
                        [98.3865, 9.7357], [98.4539, 9.8644], [98.7724, 10.4212],
                        [98.7971, 10.4551], [98.8063, 10.4650], [98.8072, 10.4648],
                        [100.1338, 6.9152], [100.1428, 6.7568], [100.1425, 6.4590],
                        [100.1202, 6.4227]
                    ]
                ]
            }
        },
    }


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [
        NotificationResponse.from_notification(item)
        for item in AnalysisJobService(db).list_notifications(current_user, limit)
    ]


@router.get("/{job_id}", response_model=AnalysisJobResponse)
def get_analysis_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalysisJobResponse.from_job(AnalysisJobService(db).get_job(job_id, current_user))


@router.get("/{job_id}/download")
def download_analysis_result(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = AnalysisJobService(db).get_job(job_id, current_user)
    if job.status != "succeeded" or not (job.result or {}).get("layer"):
        raise HTTPException(status_code=404, detail={"code": "ANALYSIS_RESULT_NOT_AVAILABLE"})
    results_root = ANALYSIS_RESULTS_DIR.resolve()
    raster_path = (results_root / f"{job.id}.agb.tif").resolve()
    if raster_path.parent != results_root or not raster_path.is_file():
        raise HTTPException(status_code=404, detail={"code": "ANALYSIS_RESULT_NOT_AVAILABLE"})
    return FileResponse(
        raster_path,
        media_type="image/tiff",
        filename=f"agb_{job.id}.tif",
        headers={"Cache-Control": "private, no-store"},
    )


@router.post("/{job_id}/layer", response_model=AnalysisJobResponse)
def register_analysis_layer(
    job_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_csrf),
):
    service = AnalysisJobService(db)
    job = service.get_job(job_id, current_user)
    if job.status != "succeeded" or not (job.result or {}).get("layer"):
        raise HTTPException(status_code=404, detail={"code": "ANALYSIS_RESULT_NOT_AVAILABLE"})
    submitted_layer = payload.get("layer") if isinstance(payload, dict) else None
    stored_layer = job.result["layer"]
    if not isinstance(submitted_layer, dict) or str(submitted_layer.get("id")) != str(stored_layer.get("id")):
        raise HTTPException(status_code=422, detail={"code": "ANALYSIS_LAYER_MISMATCH"})
    layer = {
        **stored_layer,
        "layer_name": stored_layer.get("name"),
        "geoserver_name": stored_layer.get("name"),
        "layer_type": "raster",
        "type": "raster",
    }
    if layer.get("workspace_name") and layer.get("geoserver_name"):
        layer["wms_layers_param"] = layer.get("wms_layers_param") or (
            f"{layer['workspace_name']}:{layer['geoserver_name']}"
        )
    warnings = list(job.warnings or [])
    warning = "Hasil estimasi AGB beta belum divalidasi dengan data lapangan (ground truth)."
    if warning not in warnings:
        warnings.append(warning)
        job.warnings = warnings
        db.commit()
        db.refresh(job)
    job.result = {**(job.result or {}), "layer": layer}
    db.commit()
    db.refresh(job)
    return AnalysisJobResponse.from_job(job)


@router.delete("/{job_id}", response_model=AnalysisJobResponse)
def cancel_analysis_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_csrf),
):
    job = AnalysisJobService(db).request_cancel(job_id, current_user)
    background_tasks.add_task(
        ANALYSIS_EMAIL_BACKGROUND_TASK,
        to_email=current_user.email,
        job_id=job.id,
        status=job.status,
        disclaimer=job.disclaimer,
        model_version=job.model_version,
        model_status=job.model_status,
        model_unit=job.model_unit,
    )
    return AnalysisJobResponse.from_job(job)