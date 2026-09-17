from fastapi import APIRouter, UploadFile, File, Form, Query, Body, Response
from typing import Optional, Dict, Any
from app.services.astragis_service import AstraGISService

router = APIRouter(prefix="/spatial", tags=["Spatial"])


@router.get("/health")
async def check_astragis_health():
    """
    Cek status koneksi backend Biomass ke AstraGIS S2S.
    """
    return await AstraGISService.health_check()


# --- WORKSPACES ---

@router.get("/workspaces")
async def get_workspaces():
    return await AstraGISService.get_workspaces()


@router.post("/workspaces")
async def create_workspace(payload: Dict[str, Any] = Body(...)):
    return await AstraGISService.create_workspace(payload)


@router.put("/workspaces/{workspace_id}")
async def update_workspace(workspace_id: int, payload: Dict[str, Any] = Body(...)):
    return await AstraGISService.update_workspace(workspace_id, payload)


@router.delete("/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: int):
    return await AstraGISService.delete_workspace(workspace_id)


# --- LAYERS ---

@router.get("/layers")
async def get_layers(
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
):
    params = {"page": page, "size": size}
    return await AstraGISService.get_layers(params)


@router.post("/publish")
async def publish_layer(
    file: UploadFile = File(...),
    layer_name: str = Form(...),
    workspace_id: int = Form(...),
    description: Optional[str] = Form(""),
):
    file_bytes = await file.read()
    form_data = {
        "layer_name": layer_name,
        "workspace_id": str(workspace_id),
        "description": description or "",
    }
    return await AstraGISService.publish_layer(
        file_bytes=file_bytes,
        filename=file.filename,
        content_type=file.content_type or "image/tiff",
        form_data=form_data,
    )


@router.post("/layers/{layer_id}/style")
async def update_layer_style(layer_id: int, payload: Dict[str, Any] = Body(...)):
    return await AstraGISService.update_layer_style(layer_id, payload)


@router.delete("/layers/{layer_id}")
async def delete_layer(layer_id: int):
    return await AstraGISService.delete_layer(layer_id)


@router.get("/layers/{layer_id}/download")
async def download_layer(
    layer_id: int,
    format: str = Query("tiff", pattern="^(tiff|tif|geotiff|png)$"),
    styled: bool = Query(True),
    width: Optional[int] = Query(None),
    height: Optional[int] = Query(None),
):
    content, content_type, disposition = await AstraGISService.download_layer(
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
    return await AstraGISService.get_layer_groups()


@router.post("/layer-groups")
async def create_layer_group(payload: Dict[str, Any] = Body(...)):
    return await AstraGISService.create_layer_group(payload)


@router.put("/layer-groups/{group_id}")
async def update_layer_group(group_id: int, payload: Dict[str, Any] = Body(...)):
    return await AstraGISService.update_layer_group(group_id, payload)


@router.delete("/layer-groups/{group_id}")
async def delete_layer_group(group_id: int):
    return await AstraGISService.delete_layer_group(group_id)
