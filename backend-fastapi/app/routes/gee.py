from fastapi import APIRouter
from app.services.gee_service import GeeAnalysisService
from app.services.gee_catalog import PALETTES, SATELLITES_CATALOG
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
                        "formula": "LightGBM Regressor f(VV, VH, NDVI) -> AGB (kg)",
                        "description": "Model Machine Learning presisi tinggi berbasis perpaduan radar C-band Sentinel-1 dan optik Sentinel-2 untuk estimasi biomassa mangrove.",
                        "unit": "kg (AGB)",
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
    return await GeeAnalysisService.analyze_area(
        coordinates=req.coordinates,
        analysis_type=req.analysis_type,
        start_date=req.start_date,
        end_date=req.end_date,
        cloud_percentage=req.cloud_percentage,
    )


@router.post("/save-to-astragis")
async def save_to_astragis(req: SaveToAstraGisRequest):
    """
    Mengekspor GeoTIFF hasil analisis GEE ke AstraGIS dan menerapkan style otomatis.
    """
    return await GeeAnalysisService.save_to_astragis(
        coordinates=req.coordinates,
        analysis_type=req.analysis_type,
        layer_name=req.layer_name,
        description=req.description,
        start_date=req.start_date,
        end_date=req.end_date,
        cloud_percentage=req.cloud_percentage,
    )


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
    return await GeeAnalysisService.extract_satellite_dataset_preview(
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
    return await GeeAnalysisService.extract_satellite_dataset_download(
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
async def save_satellite_dataset_to_astragis(req: DatasetSaveAstraGisRequest):
    """
    Mengekspor dataset multi-band citra satelit dan mempublikasikannya langsung ke workspace AstraGIS GeoServer.
    """
    return await GeeAnalysisService.save_dataset_to_astragis(
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


@router.post("/export-agb-csv")
async def export_agb_csv(req: ExportAgbCsvRequest):
    """
    Mengekspor dataset hasil prediksi model ML AGB ke format CSV:
    Lat,Long,NDVI,VV,VH,AGB_Revised_kg
    """
    import io
    import csv
    from fastapi.responses import StreamingResponse

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Lat", "Long", "NDVI", "VV", "VH", "AGB_Revised_kg"])

    for pt in req.points:
        writer.writerow([
            pt.get("lat", pt.get("latitude", "")),
            pt.get("long", pt.get("longitude", "")),
            pt.get("ndvi", ""),
            pt.get("vv", ""),
            pt.get("vh", ""),
            pt.get("agb_revised_kg", ""),
        ])

    output.seek(0)
    filename = req.filename if req.filename.endswith(".csv") else f"{req.filename}.csv"
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
    return response


