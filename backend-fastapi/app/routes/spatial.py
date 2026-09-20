from fastapi import APIRouter, UploadFile, File, Form, Query, Body, Response, HTTPException
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel
from shapely.geometry import Polygon
import tempfile
import os
import io
import re
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

    if not upload_list:
        raise HTTPException(status_code=400, detail="Tidak ada berkas yang diunggah.")

    with tempfile.TemporaryDirectory() as tmpdir:
        saved_files = []
        for uf in upload_list:
            fname = os.path.basename(uf.filename or "uploaded")
            fbytes = await uf.read()
            if not fbytes:
                continue
            save_path = os.path.join(tmpdir, fname)
            with open(save_path, "wb") as f:
                f.write(fbytes)
            saved_files.append((fname, save_path))

        if not saved_files:
            raise HTTPException(status_code=400, detail="Berkas yang diunggah kosong.")

        # Jika terdapat berkas .zip, ekstrak seluruh isinya
        for fname, save_path in saved_files:
            if fname.lower().endswith(".zip"):
                extract_dir = os.path.join(tmpdir, "extracted")
                os.makedirs(extract_dir, exist_ok=True)
                try:
                    with zipfile.ZipFile(save_path, "r") as zf:
                        zf.extractall(extract_dir)
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Gagal mengekstrak berkas ZIP: {str(e)}")

        # Cari semua berkas .shp di dalam tmpdir dan subdirektori
        shp_candidates = []
        for root, _, flist in os.walk(tmpdir):
            for f in flist:
                if f.lower().endswith(".shp"):
                    shp_candidates.append(os.path.join(root, f))

        if not shp_candidates:
            raise HTTPException(
                status_code=400,
                detail="Tidak ditemukan berkas Shapefile (.shp) di antara berkas yang diunggah.",
            )

        # Prioritaskan file .shp yang memiliki file .prj pasangan di folder yang sama
        target_shp_path = shp_candidates[0]
        for candidate in shp_candidates:
            base_no_ext = os.path.splitext(candidate)[0]
            if os.path.exists(base_no_ext + ".prj") or os.path.exists(base_no_ext + ".PRJ"):
                target_shp_path = candidate
                break

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

        # Optimasi Performa Geospasial:
        # Batasi jumlah titik poligon (maksimal ~200 titik) agar sangat ringan
        # saat dimuat di Leaflet, diedit di browser, dan dikirim ke Google Earth Engine.
        MAX_TARGET_POINTS = 200
        initial_coords = list(poly.exterior.coords)
        original_count = len(initial_coords)

        if original_count > MAX_TARGET_POINTS:
            minx, miny, maxx, maxy = poly.bounds
            span = max(maxx - minx, maxy - miny)
            # Mulai dari toleransi awal adaptif
            current_tol = max(span * 0.0005, 0.00005)

            # Lakukan penyederhanaan adaptif bertahap menggunakan algoritma Douglas-Peucker
            for _ in range(8):
                try:
                    simplified = poly.simplify(current_tol, preserve_topology=True)
                    if simplified.geom_type == "Polygon" and len(simplified.exterior.coords) >= 4:
                        poly = simplified
                    elif simplified.geom_type == "MultiPolygon" and len(simplified.geoms) > 0:
                        poly = max(simplified.geoms, key=lambda p: p.area)

                    if len(poly.exterior.coords) <= MAX_TARGET_POINTS:
                        break
                    current_tol *= 1.8  # Tingkatkan toleransi secara bertahap
                except Exception:
                    break

            # Pengaman fallback: Jika masih di atas MAX_TARGET_POINTS (misal garis fraktal sangat rapat),
            # lakukan downsampling titik berjarak teratur dengan menjaga ring tertutup
            curr_coords = list(poly.exterior.coords)
            if len(curr_coords) > MAX_TARGET_POINTS:
                step = max(1, len(curr_coords) // MAX_TARGET_POINTS)
                downsampled = curr_coords[::step]
                if downsampled[0] != downsampled[-1]:
                    downsampled.append(downsampled[0])
                if len(downsampled) >= 4:
                    from shapely.geometry import Polygon as SPoly
                    test_poly = SPoly(downsampled)
                    if test_poly.is_valid and test_poly.area > 0:
                        poly = test_poly

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
                    "Harap unggah berkas .prj bersamaan dengan berkas .shp (bisa multi-select pilih .shp dan .prj sekaligus) "
                    "atau kompresi ke dalam satu file .zip agar dapat direproyeksi secara otomatis ke koordinat WGS84."
                )
            )

        display_name = os.path.basename(target_shp_path)

        return {
            "success": True,
            "filename": display_name,
            "points": points,
            "count": len(points),
            "original_count": original_count,
            "source_crs": source_crs,
        }


# --- SHAPEFILE AOI EXPORTER ---

class ExportShapefileRequest(BaseModel):
    points: List[List[float]]
    name: Optional[str] = "Mangrove_AOI"
    area_hectares: Optional[float] = 0.0


@router.post("/export-shapefile")
async def export_shapefile(req: ExportShapefileRequest):
    """
    Mengekspor poligon koordinat Leaflet [[lat, lng], ...] menjadi berkas arsip ESRI Shapefile (.zip).
    Memuat .shp, .shx, .dbf, .prj (EPSG:4326), dan .cpg (UTF-8).
    """
    if not req.points or len(req.points) < 3:
        raise HTTPException(status_code=400, detail="Poligon harus memiliki minimal 3 titik sudut koordinat.")

    clean_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', req.name or "Mangrove_AOI").strip('_') or "Mangrove_AOI"

    # Leaflet [lat, lng] -> GeoJSON/Shapely [lng, lat]
    ring = [(float(pt[1]), float(pt[0])) for pt in req.points]
    if ring[0] != ring[-1]:
        ring.append(ring[0])

    poly = Polygon(ring)
    gdf = gpd.GeoDataFrame(
        {
            "name": [clean_name],
            "area_ha": [round(float(req.area_hectares or 0.0), 2)],
            "vertices": [len(req.points)],
            "created_at": [datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
            "source": ["Mangrove Biomass GIS"],
        },
        geometry=[poly],
        crs="EPSG:4326",
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        shp_path = os.path.join(tmpdir, f"{clean_name}.shp")
        gdf.to_file(shp_path, driver="ESRI Shapefile", encoding="utf-8")

        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in os.listdir(tmpdir):
                if f.startswith(clean_name):
                    zf.write(os.path.join(tmpdir, f), f)

        zip_bytes = zip_buf.getvalue()

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{clean_name}.zip"',
            "Cache-Control": "no-cache",
        },
    )


