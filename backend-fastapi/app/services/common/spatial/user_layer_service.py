from __future__ import annotations

import logging
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.models.spatial import UserLayer
from app.models.analysis import AnalysisJob

logger = logging.getLogger(__name__)


def record_user_layer(
    db: Session,
    user_id: str,
    layer_id: str,
    layer_name: str,
    source: str = "upload",
) -> UserLayer:
    """
    Mencatat relasi kepemilikan layer terhadap user di Biomass Mangrove.
    Mencegah duplikasi jika layer_id sudah terdaftar untuk user yang sama.
    """
    layer_id_str = str(layer_id).strip()
    existing = db.scalar(
        select(UserLayer).where(
            UserLayer.user_id == user_id,
            UserLayer.layer_id == layer_id_str,
        )
    )
    if existing:
        existing.layer_name = layer_name
        existing.source = source
        db.commit()
        db.refresh(existing)
        return existing

    user_layer = UserLayer(
        user_id=user_id,
        layer_id=layer_id_str,
        layer_name=layer_name,
        source=source,
    )
    db.add(user_layer)
    db.commit()
    db.refresh(user_layer)
    logger.info("Recorded layer %s (%s) for user %s [source=%s]", layer_id_str, layer_name, user_id, source)
    return user_layer


def get_user_accessible_layer_identifiers(db: Session, user_id: str) -> tuple[set[str], set[str]]:
    """
    Mengambil seluruh identifier ID dan nama layer yang boleh diakses oleh user_id:
    1. Layer yang tersimpan di tabel user_layers
    2. Layer hasil analisis dari tabel analysis_jobs milik user_id
    Mengembalikan: (set_of_layer_ids, set_of_layer_names)
    """
    layer_ids: set[str] = set()
    layer_names: set[str] = set()

    # 1. Dari tabel user_layers
    user_layer_records = db.scalars(
        select(UserLayer).where(UserLayer.user_id == user_id)
    ).all()
    for rec in user_layer_records:
        if rec.layer_id:
            layer_ids.add(rec.layer_id)
        if rec.layer_name:
            layer_names.add(rec.layer_name.lower())

    # 2. Dari tabel analysis_jobs milik user
    user_jobs = db.scalars(
        select(AnalysisJob).where(AnalysisJob.user_id == user_id)
    ).all()
    for job in user_jobs:
        # Selalu sertakan konvensi nama agb_{job.id}
        job_layer_name = f"agb_{job.id}"
        layer_names.add(job_layer_name.lower())

        if isinstance(job.result, dict):
            layer_info = job.result.get("layer")
            if isinstance(layer_info, dict):
                lid = layer_info.get("id") or layer_info.get("layer_id")
                lname = layer_info.get("name") or layer_info.get("layer_name") or layer_info.get("geoserver_name")
                if lid:
                    layer_ids.add(str(lid))
                if lname:
                    layer_names.add(str(lname).lower())

    return layer_ids, layer_names


def is_user_layer_owner(db: Session, user_id: str, layer_id: str) -> bool:
    """
    Mengecek apakah user_id berhak mengakses atau mengelola layer_id tertentu.
    """
    layer_ids, layer_names = get_user_accessible_layer_identifiers(db, user_id)
    lid_str = str(layer_id).strip()
    return lid_str in layer_ids or lid_str.lower() in layer_names


def delete_user_layer_record(db: Session, user_id: str, layer_id: str) -> bool:
    """
    Menghapus relasi layer dari user_layers saat layer dihapus dari GeoServer.
    """
    lid_str = str(layer_id).strip()
    stmt = delete(UserLayer).where(
        UserLayer.user_id == user_id,
        (UserLayer.layer_id == lid_str) | (UserLayer.layer_name == lid_str),
    )
    res = db.execute(stmt)
    db.commit()
    return res.rowcount > 0
