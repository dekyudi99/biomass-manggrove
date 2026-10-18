from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.analysis import AnalysisJob, Notification
from app.models.auth import User
from app.schemas.analysis import CreateAnalysisJobRequest
from .model_registry import get_active_model_config, validate_aoi_geojson


class AnalysisJobService:
    def __init__(self, db: Session):
        self.db = db

    def create_job(self, payload: CreateAnalysisJobRequest, user: User) -> AnalysisJob:
        try:
            aoi_geojson, tile_count = validate_aoi_geojson(payload.aoi_geojson)
        except ValueError as error:
            raise HTTPException(status_code=422, detail={"code": "ANALYSIS_INVALID_AOI", "message": str(error)}) from error

        model = get_active_model_config()
        warnings = [
            model.disclaimer,
            "Piksel valid harus berada di dalam masker mangrove; nilai lain akan menjadi nodata.",
        ]
        preprocessing = model.preprocessing
        training_month_start = date.fromisoformat(preprocessing["training_start_date_inclusive"])
        training_month_end = date.fromisoformat(preprocessing["training_end_date_exclusive"])
        training_month_end -= timedelta(days=1)
        start_date = payload.start_date
        end_date = payload.end_date
        if start_date and end_date and end_date < start_date:
            raise HTTPException(status_code=422, detail={"code": "ANALYSIS_INVALID_DATE_RANGE"})
        if (start_date and not (training_month_start <= start_date <= training_month_end)) or (
            end_date and not (training_month_start <= end_date <= training_month_end)
        ):
            warnings.append("Tanggal permintaan berada di luar bulan data training model beta.")

        job = AnalysisJob(
            user_id=user.id,
            status="queued",
            progress=0,
            aoi_geojson=aoi_geojson,
            requested_start_date=start_date.isoformat() if start_date else None,
            requested_end_date=end_date.isoformat() if end_date else None,
            tile_count=tile_count,
            model_version=model.version,
            model_status=model.status,
            model_unit=model.target["unit"],
            disclaimer=model.disclaimer,
            warnings=warnings,
        )
        self.db.add(job)
        self.db.flush()
        self._add_notification(
            user_id=user.id,
            job_id=job.id,
            event_type="job_queued",
            title="Analisis AGB beta masuk antrean",
            message=(
                f"Job {job.id} masuk antrean · {model.version} ({model.status}) · "
                f"{model.target['unit']}. {model.disclaimer}"
            ),
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_job(self, job_id: str, user: User) -> AnalysisJob:
        job = self.db.scalar(
            select(AnalysisJob).where(AnalysisJob.id == job_id, AnalysisJob.user_id == user.id)
        )
        if job is None:
            raise HTTPException(status_code=404, detail={"code": "ANALYSIS_JOB_NOT_FOUND"})
        return job

    def list_jobs(self, user: User, limit: int = 50) -> list[AnalysisJob]:
        return list(
            self.db.scalars(
                select(AnalysisJob)
                .where(AnalysisJob.user_id == user.id)
                .order_by(AnalysisJob.created_at.desc())
                .limit(limit)
            )
        )

    def request_cancel(self, job_id: str, user: User) -> AnalysisJob:
        job = self.get_job(job_id, user)
        if job.status == "queued":
            job.status = "cancelled"
            job.completed_at = datetime.now(timezone.utc)
            event_type = "job_cancelled"
        elif job.status == "running":
            job.cancel_requested = True
            event_type = "job_cancel_requested"
        else:
            raise HTTPException(status_code=409, detail={"code": "ANALYSIS_JOB_NOT_CANCELLABLE"})
        self._add_notification(
            user_id=user.id,
            job_id=job.id,
            event_type=event_type,
            title="Pembatalan analisis AGB beta diperbarui",
            message=(
                f"Status job: {job.status} · {job.model_version} ({job.model_status}) · "
                f"{job.model_unit}. {job.disclaimer}"
            ),
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    def list_notifications(self, user: User, limit: int = 50) -> list[Notification]:
        return list(
            self.db.scalars(
                select(Notification)
                .where(Notification.user_id == user.id)
                .order_by(Notification.created_at.desc())
                .limit(limit)
            )
        )

    def _add_notification(
        self, *, user_id: str, job_id: str, event_type: str, title: str, message: str
    ) -> None:
        self.db.add(
            Notification(
                user_id=user_id,
                job_id=job_id,
                event_type=event_type,
                title=title,
                message=message,
                is_read=False,
            )
        )