import io
import os
import re
import tempfile
import zipfile
from datetime import datetime
from typing import Any, Dict, List, Optional

import geopandas as gpd
from fastapi import HTTPException, UploadFile
from shapely.geometry import Polygon

try:
    import pyogrio

    pyogrio.set_gdal_config_options({"SHAPE_RESTORE_SHX": "YES"})
except Exception:
    pass


MAX_AOI_POINTS = 200
DEFAULT_SHAPEFILE_NAME = "Mangrove_AOI"
SHAPEFILE_SOURCE_NAME = "Mangrove Biomass GIS"


def _select_polygon(geometry):
    if geometry.geom_type == "Polygon":
        return geometry
    if geometry.geom_type == "MultiPolygon":
        return max(geometry.geoms, key=lambda polygon: polygon.area)
    if geometry.geom_type == "GeometryCollection":
        polygons = [
            item for item in geometry.geoms
            if item.geom_type in ("Polygon", "MultiPolygon")
        ]
        if not polygons:
            raise HTTPException(status_code=400, detail="Shapefile tidak memuat poligon area.")
        largest = max(polygons, key=lambda polygon: polygon.area)
        return max(largest.geoms, key=lambda polygon: polygon.area) if largest.geom_type == "MultiPolygon" else largest

    raise HTTPException(
        status_code=400,
        detail=(
            f"Tipe geometri '{geometry.geom_type}' tidak dapat digunakan sebagai AOI "
            "(harus bertipe Polygon/MultiPolygon)."
        ),
    )


def _simplify_polygon(polygon):
    coordinates = list(polygon.exterior.coords)
    original_count = len(coordinates)

    if original_count <= MAX_AOI_POINTS:
        return polygon, original_count

    min_x, min_y, max_x, max_y = polygon.bounds
    span = max(max_x - min_x, max_y - min_y)
    tolerance = max(span * 0.0005, 0.00005)

    for _ in range(8):
        try:
            simplified = polygon.simplify(tolerance, preserve_topology=True)
            if simplified.geom_type == "Polygon" and len(simplified.exterior.coords) >= 4:
                polygon = simplified
            elif simplified.geom_type == "MultiPolygon" and len(simplified.geoms) > 0:
                polygon = max(simplified.geoms, key=lambda item: item.area)

            if len(polygon.exterior.coords) <= MAX_AOI_POINTS:
                break
            tolerance *= 1.8
        except Exception:
            break

    current_coordinates = list(polygon.exterior.coords)
    if len(current_coordinates) > MAX_AOI_POINTS:
        step = max(1, len(current_coordinates) // MAX_AOI_POINTS)
        downsampled = current_coordinates[::step]
        if downsampled[0] != downsampled[-1]:
            downsampled.append(downsampled[0])
        if len(downsampled) >= 4:
            from shapely.geometry import Polygon as ShapelyPolygon

            candidate = ShapelyPolygon(downsampled)
            if candidate.is_valid and candidate.area > 0:
                polygon = candidate

    return polygon, original_count


def _read_shapefile(path):
    try:
        try:
            return gpd.read_file(path, engine="pyogrio")
        except Exception:
            return gpd.read_file(path)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Gagal membaca Shapefile: {str(error)}") from error


def _extract_shapefile_points(upload_list: List[tuple[str, bytes]]) -> Dict[str, Any]:
    if not upload_list:
        raise HTTPException(status_code=400, detail="Tidak ada berkas yang diunggah.")

    with tempfile.TemporaryDirectory() as temporary_directory:
        saved_files = []
        for filename, file_bytes in upload_list:
            safe_filename = os.path.basename(filename or "uploaded")
            if not file_bytes:
                continue
            file_path = os.path.join(temporary_directory, safe_filename)
            with open(file_path, "wb") as output_file:
                output_file.write(file_bytes)
            saved_files.append((safe_filename, file_path))

        if not saved_files:
            raise HTTPException(status_code=400, detail="Berkas yang diunggah kosong.")

        for filename, file_path in saved_files:
            if filename.lower().endswith(".zip"):
                extract_directory = os.path.join(temporary_directory, "extracted")
                os.makedirs(extract_directory, exist_ok=True)
                try:
                    with zipfile.ZipFile(file_path, "r") as zip_file:
                        zip_file.extractall(extract_directory)
                except Exception as error:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Gagal mengekstrak berkas ZIP: {str(error)}",
                    ) from error

        shapefile_candidates = []
        for root, _, filenames in os.walk(temporary_directory):
            shapefile_candidates.extend(
                os.path.join(root, filename)
                for filename in filenames
                if filename.lower().endswith(".shp")
            )

        if not shapefile_candidates:
            raise HTTPException(
                status_code=400,
                detail="Tidak ditemukan berkas Shapefile (.shp) di antara berkas yang diunggah.",
            )

        target_shapefile_path = shapefile_candidates[0]
        for candidate in shapefile_candidates:
            base_path = os.path.splitext(candidate)[0]
            if os.path.exists(base_path + ".prj") or os.path.exists(base_path + ".PRJ"):
                target_shapefile_path = candidate
                break

        geodataframe = _read_shapefile(target_shapefile_path)
        if geodataframe.empty or len(geodataframe) == 0:
            raise HTTPException(
                status_code=400,
                detail="Shapefile tidak memiliki rekaman atau baris geometri.",
            )

        source_crs = str(geodataframe.crs) if geodataframe.crs else "EPSG:4326 (asumsi)"
        if geodataframe.crs is not None:
            try:
                if geodataframe.crs.to_epsg() != 4326:
                    geodataframe = geodataframe.to_crs(epsg=4326)
            except Exception:
                try:
                    geodataframe = geodataframe.to_crs(epsg=4326)
                except Exception:
                    pass

        try:
            geometry = (
                geodataframe.geometry.union_all()
                if hasattr(geodataframe.geometry, "union_all")
                else geodataframe.geometry.unary_union
            )
        except Exception:
            geometry = geodataframe.iloc[0].geometry

        if geometry is None or geometry.is_empty:
            raise HTTPException(status_code=400, detail="Shapefile tidak memiliki geometri yang valid.")

        polygon = _select_polygon(geometry)
        polygon, original_count = _simplify_polygon(polygon)
        raw_coordinates = list(polygon.exterior.coords)
        if len(raw_coordinates) < 3:
            raise HTTPException(
                status_code=400,
                detail="Poligon Shapefile memiliki kurang dari 3 titik sudut.",
            )

        points = [
            [round(float(latitude), 6), round(float(longitude), 6)]
            for longitude, latitude in raw_coordinates
        ]
        if len(points) > 3 and points[0] == points[-1]:
            points.pop()

        has_out_of_bounds = any(
            latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180
            for latitude, longitude in points
        )
        if has_out_of_bounds:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Koordinat poligon terdeteksi menggunakan sistem terproyeksi (seperti UTM) tanpa metadata proyeksi (.prj). "
                    "Harap unggah berkas .prj bersamaan dengan berkas .shp (bisa multi-select pilih .shp dan .prj sekaligus) "
                    "atau kompresi ke dalam satu file .zip agar dapat direproyeksi secara otomatis ke koordinat WGS84."
                ),
            )

        return {
            "success": True,
            "filename": os.path.basename(target_shapefile_path),
            "points": points,
            "count": len(points),
            "original_count": original_count,
            "source_crs": source_crs,
        }


async def parse_shapefile_uploads(files: List[UploadFile]) -> Dict[str, Any]:
    upload_list = []
    for upload in files:
        file_bytes = await upload.read()
        upload_list.append((upload.filename or "uploaded", file_bytes))
    return _extract_shapefile_points(upload_list)


def export_shapefile_zip(
    points: List[List[float]],
    name: Optional[str] = DEFAULT_SHAPEFILE_NAME,
    area_hectares: Optional[float] = 0.0,
) -> tuple[str, bytes]:
    if not points or len(points) < 3:
        raise HTTPException(
            status_code=400,
            detail="Poligon harus memiliki minimal 3 titik sudut koordinat.",
        )

    clean_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", name or DEFAULT_SHAPEFILE_NAME).strip("_") or DEFAULT_SHAPEFILE_NAME
    ring = [(float(point[1]), float(point[0])) for point in points]
    if ring[0] != ring[-1]:
        ring.append(ring[0])

    polygon = Polygon(ring)
    geodataframe = gpd.GeoDataFrame(
        {
            "name": [clean_name],
            "area_ha": [round(float(area_hectares or 0.0), 2)],
            "vertices": [len(points)],
            "created_at": [datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
            "source": [SHAPEFILE_SOURCE_NAME],
        },
        geometry=[polygon],
        crs="EPSG:4326",
    )

    with tempfile.TemporaryDirectory() as temporary_directory:
        shapefile_path = os.path.join(temporary_directory, f"{clean_name}.shp")
        geodataframe.to_file(shapefile_path, driver="ESRI Shapefile", encoding="utf-8")

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for filename in os.listdir(temporary_directory):
                if filename.startswith(clean_name):
                    zip_file.write(os.path.join(temporary_directory, filename), filename)

    return clean_name, zip_buffer.getvalue()