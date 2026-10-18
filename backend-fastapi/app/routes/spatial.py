from fastapi import APIRouter, UploadFile, File, Form, Query, Body, Response, Depends, HTTPException
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.dependencies.auth import get_current_user, get_optional_current_user
from app.models.auth import User
from app.services.common.geoserver import GeoServerService
from app.services.common.spatial import (
    export_shapefile_zip,
    parse_shapefile_uploads,
    record_user_layer,
    get_user_accessible_layer_identifiers,
    is_user_layer_owner,
    delete_user_layer_record,
)
from app.schemas.spatial import ExportShapefileRequest

router = APIRouter(prefix="/spatial", tags=["Spatial"])


@router.get("/health")
async def check_geoserver_microservice_health():
    """
    Cek koneksi backend Biomass ke GeoServer Microservice.
    """
    return await GeoServerService.health_check()


# --- GEOSERVER MICROSERVICE WORKSPACES ---

@router.get("/workspaces")
async def get_workspaces():
    return await GeoServerService.get_workspaces()


# --- LAYERS ---

@router.get("/layers")
async def get_layers(
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
    workspace: Optional[str] = Query(None, description="Filter berdasarkan workspace_name atau hashed ID"),
    layer_type: Optional[str] = Query(None, description="Filter tipe layer: 'vector' atau 'raster'"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Mengambil daftar layer dari GeoServer Microservice yang HANYA milik user yang sedang aktif login.
    User lain tidak bisa melihatnya.
    """
    params = {"page": page, "size": size}
    if workspace:
        params["workspace"] = workspace
    if layer_type:
        params["layer_type"] = layer_type
    response = await GeoServerService.get_layers(params)
    layers = response.get("data", []) if isinstance(response, dict) else response
    if not isinstance(layers, list):
        layers = []

    # Filter layer berdasarkan kepemilikan user
    if current_user:
        user_layer_ids, user_layer_names = get_user_accessible_layer_identifiers(db, current_user.id)
        filtered_layers = [
            l for l in layers
            if str(l.get("id", "")) in user_layer_ids
            or str(l.get("layer_name", "")).lower() in user_layer_names
            or str(l.get("table_name", "")).lower() in user_layer_names
            or str(l.get("geoserver_name", "")).lower() in user_layer_names
        ]
    else:
        filtered_layers = []

    return {"success": True, "total": len(filtered_layers), "data": filtered_layers}


@router.get("/workspaces/{identifier}/layers")
async def get_workspace_layers(
    identifier: str,
    layer_type: Optional[str] = Query(None, description="Filter tipe layer: 'vector' atau 'raster'"),
    include_geoserver: bool = Query(False, description="Sertakan daftar layer mentah langsung dari GeoServer REST"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Mengambil layer pada workspace tertentu yang hanya milik user aktif.
    """
    response = await GeoServerService.get_layers_by_workspace(
        workspace_name=identifier,
        layer_type=layer_type,
        include_geoserver=include_geoserver,
    )
    layers = response.get("data", []) if isinstance(response, dict) else response
    if not isinstance(layers, list):
        layers = []

    if current_user:
        user_layer_ids, user_layer_names = get_user_accessible_layer_identifiers(db, current_user.id)
        filtered_layers = [
            l for l in layers
            if str(l.get("id", "")) in user_layer_ids
            or str(l.get("layer_name", "")).lower() in user_layer_names
            or str(l.get("table_name", "")).lower() in user_layer_names
            or str(l.get("geoserver_name", "")).lower() in user_layer_names
        ]
    else:
        filtered_layers = []

    if isinstance(response, dict):
        response["total"] = len(filtered_layers)
        response["data"] = filtered_layers
        return response
    return {"success": True, "total": len(filtered_layers), "data": filtered_layers}


@router.get("/target-workspace/layers")
async def get_target_workspace_layers(
    layer_type: Optional[str] = Query(None, description="Filter tipe layer: 'vector' atau 'raster'"),
    include_geoserver: bool = Query(False, description="Sertakan daftar layer mentah langsung dari GeoServer REST"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Mengambil semua layer dari target workspace Biomass aktif milik user aktif.
    """
    return await get_workspace_layers(
        identifier="",
        layer_type=layer_type,
        include_geoserver=include_geoserver,
        current_user=current_user,
        db=db,
    )



@router.post("/publish")
async def publish_layer(
    file: UploadFile = File(...),
    layer_name: str = Form(...),
    workspace_id: Optional[str] = Form(None),
    description: Optional[str] = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_bytes = await file.read()
    form_data = {
        "layer_name": layer_name,
        "description": description or "",
    }
    result = await GeoServerService.publish_layer(
        file_bytes=file_bytes,
        filename=file.filename or "layer",
        content_type=file.content_type or "application/octet-stream",
        form_data=form_data,
    )
    # Catat kepemilikan layer ke user yang mengunggah
    layer_obj = result.get("layer") or result.get("data") or result
    if isinstance(layer_obj, dict) and isinstance(layer_obj.get("data"), dict):
        layer_obj = layer_obj["data"]
    layer_id = layer_obj.get("id") or layer_obj.get("layer_id")
    if layer_id:
        record_user_layer(
            db=db,
            user_id=current_user.id,
            layer_id=str(layer_id),
            layer_name=layer_name,
            source="upload",
        )
    return result


@router.get("/layers/{layer_id}/raster-info")
async def get_raster_info(layer_id: str):
    """
    Mendapatkan statistik raster (min, max, mean, std) dan saved symbology dari GeoServer Microservice.
    """
    return await GeoServerService.get_raster_info(layer_id)


@router.post("/layers/{layer_id}/style")
async def update_layer_style(
    layer_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Menerapkan symbology raster atau vector melalui GeoServer Microservice."""
    if not is_user_layer_owner(db, current_user.id, layer_id):
        raise HTTPException(
            status_code=403,
            detail="Anda tidak memiliki izin mengubah style layer ini.",
        )
    return await GeoServerService.update_layer_style(layer_id, payload)


@router.delete("/layers/{layer_id}")
async def delete_layer(
    layer_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_user_layer_owner(db, current_user.id, layer_id):
        raise HTTPException(
            status_code=403,
            detail="Anda tidak memiliki izin menghapus layer ini.",
        )
    res = await GeoServerService.delete_layer(layer_id)
    delete_user_layer_record(db, current_user.id, layer_id)
    return res


@router.get("/layers/{layer_id}/download")
async def download_layer(
    layer_id: str,
    format: str = Query("tiff", pattern="^(tiff|tif|geotiff|png)$"),
    styled: bool = Query(True),
    width: Optional[int] = Query(None),
    height: Optional[int] = Query(None),
):
    content, content_type, disposition = await GeoServerService.download_layer(
        layer_id=layer_id,
        format=format,
        styled=styled,
        width=width,
        height=height,
    )
    headers = {}
    if disposition:
        headers["Content-Disposition"] = disposition
    headers["Cache-Control"] = "no-cache"
    return Response(content=content, media_type=content_type, headers=headers)


# --- LAYER GROUPS ---

@router.get("/layer-groups")
async def get_layer_groups():
    return await GeoServerService.get_layer_groups()


@router.post("/layer-groups")
async def create_layer_group(payload: Dict[str, Any] = Body(...)):
    return await GeoServerService.create_layer_group(payload)


@router.put("/layer-groups/{group_id}")
async def update_layer_group(group_id: str, payload: Dict[str, Any] = Body(...)):
    return await GeoServerService.update_layer_group(group_id, payload)


@router.delete("/layer-groups/{group_id}")
async def delete_layer_group(group_id: str):
    return await GeoServerService.delete_layer_group(group_id)


# --- SHAPEFILE AOI PARSER ---

@router.post("/parse-shapefile")
async def parse_shapefile(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
):
    """
    Mengekstrak koordinat poligon AOI dari berkas Shapefile (.zip, .shp, atau multi-select .shp + .prj + .shx + .dbf).
    Mendukung deteksi otomatis CRS dan reproyeksi ke EPSG:4326 (WGS84).
    Mengembalikan format koordinat Leaflet [[lat, lng], ...].
    """
    upload_list: List[UploadFile] = []
    if files:
        upload_list.extend(files)
    if file and file not in upload_list:
        upload_list.append(file)

    return await parse_shapefile_uploads(upload_list)


# --- SHAPEFILE AOI EXPORTER ---

@router.post("/export-shapefile")
async def export_shapefile(req: ExportShapefileRequest):
    """
    Mengekspor poligon koordinat Leaflet [[lat, lng], ...] menjadi berkas arsip ESRI Shapefile (.zip).
    Memuat .shp, .shx, .dbf, .prj (EPSG:4326), dan .cpg (UTF-8).
    """
    clean_name, zip_bytes = export_shapefile_zip(
        points=req.points,
        name=req.name,
        area_hectares=req.area_hectares,
    )

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{clean_name}.zip"',
            "Cache-Control": "no-cache",
        },
    )


