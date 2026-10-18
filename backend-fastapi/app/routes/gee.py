from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.dependencies.auth import get_optional_current_user
from app.models.auth import User
from app.services.vegetation_index import VegetationIndexService
from app.services.gee_extract import DatasetExtractorService
from app.services.gee_core import PALETTES, SATELLITES_CATALOG
from app.services.agb_analysis import MlAgbService, get_active_model_config
from app.services.common.spatial import record_user_layer
from app.schemas.gee import (
    AnalyzeAreaRequest,
    DatasetDownloadRequest,
    DatasetPreviewRequest,
    DatasetSaveAstraGisRequest,
    ExportAgbCsvRequest,
    SaveToAstraGisRequest,
)

router = APIRouter(prefix="/gee", tags=["Google Earth Engine"])



@router.get("/indices")
def get_available_indices():
    """
    Mengambil katalog indeks analisis yang tersedia, dikelompokkan ke dalam kategori.
    """
    model = get_active_model_config()
    return {
        "categories": [
            {
                "id": "vegetation",
                "title": "Indeks Vegetasi",
                "description": "Klorofil, kerapatan daun, dan vigor kesehatan mangrove",
                "indices": [
                    {
                        "id": "ndvi",
                        "name": "NDVI (Normalized Difference Vegetation Index)",
                        "formula": "(NIR - Red) / (NIR + Red)",
                        "description": "Indeks standar vegetasi untuk mendeteksi kehijauan kanopi mangrove.",
                        "unit": "Indeks (-1 s/d 1)",
                    },
                    {
                        "id": "evi",
                        "name": "EVI (Enhanced Vegetation Index)",
                        "formula": "2.5 * ((NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1))",
                        "description": "Optimal untuk kanopi mangrove lebat tanpa efek saturasi sinyal optik.",
                        "unit": "Indeks (EVI)",
                    },
                    {
                        "id": "savi",
                        "name": "SAVI (Soil-Adjusted Vegetation Index)",
                        "formula": "((NIR - Red) / (NIR + Red + 0.5)) * 1.5",
                        "description": "Mereduksi efek pantulan substrat tanah lumpur pesisir pada vegetasi mangrove jarang.",
                        "unit": "Indeks (SAVI)",
                    },
                ],
            },
            {
                "id": "water_mangrove",
                "title": "Indeks Air & Mangrove Spesifik",
                "description": "Deteksi batas pasang surut, kelembaban, dan isolasi kanopi mangrove",
                "indices": [
                    {
                        "id": "cmri",
                        "name": "CMRI (Combined Mangrove Recognition Index)",
                        "formula": "NDVI - NDWI",
                        "description": "Algoritma penginderaan jauh khusus untuk memisahkan vegetasi mangrove dari vegetasi darat dan air.",
                        "unit": "Indeks (CMRI)",
                    },
                    {
                        "id": "mndwi",
                        "name": "MNDWI (Modified NDWI)",
                        "formula": "(Green - SWIR1) / (Green + SWIR1)",
                        "description": "Sangat kontras mendeteksi genangan air laut pasang surut di lantai hutan mangrove.",
                        "unit": "Indeks (MNDWI)",
                    },
                    {
                        "id": "ndwi",
                        "name": "NDWI (Normalized Difference Water Index)",
                        "formula": "(Green - NIR) / (Green + NIR)",
                        "description": "Mendeteksi badan air permukaan dan kelembaban kanopi daun.",
                        "unit": "Indeks (NDWI)",
                    },
                ],
            },
            {
                "id": "biomass",
                "title": "Biomassa Mangrove",
                "description": "Estimasi biomassa atas permukaan (AGB) berbasis Machine Learning",
                "indices": [
                    {
                        "id": "agb",
                        "name": "Estimasi Biomassa AGB (Model ML LightGBM: Sentinel-1 SAR + Sentinel-2)",
                        "formula": (
                            f"LightGBM Regressor f(VV, VH, NDVI) -> AGB "
                            f"({model.target['unit']})"
                        ),
                        "description": model.disclaimer,
                        "unit": model.target["unit"],
                        "model_version": model.version,
                        "model_status": model.status,
                        "metrics_display_allowed": model.metrics_display_allowed,
                    },
                ],
            },
        ],
        "palettes": PALETTES,
    }


@router.post("/analyze")
async def analyze_area(req: AnalyzeAreaRequest):
    """
    Menjalankan komputasi GEE pada koordinat poligon area.
    Mengembalikan Tile URL interaktif dan statistik ringkasan.
    """
    return await VegetationIndexService.analyze_area(
        coordinates=req.coordinates,
        analysis_type=req.analysis_type,
        start_date=req.start_date,
        end_date=req.end_date,
        cloud_percentage=req.cloud_percentage,
    )


@router.post("/save-to-astragis")
async def save_to_astragis(
    req: SaveToAstraGisRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Mengekspor GeoTIFF hasil analisis GEE ke AstraGIS dan menerapkan style otomatis.
    """
    result = await VegetationIndexService.save_to_astragis(
        coordinates=req.coordinates,
        analysis_type=req.analysis_type,
        layer_name=req.layer_name,
        description=req.description,
        start_date=req.start_date,
        end_date=req.end_date,
        cloud_percentage=req.cloud_percentage,
    )
    if current_user and isinstance(result, dict) and "layer" in result:
        layer_obj = result.get("layer") or {}
        layer_id = layer_obj.get("id") or layer_obj.get("layer_id")
        layer_name = layer_obj.get("name") or layer_obj.get("layer_name") or req.layer_name
        if layer_id:
            record_user_layer(
                db=db,
                user_id=current_user.id,
                layer_id=layer_id,
                layer_name=layer_name,
                source="gee_analysis",
            )
    return result


# =========================================================================
# ENDPOINTS EKSTRAKSI DATASET CITRA SATELIT (UNTUK RESEARCHER / ML TRAINING)
# =========================================================================

@router.get("/satellites")
def get_available_satellites():
    """
    Mengambil katalog satelit yang didukung untuk ekstraksi dataset riset (Sentinel-2, Landsat 8/9, Sentinel-1 SAR).
    """
    return {
        "status": "success",
        "satellites": list(SATELLITES_CATALOG.values()),
    }


@router.post("/dataset/preview")
async def preview_satellite_dataset(req: DatasetPreviewRequest):
    """
    Menghasilkan tile preview di Leaflet untuk citra satelit mentah atau komposit band yang dipilih peneliti.
    """
    return await DatasetExtractorService.extract_satellite_dataset_preview(
        coordinates=req.coordinates,
        satellite=req.satellite,
        bands=req.bands,
        start_date=req.start_date,
        end_date=req.end_date,
        cloud_percentage=req.cloud_percentage,
        composite_method=req.composite_method,
        orbit_pass=req.orbit_pass,
    )


@router.post("/dataset/download-url")
async def get_satellite_dataset_download_url(req: DatasetDownloadRequest):
    """
    Mengekspor GeoTIFF multi-band langsung dari GEE dan menyusun dataset manifest JSON berstandar FAIR untuk ML training.
    """
    return await DatasetExtractorService.extract_satellite_dataset_download(
        coordinates=req.coordinates,
        satellite=req.satellite,
        bands=req.bands,
        start_date=req.start_date,
        end_date=req.end_date,
        cloud_percentage=req.cloud_percentage,
        composite_method=req.composite_method,
        orbit_pass=req.orbit_pass,
        custom_name=req.custom_name,
    )


@router.post("/dataset/save-to-astragis")
async def save_satellite_dataset_to_astragis(
    req: DatasetSaveAstraGisRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Mengekspor dataset multi-band citra satelit dan mempublikasikannya langsung ke workspace AstraGIS GeoServer.
    """
    result = await DatasetExtractorService.save_dataset_to_astragis(
        coordinates=req.coordinates,
        satellite=req.satellite,
        bands=req.bands,
        layer_name=req.layer_name,
        description=req.description,
        start_date=req.start_date,
        end_date=req.end_date,
        cloud_percentage=req.cloud_percentage,
        composite_method=req.composite_method,
        orbit_pass=req.orbit_pass,
    )
    if current_user and isinstance(result, dict) and "layer" in result:
        layer_obj = result.get("layer") or {}
        layer_id = layer_obj.get("id") or layer_obj.get("layer_id")
        layer_name = layer_obj.get("name") or layer_obj.get("layer_name") or req.layer_name
        if layer_id:
            record_user_layer(
                db=db,
                user_id=current_user.id,
                layer_id=layer_id,
                layer_name=layer_name,
                source="gee_satellite",
            )
    return result


@router.post("/export-agb-csv")
async def export_agb_csv(req: ExportAgbCsvRequest):
    """
    Mengekspor dataset hasil prediksi model ML AGB ke format CSV:
    Lat,Long,NDVI,VV,VH,AGB_Revised_kg,Unit,Model_Version,Model_Status,Disclaimer
    """
    import io
    import csv
    from fastapi.responses import StreamingResponse

    output = io.StringIO()
    writer = csv.writer(output)
    model = get_active_model_config()
    writer.writerow([
        "Lat", "Long", "NDVI", "VV", "VH", "AGB_Revised_kg",
        "Unit", "Model_Version", "Model_Status", "Disclaimer",
    ])

    model_samples = [
        {
            "lat": pt.get("lat", pt.get("latitude", 0)),
            "lng": pt.get("long", pt.get("longitude", 0)),
            "NDVI": pt.get("ndvi", pt.get("NDVI")),
            "VV": pt.get("vv", pt.get("VV")),
            "VH": pt.get("vh", pt.get("VH")),
        }
        for pt in req.points
    ]
    predicted_points = MlAgbService.process_sample_features(model_samples)["points"]

    for pt in predicted_points:
        writer.writerow([
            pt["lat"],
            pt["long"],
            pt["ndvi"],
            pt["vv"],
            pt["vh"],
            pt["agb_revised_kg"],
            model.target["unit"],
            model.version,
            model.status,
            model.disclaimer,
        ])

    output.seek(0)
    requested_filename = req.filename or "mangrove_agb_predictions.csv"
    filename = requested_filename if requested_filename.endswith(".csv") else f"{requested_filename}.csv"
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
    return response


