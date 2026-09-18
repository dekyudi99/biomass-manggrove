from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.services.gee_service import GeeAnalysisService, PALETTES

router = APIRouter(prefix="/gee", tags=["Google Earth Engine"])


class AnalyzeAreaRequest(BaseModel):
    coordinates: List[List[float]] = Field(
        ...,
        description="Daftar titik koordinat poligon [lat, lng] dari Leaflet map"
    )
    analysis_type: str = Field(
        "ndvi",
        description="Jenis analisis: ndvi, evi, savi, ndwi, mndwi, cmri, agb, carbon, canopy_density"
    )
    start_date: Optional[str] = Field(None, description="Tanggal awal (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Tanggal akhir (YYYY-MM-DD)")
    cloud_percentage: int = Field(20, ge=1, le=100, description="Maksimal tutupan awan (%)")


class SaveToAstraGisRequest(BaseModel):
    coordinates: List[List[float]] = Field(
        ...,
        description="Daftar titik koordinat poligon [lat, lng] dari Leaflet map"
    )
    analysis_type: str = Field(
        "ndvi",
        description="Jenis analisis: ndvi, evi, savi, ndwi, mndwi, cmri, agb, carbon, canopy_density"
    )
    workspace_id: int = Field(
        ...,
        description="ID workspace AstraGIS tujuan tempat layer disimpan"
    )
    layer_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
        description="Nama layer GeoTIFF di AstraGIS"
    )
    description: Optional[str] = Field("", description="Deskripsi singkat layer")
    start_date: Optional[str] = Field(None, description="Tanggal awal (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Tanggal akhir (YYYY-MM-DD)")
    cloud_percentage: int = Field(20, ge=1, le=100, description="Maksimal tutupan awan (%)")


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
                "id": "biomass_carbon",
                "title": "Biomassa & Cadangan Karbon",
                "description": "Estimasi tonase biomassa atas permukaan (AGB) dan stok karbon organik",
                "indices": [
                    {
                        "id": "agb",
                        "name": "Estimasi Biomassa di Atas Permukaan (AGB)",
                        "formula": "Model Regresi Alometrik Mangrove Empiris (Ton/Ha)",
                        "description": "Estimasi biomassa tegakan mangrove per hektar dan total tonase pada area poligon.",
                        "unit": "Ton / Hektar",
                    },
                    {
                        "id": "carbon",
                        "name": "Cadangan Karbon Mangrove (Carbon Stock)",
                        "formula": "AGB * 0.47 (Faktor Konversi IPCC)",
                        "description": "Kandungan karbon organik tersimpan pada biomassa vegetasi mangrove.",
                        "unit": "Ton C / Hektar",
                    },
                    {
                        "id": "canopy_density",
                        "name": "Klasifikasi Kerapatan Kanopi Mangrove",
                        "formula": "Kerapatan: Lebat (>70%), Sedang (50-70%), Jarang (<50%)",
                        "description": "Zonasi tingkat tutupan tajuk mangrove untuk perencanaan restorasi dan konservasi.",
                        "unit": "Kelas Kerapatan",
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
        workspace_id=req.workspace_id,
        layer_name=req.layer_name,
        description=req.description,
        start_date=req.start_date,
        end_date=req.end_date,
        cloud_percentage=req.cloud_percentage,
    )
