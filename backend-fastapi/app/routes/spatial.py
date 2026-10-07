from fastapi import APIRouter, UploadFile, File, Form, Query, Body, Response
from typing import Optional, Dict, Any, List
from app.services.geoserver_service import GeoServerService
from app.services.spatial_file_service import export_shapefile_zip, parse_shapefile_uploads
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
):
    params = {"page": page, "size": size}
    return await GeoServerService.get_layers(params)


@router.post("/publish")
async def publish_layer(
    file: UploadFile = File(...),
    layer_name: str = Form(...),
    workspace_id: Optional[str] = Form(None),
    description: Optional[str] = Form(""),
):
    file_bytes = await file.read()
    form_data = {
        "layer_name": layer_name,
        "description": description or "",
    }
    return await GeoServerService.publish_layer(
        file_bytes=file_bytes,
        filename=file.filename or "layer",
        content_type=file.content_type or "application/octet-stream",
        form_data=form_data,
    )


@router.get("/layers/{layer_id}/raster-info")
async def get_raster_info(layer_id: str):
    """
    Mendapatkan statistik raster (min, max, mean, std) dan saved symbology dari GeoServer Microservice.
    """
    return await GeoServerService.get_raster_info(layer_id)


@router.post("/layers/{layer_id}/style")
async def update_layer_style(layer_id: str, payload: Dict[str, Any] = Body(...)):
    """Menerapkan symbology raster atau vector melalui GeoServer Microservice."""
    return await GeoServerService.update_layer_style(layer_id, payload)


@router.delete("/layers/{layer_id}")
async def delete_layer(layer_id: str):
    return await GeoServerService.delete_layer(layer_id)


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


