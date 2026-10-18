import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import ee
import httpx
from fastapi import HTTPException

from app.services.common.geoserver import GeoServerService
from app.services.gee_core import (
    PALETTES,
    create_roi,
    get_palette_style_entries,
    get_sentinel_composite,
)


class VegetationIndexService:
    @staticmethod
    def compute_index_image(
        composite: ee.Image,
        analysis_type: str,
    ) -> tuple[ee.Image, str]:
        """
        Menghitung band indeks spesifik dari citra komposit Sentinel-2.
        """
        a_type = analysis_type.lower()
        
        # Band dasar Sentinel-2
        b_blue = composite.select("B2")
        b_green = composite.select("B3")
        b_red = composite.select("B4")
        b_nir = composite.select("B8")
        b_swir1 = composite.select("B11")

        # 1. KATEGORI VEGETASI
        if a_type == "ndvi":
            img = composite.normalizedDifference(["B8", "B4"]).rename("ndvi")
            return img, "ndvi"

        elif a_type == "evi":
            img = composite.expression(
                "2.5 * ((NIR - RED) / (NIR + 6.0 * RED - 7.5 * BLUE + 1.0))",
                {"NIR": b_nir, "RED": b_red, "BLUE": b_blue}
            ).rename("evi")
            return img, "evi"

        elif a_type == "savi":
            img = composite.expression(
                "((NIR - RED) / (NIR + RED + 0.5)) * 1.5",
                {"NIR": b_nir, "RED": b_red}
            ).rename("savi")
            return img, "savi"

        # 2. KATEGORI AIR & MANGROVE
        elif a_type == "ndwi":
            img = composite.normalizedDifference(["B3", "B8"]).rename("ndwi")
            return img, "ndwi"

        elif a_type == "mndwi":
            img = composite.normalizedDifference(["B3", "B11"]).rename("mndwi")
            return img, "mndwi"

        elif a_type == "cmri":
            ndvi_img = composite.normalizedDifference(["B8", "B4"])
            ndwi_img = composite.normalizedDifference(["B3", "B8"])
            img = ndvi_img.subtract(ndwi_img).rename("cmri")
            return img, "cmri"

        # 3. KATEGORI BIOMASSA
        elif a_type == "agb":
            raise ValueError("AGB hanya tersedia melalui pipeline LightGBM berbasis job.")

        else:
            # Default ke NDVI
            img = composite.normalizedDifference(["B8", "B4"]).rename("ndvi")
            return img, "ndvi"

    @staticmethod
    def _get_agb_job_required_detail() -> dict:
        from app.services.agb_analysis.model_registry import get_active_model_config
        config = get_active_model_config()
        return {
            "code": "AGB_JOB_API_REQUIRED",
            "message": "Analisis AGB tersedia melalui endpoint job /api/analysis.",
            "model_version": config.version,
            "model_status": config.status,
            "model_unit": config.target["unit"],
            "disclaimer": config.disclaimer,
        }

    @classmethod
    async def analyze_area(
        cls,
        coordinates: List[List[float]],
        analysis_type: str = "ndvi",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        cloud_percentage: int = 20,
    ) -> Dict[str, Any]:
        """
        Menjalankan analisis GEE, menghasilkan Tile URL preview instan untuk peta,
        dan statistik ringkasan (min, max, mean, luas area, estimasi biomassa/karbon).
        """
        if analysis_type.lower() == "agb":
            raise HTTPException(
                status_code=503,
                detail=cls._get_agb_job_required_detail(),
            )

        try:
            # Validasi tanggal default (6 bulan terakhir jika tidak diberikan)
            if not end_date:
                end_date = datetime.now().strftime("%Y-%m-%d")
            if not start_date:
                start_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")

            roi = create_roi(coordinates)
            area_ha = roi.area().divide(10000).getInfo()
            area_ha = float(area_ha) if area_ha is not None else 1.0

            composite = get_sentinel_composite(roi, start_date, end_date, cloud_percentage)
            
            index_image, band_name = cls.compute_index_image(composite, analysis_type)
            palette_cfg = PALETTES.get(band_name, PALETTES["ndvi"])

            reducer = ee.Reducer.mean().combine(ee.Reducer.minMax(), "", True)
            stats = index_image.reduceRegion(
                reducer=reducer,
                geometry=roi,
                scale=20,
                maxPixels=1e8,
            ).getInfo()

            mean_val = float(stats.get(f"{band_name}_mean") or 0.0)
            min_val = float(stats.get(f"{band_name}_min") or 0.0)
            max_val = float(stats.get(f"{band_name}_max") or 0.0)

            # Visualisasi MapId Tile URL untuk Leaflet
            vis_params = {
                "min": palette_cfg["min"],
                "max": palette_cfg["max"],
                "palette": palette_cfg["colors"],
            }
            map_id_dict = index_image.getMapId(vis_params)
            tile_url = map_id_dict["tile_fetcher"].url_format

            return {
                "status": "success",
                "analysis_type": band_name,
                "tile_url": tile_url,
                "date_range": {"start_date": start_date, "end_date": end_date},
                "cloud_percentage": cloud_percentage,
                "statistics": {
                    "min": round(min_val, 2),
                    "max": round(max_val, 2),
                    "mean": round(mean_val, 2),
                    "area_hectares": round(area_ha, 2),
                    "mangrove_area_hectares": round(area_ha, 2),
                    "unit": palette_cfg["unit"],
                    "calculation_method": "GEE Reducer",
                },
                "palette": {
                    "min": palette_cfg["min"],
                    "max": palette_cfg["max"],
                    "colors": palette_cfg["colors"],
                    "labels": palette_cfg["labels"],
                    "style_type": palette_cfg["style_type"],
                },
                "ml_model_info": None,
                "points": [],
            }

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Gagal memproses analisis Google Earth Engine: {str(e)}",
            )

    @classmethod
    async def save_to_astragis(
        cls,
        coordinates: List[List[float]],
        analysis_type: str,
        layer_name: str,
        description: Optional[str] = "",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        cloud_percentage: int = 20,
    ) -> Dict[str, Any]:
        """
        Mengekspor hasil analisis GEE sebagai GeoTIFF resolusi 10m,
        mengunggahnya ke AstraGIS via S2S, dan menerapkan style warna otomatis.
        """
        if analysis_type.lower() == "agb":
            raise HTTPException(
                status_code=503,
                detail={
                    **cls._get_agb_job_required_detail(),
                    "message": "Publikasi AGB tersedia melalui endpoint job /api/analysis.",
                },
            )

        try:
            if not end_date:
                end_date = datetime.now().strftime("%Y-%m-%d")
            if not start_date:
                start_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")

            roi = create_roi(coordinates)
            area_ha = roi.area().divide(10000).getInfo()

            # Hitung bounding box ROI dalam meter untuk menentukan batas resolusi aman
            bounds_info = roi.bounds().coordinates().getInfo()
            bounds_pts = bounds_info[0] if bounds_info else []
            if bounds_pts:
                min_lng = min(pt[0] for pt in bounds_pts)
                max_lng = max(pt[0] for pt in bounds_pts)
                min_lat = min(pt[1] for pt in bounds_pts)
                max_lat = max(pt[1] for pt in bounds_pts)
                mid_lat = (min_lat + max_lat) / 2.0
                width_m = abs(max_lng - min_lng) * 111320.0 * math.cos(math.radians(mid_lat))
                height_m = abs(max_lat - min_lat) * 110540.0
                bbox_area_m2 = max(1.0, width_m * height_m)
            else:
                bbox_area_m2 = area_ha * 10000.0

            # Batas Earth Engine adalah 50.331.648 bytes (~12.5M piksel float32).
            # Targetkan maksimal ~6.000.000 piksel (~24 MB) agar pasti aman dan tidak pernah ditolak GEE.
            max_safe_pixels = 6_000_000
            min_scale_needed = math.sqrt(bbox_area_m2 / max_safe_pixels)

            # Pilih scale dasar dengan resolusi setinggi mungkin
            if min_scale_needed <= 10 and area_ha <= 2500:
                initial_scale = 10
            elif min_scale_needed <= 20 and area_ha <= 15000:
                initial_scale = 20
            elif min_scale_needed <= 30 and area_ha <= 60000:
                initial_scale = 30
            elif min_scale_needed <= 50:
                initial_scale = 50
            else:
                initial_scale = max(50, int(math.ceil(min_scale_needed / 10.0) * 10))

            composite = get_sentinel_composite(roi, start_date, end_date, cloud_percentage)
            index_image, band_name = cls.compute_index_image(composite, analysis_type)
            palette_cfg = PALETTES.get(band_name, PALETTES["ndvi"])

            # 1. Bangun Rules Warna Style SLD
            color_entries = get_palette_style_entries(band_name)

            # 2. Generate URL Download GeoTIFF dari Earth Engine dengan scale adaptif & retry otomatis
            scales_to_attempt = [initial_scale]
            for candidate in [20, 30, 50, 70, 100, 150, 200]:
                if candidate > initial_scale and candidate not in scales_to_attempt:
                    scales_to_attempt.append(candidate)

            download_url = None
            used_scale = initial_scale
            last_err = None

            for attempt_scale in scales_to_attempt:
                try:
                    download_url = index_image.getDownloadURL({
                        "name": layer_name.replace(" ", "_"),
                        "crs": "EPSG:4326",
                        "scale": attempt_scale,
                        "region": roi,
                        "format": "GEO_TIFF",
                    })
                    used_scale = attempt_scale
                    break
                except Exception as ee_err:
                    last_err = ee_err
                    err_msg = str(ee_err)
                    if "Total request size" in err_msg or "less than or equal" in err_msg or "too large" in err_msg.lower():
                        print(f"Scale {attempt_scale}m melebihi kuota ukuran GEE, menaikkan scale otomatis...")
                        continue
                    else:
                        raise ee_err

            if not download_url:
                raise last_err or HTTPException(status_code=500, detail="Gagal menghasilkan URL GeoTIFF dari Google Earth Engine.")

            scale = used_scale

            # 3. Coba publish via /s2s/publish-from-url (Bypass multipart limit karena body hanya JSON)
            try:
                url_payload = {
                    "layer_name": layer_name,
                    "description": description or f"GEE {band_name.upper()} Analysis ({start_date} s/d {end_date}) - {area_ha:.2f} Ha (Scale {scale}m)",
                    "download_url": download_url,
                    "style": color_entries,
                }
                publish_result = await GeoServerService.publish_from_url(url_payload)
                new_layer = publish_result.get("layer") or publish_result.get("data") or publish_result
                return {
                    "status": "success",
                    "message": "Layer hasil analisis GEE berhasil dipublikasikan ke AstraGIS via URL!",
                    "layer": new_layer,
                    "style": color_entries,
                }
            except Exception as url_err:
                print(f"Notice: publish_from_url dialihkan ke direct upload ({url_err})")

                # Fallback: Unduh GeoTIFF bytes di backend dan kirim via multipart
                async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as client:
                    tif_resp = await client.get(download_url)
                    if tif_resp.status_code != 200:
                        raise HTTPException(
                            status_code=502,
                            detail=f"Gagal mengunduh GeoTIFF dari Google Earth Engine: status {tif_resp.status_code}",
                        )
                    tif_bytes = tif_resp.content

                form_data = {
                    "layer_name": layer_name,
                    "description": description or f"GEE {band_name.upper()} Analysis ({start_date} s/d {end_date}) - {area_ha:.2f} Ha",
                }
                publish_result = await GeoServerService.publish_layer(
                    file_bytes=tif_bytes,
                    filename=f"{layer_name.replace(' ', '_')}.tif",
                    content_type="image/tiff",
                    form_data=form_data,
                )

                new_layer = publish_result.get("layer") or publish_result.get("data") or publish_result
                new_layer_id = new_layer.get("id") or new_layer.get("layer_id")

                style_payload = {
                    "style_type": palette_cfg["style_type"],
                    "colors": color_entries,
                }

                style_result = None
                if new_layer_id:
                    try:
                        style_result = await GeoServerService.update_layer_style(new_layer_id, style_payload)
                    except Exception as style_err:
                        print(f"Warning: Gagal menerapkan style otomatis: {style_err}")

                return {
                    "status": "success",
                    "message": "Layer hasil analisis GEE berhasil dipublikasikan ke AstraGIS!",
                    "layer": new_layer,
                    "style": style_result or style_payload,
                }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Gagal menyimpan analisis GEE ke AstraGIS: {str(e)}",
            )
