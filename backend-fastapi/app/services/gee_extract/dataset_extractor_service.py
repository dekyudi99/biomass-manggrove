import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import ee
import httpx
from fastapi import HTTPException

from app.services.common.geoserver import GeoServerService
from app.services.gee_core import (
    create_roi,
    get_satellite_composite,
)


class DatasetExtractorService:
    @classmethod
    async def extract_satellite_dataset_preview(
        cls,
        coordinates: List[List[float]],
        satellite: str = "sentinel2",
        bands: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        cloud_percentage: int = 20,
        composite_method: str = "median",
        orbit_pass: str = "ANY",
    ) -> Dict[str, Any]:
        """
        Menghasilkan URL MapId preview untuk Leaflet dari citra komposit satelit mentah.
        Mendukung visualisasi RGB alami, False Color, atau grayscale single-band.
        """
        try:
            if not end_date:
                end_date = datetime.now().strftime("%Y-%m-%d")
            if not start_date:
                start_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")

            roi = create_roi(coordinates)
            area_ha = roi.area().divide(10000).getInfo()

            composite, cfg = get_satellite_composite(
                satellite=satellite,
                roi=roi,
                start_date=start_date,
                end_date=end_date,
                cloud_pct=cloud_percentage,
                composite_method=composite_method,
                orbit_pass=orbit_pass,
            )

            available_band_ids = [b["id"] for b in cfg["bands"]]
            chosen_bands = [b for b in (bands or []) if b in available_band_ids]
            if not chosen_bands:
                chosen_bands = cfg["default_rgb"]

            # Visualisasi parameters
            vis_bands = []
            vis_min = 0.0
            vis_max = 0.3
            palette = None

            if cfg["type"] == "sar":
                # Sentinel-1 SAR (dB)
                if "VV" in chosen_bands and "VH" in chosen_bands:
                    vis_bands = ["VV", "VH", "VV"]
                    vis_min = -25.0
                    vis_max = 0.0
                elif "VV" in chosen_bands:
                    vis_bands = ["VV"]
                    vis_min = -25.0
                    vis_max = 0.0
                elif "VH" in chosen_bands:
                    vis_bands = ["VH"]
                    vis_min = -30.0
                    vis_max = -5.0
                else:
                    vis_bands = [chosen_bands[0]]
                    vis_min = 0.0
                    vis_max = 50.0
            else:
                # Satelit Optik (Sentinel-2 atau Landsat 8/9)
                default_rgb = cfg["default_rgb"]
                default_fc = cfg["default_false_color"]
                if len(chosen_bands) >= 3:
                    if all(b in chosen_bands for b in default_rgb):
                        vis_bands = default_rgb
                    elif all(b in chosen_bands for b in default_fc):
                        vis_bands = default_fc
                        vis_max = 0.4
                    else:
                        vis_bands = chosen_bands[:3]
                elif len(chosen_bands) == 2:
                    vis_bands = [chosen_bands[0], chosen_bands[1], chosen_bands[0]]
                else:
                    vis_bands = [chosen_bands[0]]
                    palette = ["#000000", "#ffffff"]
                    vis_max = 0.5

            vis_params = {
                "bands": vis_bands,
                "min": vis_min,
                "max": vis_max,
            }
            if palette:
                vis_params["palette"] = palette

            map_id_dict = composite.getMapId(vis_params)
            tile_url = map_id_dict["tile_fetcher"].url_format

            return {
                "status": "success",
                "satellite": cfg["id"],
                "satellite_name": cfg["name"],
                "collection": cfg["collection"],
                "tile_url": tile_url,
                "preview_bands": vis_bands,
                "selected_bands": chosen_bands,
                "date_range": {"start_date": start_date, "end_date": end_date},
                "cloud_percentage": cloud_percentage,
                "composite_method": composite_method,
                "area_hectares": round(area_ha, 2),
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Gagal mempratinjau dataset citra satelit: {str(e)}",
            )

    @classmethod
    async def extract_satellite_dataset_download(
        cls,
        coordinates: List[List[float]],
        satellite: str = "sentinel2",
        bands: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        cloud_percentage: int = 20,
        composite_method: str = "median",
        orbit_pass: str = "ANY",
        custom_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Mengekspor citra multi-band GeoTIFF langsung dari GEE dengan perhitungan scale adaptif,
        dan menyusun dataset manifest JSON berstandar FAIR untuk peneliti.
        """
        try:
            if not end_date:
                end_date = datetime.now().strftime("%Y-%m-%d")
            if not start_date:
                start_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")

            roi = create_roi(coordinates)
            area_ha = roi.area().divide(10000).getInfo()

            composite, cfg = get_satellite_composite(
                satellite=satellite,
                roi=roi,
                start_date=start_date,
                end_date=end_date,
                cloud_pct=cloud_percentage,
                composite_method=composite_method,
                orbit_pass=orbit_pass,
            )

            available_band_ids = [b["id"] for b in cfg["bands"]]
            chosen_bands = [b for b in (bands or []) if b in available_band_ids]
            if not chosen_bands:
                chosen_bands = cfg["default_rgb"]

            selected_image = composite.select(chosen_bands)

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

            # GEE batas kuota ~50MB. Hitung resolusi aman per piksel * band count
            max_safe_pixels = int(6_000_000 / max(1, len(chosen_bands)))
            min_scale_needed = math.sqrt(bbox_area_m2 / max_safe_pixels)

            native_scale = cfg["native_scale"]
            if min_scale_needed <= native_scale and area_ha <= 2500:
                initial_scale = native_scale
            elif min_scale_needed <= 20 and area_ha <= 15000:
                initial_scale = max(native_scale, 20)
            elif min_scale_needed <= 30 and area_ha <= 60000:
                initial_scale = max(native_scale, 30)
            elif min_scale_needed <= 50:
                initial_scale = max(native_scale, 50)
            else:
                initial_scale = max(50, int(math.ceil(min_scale_needed / 10.0) * 10))

            dataset_clean_name = (custom_name or f"{cfg['id'].upper()}_{composite_method}_{start_date.replace('-', '')}_{end_date.replace('-', '')}").replace(" ", "_")

            scales_to_attempt = [initial_scale]
            for candidate in [20, 30, 50, 70, 100, 150, 200]:
                if candidate > initial_scale and candidate not in scales_to_attempt:
                    scales_to_attempt.append(candidate)

            download_url = None
            used_scale = initial_scale
            last_err = None

            for attempt_scale in scales_to_attempt:
                try:
                    download_url = selected_image.getDownloadURL({
                        "name": dataset_clean_name,
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
                raise last_err or HTTPException(status_code=500, detail="Gagal menghasilkan URL GeoTIFF multi-band dari GEE.")

            band_details = [b for b in cfg["bands"] if b["id"] in chosen_bands]

            # 1. Komputasi Statistik Zonasi Spektral GEE (Mean, Min, Max, StdDev per band)
            band_statistics = {}
            try:
                reducer = (
                    ee.Reducer.mean()
                    .combine(ee.Reducer.minMax(), "", True)
                    .combine(ee.Reducer.stdDev(), "", True)
                )
                stats_raw = selected_image.reduceRegion(
                    reducer=reducer,
                    geometry=roi,
                    scale=max(used_scale, 60),
                    maxPixels=1e7,
                ).getInfo()

                for b in chosen_bands:
                    mean_val = stats_raw.get(f"{b}_mean")
                    min_val = stats_raw.get(f"{b}_min")
                    max_val = stats_raw.get(f"{b}_max")
                    std_val = stats_raw.get(f"{b}_stdDev")
                    band_statistics[b] = {
                        "mean": round(float(mean_val), 4) if mean_val is not None else None,
                        "min": round(float(min_val), 4) if min_val is not None else None,
                        "max": round(float(max_val), 4) if max_val is not None else None,
                        "stdDev": round(float(std_val), 4) if std_val is not None else None,
                    }
            except Exception as stat_err:
                print(f"Warning: Gagal menghitung statistik zonasi GEE: {stat_err}")
                band_statistics = {}

            # 2. Ekstraksi Titik Sampel Piksel Spektral Nyata dari Citra GEE
            pixel_samples = []
            try:
                sample_scale = max(used_scale, 60)
                samples_fc = selected_image.sample(
                    region=roi,
                    scale=sample_scale,
                    numPixels=100,
                    geometries=True,
                ).getInfo()

                raw_features = samples_fc.get("features", [])
                for idx, feat in enumerate(raw_features):
                    geom = feat.get("geometry", {})
                    props = feat.get("properties", {})
                    clean_props = {}
                    for b in chosen_bands:
                        val = props.get(b)
                        clean_props[b] = round(float(val), 4) if val is not None else 0.0

                    coords = geom.get("coordinates", [])
                    if len(coords) >= 2:
                        pixel_samples.append({
                            "id": idx + 1,
                            "longitude": round(float(coords[0]), 6),
                            "latitude": round(float(coords[1]), 6),
                            "band_values": clean_props,
                        })
            except Exception as sample_err:
                print(f"Warning: Gagal mengekstrak sampel piksel GEE: {sample_err}")
                pixel_samples = []

            manifest = {
                "dataset_name": dataset_clean_name,
                "satellite_id": cfg["id"],
                "satellite_name": cfg["name"],
                "agency": cfg["agency"],
                "collection": cfg["collection"],
                "sensor_type": cfg["type"],
                "bands": chosen_bands,
                "band_count": len(chosen_bands),
                "band_details": band_details,
                "band_statistics": band_statistics,
                "sample_points_count": len(pixel_samples),
                "date_range": {"start_date": start_date, "end_date": end_date},
                "cloud_percentage_threshold": cloud_percentage,
                "composite_method": composite_method,
                "spatial_resolution_meters": used_scale,
                "crs": "EPSG:4326",
                "area_hectares": round(area_ha, 2),
                "aoi_coordinates_geojson": {
                    "type": "Polygon",
                    "coordinates": [[[pt[1], pt[0]] for pt in coordinates]],
                },
                "created_at": datetime.now().isoformat(),
                "download_url": download_url,
            }

            python_code_snippet = f'''# Membaca Dataset Citra Satelit Multi-Band dengan Rasterio & PyTorch
import rasterio
import numpy as np
import torch

# 1. Buka file GeoTIFF yang telah diunduh
filename = "{dataset_clean_name}.tif"
with rasterio.open(filename) as src:
    # Membaca {len(chosen_bands)} band ({", ".join(chosen_bands)})
    image_data = src.read()  # Shape: (bands={len(chosen_bands)}, height, width)
    profile = src.profile
    print(f"Bands: {{src.count}}, Shape: {{image_data.shape}}, Resolution: {{src.res}}")

# 2. Normalisasi dan konversi ke PyTorch Tensor untuk Training Model
image_data = np.nan_to_num(image_data, nan=0.0)
tensor_x = torch.from_numpy(image_data.astype(np.float32))

print(f"PyTorch Tensor Siap Training: {{tensor_x.shape}} | Tipe Data: {{tensor_x.dtype}}")
'''

            return {
                "status": "success",
                "dataset_name": dataset_clean_name,
                "download_url": download_url,
                "spatial_resolution_meters": used_scale,
                "area_hectares": round(area_ha, 2),
                "bands": chosen_bands,
                "band_statistics": band_statistics,
                "pixel_samples": pixel_samples,
                "manifest": manifest,
                "python_snippet": python_code_snippet,
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Gagal mengekspor dataset citra satelit: {str(e)}",
            )

    @classmethod
    async def save_dataset_to_astragis(
        cls,
        coordinates: List[List[float]],
        satellite: str = "sentinel2",
        bands: Optional[List[str]] = None,
        layer_name: str = "Satellite_Dataset",
        description: Optional[str] = "",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        cloud_percentage: int = 20,
        composite_method: str = "median",
        orbit_pass: str = "ANY",
    ) -> Dict[str, Any]:
        """
        Mengekspor dataset multi-band citra satelit dan mempublikasikannya ke workspace AstraGIS.
        """
        try:
            download_data = await cls.extract_satellite_dataset_download(
                coordinates=coordinates,
                satellite=satellite,
                bands=bands,
                start_date=start_date,
                end_date=end_date,
                cloud_percentage=cloud_percentage,
                composite_method=composite_method,
                orbit_pass=orbit_pass,
                custom_name=layer_name,
            )

            download_url = download_data["download_url"]
            manifest = download_data["manifest"]
            area_ha = download_data["area_hectares"]
            used_scale = download_data["spatial_resolution_meters"]
            chosen_bands = download_data["bands"]

            # Coba publish via /s2s/publish-from-url
            try:
                url_payload = {
                    "layer_name": layer_name,
                    "description": description or f"{manifest['satellite_name']} ({composite_method}) Bands: {', '.join(chosen_bands)} - {area_ha:.2f} Ha (Scale {used_scale}m)",
                    "download_url": download_url,
                }
                publish_result = await GeoServerService.publish_from_url(url_payload)
                new_layer = publish_result.get("layer") or publish_result.get("data") or publish_result
                return {
                    "status": "success",
                    "message": "Dataset citra satelit berhasil disimpan ke AstraGIS!",
                    "layer": new_layer,
                    "manifest": manifest,
                }
            except Exception as url_err:
                print(f"Notice: publish_from_url dialihkan ke direct upload: {url_err}")

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
                    "description": description or f"{manifest['satellite_name']} ({composite_method}) Bands: {', '.join(chosen_bands)} - {area_ha:.2f} Ha",
                }
                publish_result = await GeoServerService.publish_layer(
                    file_bytes=tif_bytes,
                    filename=f"{layer_name.replace(' ', '_')}.tif",
                    content_type="image/tiff",
                    form_data=form_data,
                )
                new_layer = publish_result.get("layer") or publish_result.get("data") or publish_result
                return {
                    "status": "success",
                    "message": "Dataset citra satelit berhasil diunggah dan disimpan ke AstraGIS!",
                    "layer": new_layer,
                    "manifest": manifest,
                }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Gagal menyimpan dataset citra satelit ke AstraGIS: {str(e)}",
            )
