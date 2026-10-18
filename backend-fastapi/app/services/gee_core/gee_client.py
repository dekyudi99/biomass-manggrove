import ee
from typing import List, Optional, Tuple


def create_roi(coordinates: List[List[float]]) -> ee.Geometry.Polygon:
    """
    Mengonversi koordinat Leaflet [lat, lng] menjadi GEE [lng, lat].
    Menyederhanakan geometri secara cerdas jika jumlah titik sangat besar (>1000)
    agar terhindar dari batas kuota verteks Earth Engine (maks 4000 titik).
    """
    if not coordinates or len(coordinates) < 3:
        raise ValueError("Poligon minimal memerlukan 3 titik koordinat.")
    
    # Leaflet [lat, lng] -> GEE [lng, lat]
    ee_coords = [[pt[1], pt[0]] for pt in coordinates]
    
    # Pastikan cincin koordinat tertutup
    if ee_coords[0] != ee_coords[-1]:
        ee_coords.append(ee_coords[0])

    if len(ee_coords) > 1000:
        try:
            from shapely.geometry import Polygon as SPoly
            poly = SPoly(ee_coords)
            bounds = poly.bounds
            span = max(bounds[2] - bounds[0], bounds[3] - bounds[1])
            tol = max(0.0001, span / 2000.0)
            simplified = poly.simplify(tol, preserve_topology=True)
            if simplified.geom_type == 'Polygon' and len(simplified.exterior.coords) >= 3:
                ee_coords = list(simplified.exterior.coords)
                if len(ee_coords) > 2000:
                    step = max(1, len(ee_coords) // 1500)
                    sub = ee_coords[::step]
                    if sub[0] != sub[-1]:
                        sub.append(sub[0])
                    ee_coords = sub
        except Exception as simp_err:
            print(f"Notice: Gagal menyederhanakan geometri besar: {simp_err}")
        
    return ee.Geometry.Polygon([ee_coords])


def mask_s2_clouds(image: ee.Image, cloud_mask: Optional[dict] = None) -> ee.Image:
    """
    Masking awan dan cirrus pada citra Sentinel-2 Surface Reflectance (SR).
    """
    qa_band = cloud_mask["qa_band"] if cloud_mask else "QA60"
    cloud_bit = cloud_mask["cloud_bit"] if cloud_mask else 10
    cirrus_bit = cloud_mask["cirrus_bit"] if cloud_mask else 11
    qa = image.select(qa_band)
    cloud_bit_mask = 1 << cloud_bit
    cirrus_bit_mask = 1 << cirrus_bit
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
        qa.bitwiseAnd(cirrus_bit_mask).eq(0)
    )
    return image.updateMask(mask).divide(10000)


def reduce_collection(collection: ee.ImageCollection, roi: ee.Geometry.Polygon, method: str = "median") -> ee.Image:
    """
    Mereduksi koleksi citra GEE berdasarkan metode komposit (median, mean, min, max, mosaic).
    """
    m = (method or "median").lower().strip()
    if m == "mean":
        img = collection.mean()
    elif m == "min":
        img = collection.min()
    elif m == "max":
        img = collection.max()
    elif m == "mosaic":
        img = collection.mosaic()
    else:
        img = collection.median()
    return img.clip(roi)


def get_sentinel_composite(
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
        .map(mask_s2_clouds)
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


def mask_landsat_sr(image: ee.Image) -> ee.Image:
    """
    Masking awan dan bayangan awan pada citra Landsat 8/9 Level-2 Surface Reflectance (SR)
    serta penskalaan faktor reflektansi dan suhu permukaan (Kelvin).
    """
    qa = image.select("QA_PIXEL")
    dilated_cloud = 1 << 1
    cirrus = 1 << 2
    cloud = 1 << 3
    shadow = 1 << 4
    mask = (
        qa.bitwiseAnd(dilated_cloud).eq(0)
        .And(qa.bitwiseAnd(cirrus).eq(0))
        .And(qa.bitwiseAnd(cloud).eq(0))
        .And(qa.bitwiseAnd(shadow).eq(0))
    )
    optical = image.select("SR_B.*").multiply(0.0000275).add(-0.2)
    thermal = image.select("ST_B10").multiply(0.00341802).add(149.0)
    return optical.addBands(thermal).updateMask(mask)


def get_landsat_composite(
    roi: ee.Geometry.Polygon,
    start_date: str,
    end_date: str,
    cloud_pct: int = 20,
    composite_method: str = "median",
) -> ee.Image:
    """
    Mengambil komposit citra gabungan Landsat 8 & Landsat 9 Level-2 Surface Reflectance.
    """
    l8 = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt("CLOUD_COVER", cloud_pct))
        .map(mask_landsat_sr)
    )
    l9 = (
        ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt("CLOUD_COVER", cloud_pct))
        .map(mask_landsat_sr)
    )
    merged = l8.merge(l9)
    return reduce_collection(merged, roi, composite_method)


def get_sentinel1_composite(
    roi: ee.Geometry.Polygon,
    start_date: str,
    end_date: str,
    orbit_pass: str = "ANY",
    composite_method: str = "median",
) -> ee.Image:
    """
    Mengambil komposit Sentinel-1 C-Band SAR GRD (Interferometric Wide Swath).
    """
    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
    )
    if orbit_pass and orbit_pass.upper() in ["ASCENDING", "DESCENDING"]:
        s1 = s1.filter(ee.Filter.eq("orbitProperties_pass", orbit_pass.upper()))

    return reduce_collection(s1, roi, composite_method)


def build_agb_feature_image(roi: ee.Geometry) -> ee.Image:
    """Build the active model's versioned VV, VH, NDVI feature image."""
    from app.services.agb_analysis.agb_feature_contract import get_feature_contract

    contract = get_feature_contract()
    s2 = (
        ee.ImageCollection(contract["sentinel2_collection"])
        .filterBounds(roi)
        .filterDate(contract["training_start_date"], contract["training_end_date_exclusive"])
        .filter(
            ee.Filter.lt(
                "CLOUDY_PIXEL_PERCENTAGE",
                contract["sentinel2_max_cloud_percentage_exclusive"],
            )
        )
        .map(
            lambda image: mask_s2_clouds(
                image, contract["sentinel2_cloud_mask"]
            )
        )
    )
    ndvi = getattr(s2, contract["sentinel2_composite"])().normalizedDifference(
        contract["ndvi_bands"]
    ).rename("NDVI")

    s1_collection = (
        ee.ImageCollection(contract["sentinel1_collection"])
        .filterBounds(roi)
        .filterDate(contract["training_start_date"], contract["training_end_date_exclusive"])
        .filter(ee.Filter.eq("instrumentMode", contract["sentinel1_instrument_mode"]))
    )
    for polarization in contract["sentinel1_polarizations"]:
        s1_collection = s1_collection.filter(
            ee.Filter.listContains("transmitterReceiverPolarisation", polarization)
        )
    s1 = getattr(
        s1_collection.select(list(contract["features"][:2])),
        contract["sentinel1_composite"],
    )()
    features = (
        s1.addBands(ndvi)
        .select(list(contract["features"]))
        .setDefaultProjection(crs=contract["crs"], scale=contract["pixel_size_meters"])
    )
    valid_mask = ndvi.gte(contract["minimum_ndvi"]).And(
        s1.select("VH").gte(contract["minimum_vh_db"])
    )
    return features.updateMask(valid_mask).clip(roi)


def get_satellite_composite(
    satellite: str,
    roi: ee.Geometry.Polygon,
    start_date: str,
    end_date: str,
    cloud_pct: int = 20,
    composite_method: str = "median",
    orbit_pass: str = "ANY",
) -> Tuple[ee.Image, dict]:
    """
    Mengambil citra komposit dari satelit yang dipilih (Sentinel-2, Landsat 8/9, Sentinel-1 SAR).
    """
    from app.services.gee_core.gee_catalog import SATELLITES_CATALOG

    sat_id = satellite.lower().strip() if satellite else "sentinel2"
    if sat_id not in SATELLITES_CATALOG:
        sat_id = "sentinel2"

    cfg = SATELLITES_CATALOG[sat_id]

    if sat_id == "sentinel2":
        s2 = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(roi)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_pct))
            .map(mask_s2_clouds)
        )
        composite = reduce_collection(s2, roi, composite_method)
    elif sat_id == "landsat89":
        composite = get_landsat_composite(roi, start_date, end_date, cloud_pct, composite_method)
    elif sat_id == "sentinel1":
        composite = get_sentinel1_composite(roi, start_date, end_date, orbit_pass, composite_method)
    else:
        composite = get_sentinel_composite(roi, start_date, end_date, cloud_pct)

    return composite, cfg
