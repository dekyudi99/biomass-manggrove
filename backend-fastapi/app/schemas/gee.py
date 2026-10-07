from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AnalyzeAreaRequest(BaseModel):
    coordinates: List[List[float]] = Field(
        ...,
        description="Daftar titik koordinat poligon [lat, lng] dari Leaflet map",
    )
    analysis_type: str = Field(
        "ndvi",
        description="Jenis analisis: ndvi, evi, savi, ndwi, mndwi, cmri, agb",
    )
    start_date: Optional[str] = Field(None, description="Tanggal awal (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Tanggal akhir (YYYY-MM-DD)")
    cloud_percentage: int = Field(20, ge=1, le=100, description="Maksimal tutupan awan (%)")


class SaveToAstraGisRequest(BaseModel):
    coordinates: List[List[float]] = Field(
        ...,
        description="Daftar titik koordinat poligon [lat, lng] dari Leaflet map",
    )
    analysis_type: str = Field(
        "ndvi",
        description="Jenis analisis: ndvi, evi, savi, ndwi, mndwi, cmri, agb",
    )
    workspace_id: Optional[str] = Field(None, description="Legacy field; target workspace ditentukan backend")
    layer_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
        description="Nama layer GeoTIFF di AstraGIS",
    )
    description: Optional[str] = Field("", description="Deskripsi singkat layer")
    start_date: Optional[str] = Field(None, description="Tanggal awal (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Tanggal akhir (YYYY-MM-DD)")
    cloud_percentage: int = Field(20, ge=1, le=100, description="Maksimal tutupan awan (%)")


class DatasetPreviewRequest(BaseModel):
    coordinates: List[List[float]] = Field(
        ...,
        description="Daftar titik koordinat poligon [lat, lng] dari Leaflet map",
    )
    satellite: str = Field("sentinel2", description="ID satelit: sentinel2, landsat89, sentinel1")
    bands: Optional[List[str]] = Field(None, description="Daftar band yang dipilih (contoh: ['B4', 'B3', 'B2'])")
    start_date: Optional[str] = Field(None, description="Tanggal awal (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Tanggal akhir (YYYY-MM-DD)")
    cloud_percentage: int = Field(20, ge=1, le=100, description="Maksimal tutupan awan (%)")
    composite_method: str = Field("median", description="Metode reduksi: median, mean, min, max, mosaic")
    orbit_pass: str = Field("ANY", description="Orbit pass SAR: ANY, ASCENDING, DESCENDING")


class DatasetDownloadRequest(BaseModel):
    coordinates: List[List[float]] = Field(
        ...,
        description="Daftar titik koordinat poligon [lat, lng] dari Leaflet map",
    )
    satellite: str = Field("sentinel2", description="ID satelit: sentinel2, landsat89, sentinel1")
    bands: Optional[List[str]] = Field(None, description="Daftar band yang dipilih")
    start_date: Optional[str] = Field(None, description="Tanggal awal (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Tanggal akhir (YYYY-MM-DD)")
    cloud_percentage: int = Field(20, ge=1, le=100, description="Maksimal tutupan awan (%)")
    composite_method: str = Field("median", description="Metode reduksi: median, mean, min, max, mosaic")
    orbit_pass: str = Field("ANY", description="Orbit pass SAR: ANY, ASCENDING, DESCENDING")
    custom_name: Optional[str] = Field(None, description="Nama kustom dataset")


class DatasetSaveAstraGisRequest(BaseModel):
    coordinates: List[List[float]] = Field(
        ...,
        description="Daftar titik koordinat poligon [lat, lng] dari Leaflet map",
    )
    satellite: str = Field("sentinel2", description="ID satelit: sentinel2, landsat89, sentinel1")
    bands: Optional[List[str]] = Field(None, description="Daftar band yang dipilih")
    workspace_id: Optional[str] = Field(None, description="Legacy field; target workspace ditentukan backend")
    layer_name: str = Field(..., min_length=1, max_length=150, description="Nama layer di AstraGIS")
    description: Optional[str] = Field("", description="Deskripsi singkat dataset")
    start_date: Optional[str] = Field(None, description="Tanggal awal (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Tanggal akhir (YYYY-MM-DD)")
    cloud_percentage: int = Field(20, ge=1, le=100, description="Maksimal tutupan awan (%)")
    composite_method: str = Field("median", description="Metode reduksi: median, mean, min, max, mosaic")
    orbit_pass: str = Field("ANY", description="Orbit pass SAR: ANY, ASCENDING, DESCENDING")


class ExportAgbCsvRequest(BaseModel):
    points: List[Dict[str, Any]] = Field(
        ...,
        description="Daftar titik hasil prediksi AGB [{'lat': ..., 'long': ..., 'ndvi': ..., 'vv': ..., 'vh': ..., 'agb_revised_kg': ...}]",
    )
    filename: Optional[str] = Field("mangrove_agb_predictions.csv", description="Nama file CSV output")