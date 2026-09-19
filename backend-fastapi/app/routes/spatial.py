from fastapi import APIRouter, UploadFile, File, Form, Query, Body, Response, HTTPException
from typing import Optional, Dict, Any
import tempfile
import os
import zipfile
import geopandas as gpd
from app.services.astragis_service import AstraGISService

try:
    import pyogrio
    pyogrio.set_gdal_config_options({'SHAPE_RESTORE_SHX': 'YES'})
except Exception:
    pass

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


# --- SHAPEFILE AOI PARSER ---

@router.post("/parse-shapefile")
async def parse_shapefile(file: UploadFile = File(...)):
    """
    Mengekstrak koordinat poligon AOI dari berkas Shapefile (.zip atau .shp).
    Mendukung deteksi otomatis CRS dan reproyeksi ke EPSG:4326 (WGS84).
    Mengembalikan format koordinat Leaflet [[lat, lng], ...].
    """
    filename = file.filename or ""
    lower_name = filename.lower()
    if not (lower_name.endswith(".zip") or lower_name.endswith(".shp")):
        raise HTTPException(
            status_code=400,
            detail="Berkas harus berupa arsip Shapefile (.zip) atau berkas Shapefile (.shp)",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Berkas yang diunggah kosong.")

    with tempfile.TemporaryDirectory() as tmpdir:
        target_shp_path = None

        if lower_name.endswith(".zip"):
            zip_path = os.path.join(tmpdir, "uploaded.zip")
            with open(zip_path, "wb") as f:
                f.write(file_bytes)

            extract_dir = os.path.join(tmpdir, "extracted")
            os.makedirs(extract_dir, exist_ok=True)
            try:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(extract_dir)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Gagal mengekstrak berkas ZIP: {str(e)}")

            # Cari file .shp di dalam direktori hasil ekstrak
            for root, _, files in os.walk(extract_dir):
                for f in files:
                    if f.lower().endswith(".shp"):
                        target_shp_path = os.path.join(root, f)
                        break
                if target_shp_path:
                    break

            if not target_shp_path:
                raise HTTPException(status_code=400, detail="Berkas ZIP tidak memuat berkas komponen Shapefile (.shp).")

        else:
            # Standalone .shp
            target_shp_path = os.path.join(tmpdir, "uploaded.shp")
            with open(target_shp_path, "wb") as f:
                f.write(file_bytes)

        # Buka dengan GeoPandas (utamakan pyogrio dengan auto restore SHX)
        try:
            try:
                gdf = gpd.read_file(target_shp_path, engine="pyogrio")
            except Exception:
                gdf = gpd.read_file(target_shp_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Gagal membaca Shapefile: {str(e)}")

        if gdf.empty or len(gdf) == 0:
            raise HTTPException(status_code=400, detail="Shapefile tidak memiliki rekaman atau baris geometri.")

        source_crs = str(gdf.crs) if gdf.crs else "EPSG:4326 (asumsi)"

        # Reproyeksi ke EPSG:4326 jika memiliki sistem koordinat proyeksi lain (misal UTM)
        if gdf.crs is not None:
            try:
                epsg_code = gdf.crs.to_epsg()
                if epsg_code != 4326:
                    gdf = gdf.to_crs(epsg=4326)
            except Exception:
                try:
                    gdf = gdf.to_crs(epsg=4326)
                except Exception:
                    pass

        # Ambil atau satukan seluruh geometri poligon
        try:
            union_geom = gdf.geometry.union_all() if hasattr(gdf.geometry, "union_all") else gdf.geometry.unary_union
        except Exception:
            union_geom = gdf.iloc[0].geometry

        if union_geom is None or union_geom.is_empty:
            raise HTTPException(status_code=400, detail="Shapefile tidak memiliki geometri yang valid.")

        # Ekstrak poligon utama
        poly = None
        if union_geom.geom_type == "Polygon":
            poly = union_geom
        elif union_geom.geom_type == "MultiPolygon":
            poly = max(union_geom.geoms, key=lambda p: p.area)
        elif union_geom.geom_type == "GeometryCollection":
            polys = [g for g in union_geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
            if not polys:
                raise HTTPException(status_code=400, detail="Shapefile tidak memuat poligon area.")
            largest = max(polys, key=lambda p: p.area)
            poly = max(largest.geoms, key=lambda p: p.area) if largest.geom_type == "MultiPolygon" else largest
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Tipe geometri '{union_geom.geom_type}' tidak dapat digunakan sebagai AOI (harus bertipe Polygon/MultiPolygon)."
            )

        raw_coords = list(poly.exterior.coords)
        if len(raw_coords) < 3:
            raise HTTPException(status_code=400, detail="Poligon Shapefile memiliki kurang dari 3 titik sudut.")

        # Format koordinat ke standar Leaflet [lat, lng]
        points = []
        for coord in raw_coords:
            lng = float(coord[0])
            lat = float(coord[1])
            points.append([round(lat, 6), round(lng, 6)])

        # Hilangkan titik penutup yang duplikat
        if len(points) > 3 and points[0] == points[-1]:
            points.pop()

        # Validasi batas koordinat geografis WGS84 (Lat: -90..90, Lng: -180..180)
        has_out_of_bounds = any(pt[0] < -90 or pt[0] > 90 or pt[1] < -180 or pt[1] > 180 for pt in points)
        if has_out_of_bounds:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Koordinat poligon terdeteksi menggunakan sistem terproyeksi (seperti UTM) tanpa metadata proyeksi (.prj). "
                    "Harap unggah seluruh komponen Shapefile (.shp, .shx, .dbf, .prj) yang dikompresi ke dalam satu file .zip "
                    "agar dapat direproyeksi secara otomatis ke koordinat WGS84."
                )
            )

        return {
            "success": True,
            "filename": filename,
            "points": points,
            "count": len(points),
            "source_crs": source_crs,
        }

