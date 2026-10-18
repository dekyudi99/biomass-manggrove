from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CreateAnalysisJobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    aoi_geojson: dict[str, Any] = Field(..., description="GeoJSON Polygon atau MultiPolygon WGS84")
    start_date: date | None = None
    end_date: date | None = None


class AnalysisJobResponse(BaseModel):
    id: str
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    tile_count: int
    model_version: str
    model_status: str
    model_unit: str
    disclaimer: str
    warnings: list[str]
    result: dict[str, Any] | None
    error_message: str | None
    progress: int = Field(ge=0, le=100)
    cancel_requested: bool
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    @classmethod
    def from_job(cls, job):
        return cls.model_validate(
            {
                "id": job.id,
                "status": job.status,
                "tile_count": job.tile_count,
                "model_version": job.model_version,
                "model_status": job.model_status,
                "model_unit": job.model_unit,
                "disclaimer": job.disclaimer,
                "warnings": job.warnings or [],
                "result": job.result,
                "error_message": job.error_message,
                "progress": job.progress,
                "cancel_requested": job.cancel_requested,
                "created_at": job.created_at,
                "updated_at": job.updated_at,
                "started_at": job.started_at,
                "completed_at": job.completed_at,
            }
        )


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_id: str | None
    event_type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    @classmethod
    def from_notification(cls, notification):
        return cls.model_validate(notification)