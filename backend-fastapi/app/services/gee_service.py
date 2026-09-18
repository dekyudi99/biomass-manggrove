import os
import math
import ee
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from app.services.astragis_service import AstraGISService

# Palette standar untuk visualisasi GEE & SLD
PALETTES = {
    "ndvi": {
        "min": -0.1,
        "max": 0.85,
        "colors": ["#d73027", "#f46d43", "#fdae61", "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
        "labels": ["Non-Vegetasi / Air", "Sangat Rendah", "Rendah", "Cukup", "Sedang", "Bagus", "Tinggi", "Lebat", "Mangrove Sangat Lebat"],
        "style_type": "ramp",
        "unit": "Indeks (-1 s/d 1)",
    },
    "evi": {
        "min": 0.0,
        "max": 0.8,
        "colors": ["#a50026", "#d73027", "#fdae61", "#fee08b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
        "labels": ["Terbuka", "Minimal", "Rendah", "Sedang", "Bagus", "Tinggi", "Sangat Tinggi", "Kanopi Maksimal"],
        "style_type": "ramp",
        "unit": "Indeks (EVI)",
    },
    "savi": {
        "min": 0.0,
        "max": 0.75,
        "colors": ["#8c510a", "#d8b365", "#f6e8c3", "#c7eae5", "#5ab4ac", "#01665e"],
        "labels": ["Lumpur/Tanah", "Transisi", "Vegetasi Awal", "Sedang", "Bagus", "Mangrove Sehat"],
        "style_type": "ramp",
        "unit": "Indeks (SAVI)",
    },
    "ndwi": {
        "min": -0.5,
        "max": 0.5,
        "colors": ["#8c510a", "#f6e8c3", "#c7eae5", "#41b6c4", "#225ea8", "#081d58"],
        "labels": ["Vegetasi Kering", "Daratan", "Lembab", "Permukaan Air Dangkal", "Badan Air", "Air Dalam"],
        "style_type": "ramp",
        "unit": "Indeks (NDWI)",
    },
    "mndwi": {
        "min": -0.6,
        "max": 0.6,
        "colors": ["#8c510a", "#dfc27d", "#f6e8c3", "#c7eae5", "#80cdc1", "#018571"],
        "labels": ["Daratan", "Pesisir Kering", "Garis Pantai", "Genangan Pasang", "Saluran Estuari", "Badan Air Utama"],
        "style_type": "ramp",
        "unit": "Indeks (MNDWI)",
    },
    "cmri": {
        "min": 0.0,
        "max": 1.2,
        "colors": ["#440154", "#3b528b", "#21908c", "#5dc863", "#fde725"],
        "labels": ["Bukan Mangrove", "Probabilitas Rendah", "Mangrove Campuran", "Mangrove Dominan", "Mangrove Inti Murni"],
        "style_type": "ramp",
        "unit": "Indeks (CMRI)",
    },
    "agb": {
        "min": 0.0,
        "max": 350.0,
        "colors": ["#ffffcc", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#0c2c84"],
        "labels": ["0-20 Ton/Ha", "20-60 Ton/Ha", "60-120 Ton/Ha", "120-180 Ton/Ha", "180-240 Ton/Ha", "240-300 Ton/Ha", ">300 Ton/Ha"],
        "style_type": "ramp",
        "unit": "Ton / Hektar",
    },
    "carbon": {
        "min": 0.0,
        "max": 165.0,
        "colors": ["#edf8fb", "#b2e2e2", "#66c2a4", "#2ca25f", "#006d2c"],
        "labels": ["0-15 Ton C/Ha", "15-40 Ton C/Ha", "40-75 Ton C/Ha", "75-115 Ton C/Ha", ">115 Ton C/Ha"],
        "style_type": "ramp",
        "unit": "Ton C / Hektar",
    },
    "canopy_density": {
        "min": 1,
        "max": 3,
        "colors": ["#fee391", "#fe9929", "#006d2c"],
        "labels": ["Jarang (<50%)", "Sedang (50-70%)", "Lebat (>70%)"],
        "style_type": "values",
        "unit": "Kelas Kerapatan",
    },
}


class GeeAnalysisService:
    @staticmethod
    def _create_roi(coordinates: List[List[float]]) -> ee.Geometry.Polygon:
        """
        Mengonversi koordinat Leaflet [lat, lng] menjadi GEE [lng, lat].
        """
        if not coordinates or len(coordinates) < 3:
            raise ValueError("Poligon minimal memerlukan 3 titik koordinat.")
        
        # Leaflet [lat, lng] -> GEE [lng, lat]
        ee_coords = [[pt[1], pt[0]] for pt in coordinates]
        
        # Pastikan cincin koordinat tertutup
        if ee_coords[0] != ee_coords[-1]:
            ee_coords.append(ee_coords[0])
            
        return ee.Geometry.Polygon([ee_coords])

    @staticmethod
    def _mask_s2_clouds(image: ee.Image) -> ee.Image:
        """
        Masking awan dan cirrus pada citra Sentinel-2 Surface Reflectance (SR).
        """
        qa = image.select("QA60")
        cloud_bit_mask = 1 << 10
        cirrus_bit_mask = 1 << 11
        mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
            qa.bitwiseAnd(cirrus_bit_mask).eq(0)
        )
        return image.updateMask(mask).divide(10000)

    @staticmethod
    def _get_sentinel_composite(
        roi: ee.Geometry.Polygon,
        start_date: str,
        end_date: str,
        cloud_pct: int = 20,
    ) -> ee.Image:
        """
        Mengambil komposit median citra Sentinel-2 L2A bebas awan pada ROI.
        """
        s2 = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(roi)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_pct))
            .map(GeeAnalysisService._mask_s2_clouds)
        )

        composite = ee.Algorithms.If(
            s2.size().gt(0),
            s2.median().clip(roi),
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(roi)
            .filterDate(start_date, end_date)
            .median()
            .divide(10000)
            .clip(roi)
        )
        return ee.Image(composite)

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

        # 3. KATEGORI BIOMASSA & KARBON
        elif a_type == "agb":
            ndvi_img = composite.normalizedDifference(["B8", "B4"])
            # Model empiris regresi kanopi mangrove tropis (Ton/Ha)
            img = composite.expression(
                "max(0, 115 * exp(1.65 * NDVI) - 60)",
                {"NDVI": ndvi_img}
            ).rename("agb")
            return img, "agb"

        elif a_type == "carbon":
            ndvi_img = composite.normalizedDifference(["B8", "B4"])
            agb_img = composite.expression(
                "max(0, 115 * exp(1.65 * NDVI) - 60)",
                {"NDVI": ndvi_img}
            )
            # Faktor konversi karbon IPCC 0.47
            img = agb_img.multiply(0.47).rename("carbon")
            return img, "carbon"

        elif a_type == "canopy_density":
            ndvi_img = composite.normalizedDifference(["B8", "B4"])
            # 1: Jarang (<0.4), 2: Sedang (0.4 - 0.6), 3: Lebat (>0.6)
            img = (
                ee.Image(1)
                .where(ndvi_img.gte(0.4).And(ndvi_img.lt(0.6)), 2)
                .where(ndvi_img.gte(0.6), 3)
                .rename("canopy_density")
            )
            return img, "canopy_density"

        else:
            # Default ke NDVI
            img = composite.normalizedDifference(["B8", "B4"]).rename("ndvi")
            return img, "ndvi"

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
        try:
            # Validasi tanggal default (6 bulan terakhir jika tidak diberikan)
            if not end_date:
                end_date = datetime.now().strftime("%Y-%m-%d")
            if not start_date:
                start_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")

            roi = cls._create_roi(coordinates)
            composite = cls._get_sentinel_composite(roi, start_date, end_date, cloud_percentage)
            
            index_image, band_name = cls.compute_index_image(composite, analysis_type)
            palette_cfg = PALETTES.get(band_name, PALETTES["ndvi"])

            # 1. Visualisasi MapId Tile URL untuk Leaflet
            vis_params = {
                "min": palette_cfg["min"],
                "max": palette_cfg["max"],
                "palette": palette_cfg["colors"],
            }
            map_id_dict = index_image.getMapId(vis_params)
            tile_url = map_id_dict["tile_fetcher"].url_format

            # 2. Komputasi Luas Area (Hektar)
            area_ha = roi.area().divide(10000).getInfo()

            # 3. Komputasi Statistik Reducer pada ROI
            reducer = ee.Reducer.mean().combine(ee.Reducer.minMax(), "", True)
            stats = index_image.reduceRegion(
                reducer=reducer,
                geometry=roi,
                scale=20,
                maxPixels=1e8,
            ).getInfo()

            mean_val = stats.get(f"{band_name}_mean")
            min_val = stats.get(f"{band_name}_min")
            max_val = stats.get(f"{band_name}_max")

            # Fallback jika None
            mean_val = float(mean_val) if mean_val is not None else 0.0
            min_val = float(min_val) if min_val is not None else 0.0
            max_val = float(max_val) if max_val is not None else 0.0

            # Ekstra estimasi biomassa & karbon total
            total_biomass_tons = None
            total_carbon_tons = None
            if band_name == "agb":
                total_biomass_tons = round(mean_val * area_ha, 2)
                total_carbon_tons = round(total_biomass_tons * 0.47, 2)
            elif band_name == "carbon":
                total_carbon_tons = round(mean_val * area_ha, 2)
                total_biomass_tons = round(total_carbon_tons / 0.47, 2)
            elif band_name in ["ndvi", "evi", "savi"]:
                # Estimasi representatif biomassa berbasis rata-rata NDVI
                est_agb = max(0, 115 * 2.71828 ** (1.65 * mean_val) - 60)
                total_biomass_tons = round(est_agb * area_ha, 2)
                total_carbon_tons = round(total_biomass_tons * 0.47, 2)

            return {
                "status": "success",
                "analysis_type": band_name,
                "tile_url": tile_url,
                "date_range": {"start_date": start_date, "end_date": end_date},
                "cloud_percentage": cloud_percentage,
                "statistics": {
                    "min": round(min_val, 4),
                    "max": round(max_val, 4),
                    "mean": round(mean_val, 4),
                    "area_hectares": round(area_ha, 2),
                    "total_biomass_tons": total_biomass_tons,
                    "total_carbon_tons": total_carbon_tons,
                    "unit": palette_cfg["unit"],
                },
                "palette": {
                    "min": palette_cfg["min"],
                    "max": palette_cfg["max"],
                    "colors": palette_cfg["colors"],
                    "labels": palette_cfg["labels"],
                    "style_type": palette_cfg["style_type"],
                },
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
        workspace_id: int,
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
        try:
            if not end_date:
                end_date = datetime.now().strftime("%Y-%m-%d")
            if not start_date:
                start_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")

            roi = cls._create_roi(coordinates)
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

            composite = cls._get_sentinel_composite(roi, start_date, end_date, cloud_percentage)
            index_image, band_name = cls.compute_index_image(composite, analysis_type)
            palette_cfg = PALETTES.get(band_name, PALETTES["ndvi"])

            # 1. Bangun Rules Warna Style SLD
            colors_list = palette_cfg["colors"]
            labels_list = palette_cfg["labels"]
            c_min = palette_cfg["min"]
            c_max = palette_cfg["max"]
            n = len(colors_list)

            color_entries = []
            for i, c_hex in enumerate(colors_list):
                if palette_cfg["style_type"] == "values":
                    q = float(c_min + i)
                else:
                    q = float(c_min + (c_max - c_min) * (i / max(1, n - 1)))
                lbl = labels_list[i] if i < len(labels_list) else f"Val {round(q, 2)}"
                color_entries.append({
                    "color": c_hex,
                    "quantity": round(q, 3),
                    "opacity": 1.0,
                    "label": lbl,
                })

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
                    "workspace_id": workspace_id,
                    "layer_name": layer_name,
                    "description": description or f"GEE {band_name.upper()} Analysis ({start_date} s/d {end_date}) - {area_ha:.2f} Ha (Scale {scale}m)",
                    "download_url": download_url,
                    "style": color_entries,
                }
                publish_result = await AstraGISService.publish_from_url(url_payload)
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
                    "workspace_id": str(workspace_id),
                    "description": description or f"GEE {band_name.upper()} Analysis ({start_date} s/d {end_date}) - {area_ha:.2f} Ha",
                }
                publish_result = await AstraGISService.publish_layer(
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
                        style_result = await AstraGISService.update_layer_style(new_layer_id, style_payload)
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
