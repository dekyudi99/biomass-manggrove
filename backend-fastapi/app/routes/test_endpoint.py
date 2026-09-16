from fastapi import APIRouter
import ee

router = APIRouter(prefix="/test", tags=["test"])

@router.get("/")
def read_root():
    return {"message": "Biomass Mangrove API is running!"}

@router.get("/gee-check")
def test_gee_connection():
    try:
        # Melakukan tes komputasi di cloud Google Earth Engine
        result = ee.Number(25).multiply(4).getInfo()
        
        # Mengecek metadata satu citra Sentinel-2 (citra yang umum dipakai untuk mangrove)
        sample_image = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").first().getInfo()
        # satellite_id = sample_image["id"]
        return {
            "status": "connected",
            "message": "Sukses terhubung ke Google Earth Engine!",
            "math_test": result,
            "sample_satellite_image": sample_image
        }
    except Exception as e:
        return {
            "status": "error",
            "message": "Gagal terhubung ke GEE",
            "detail": str(e)
        }
