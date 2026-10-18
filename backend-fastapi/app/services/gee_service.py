"""
Facade for Google Earth Engine services.
Delegates to modular services:
- VegetationIndexService (vegetation_index)
- DatasetExtractorService (gee_extract)
- GEE client utilities (gee_core)
"""

from typing import Any, Dict, List, Optional
import ee

from app.services.gee_core.gee_client import (
    build_agb_feature_image,
    create_roi,
    get_landsat_composite,
    get_satellite_composite,
    get_sentinel_composite,
    get_sentinel1_composite,
    mask_landsat_sr,
    mask_s2_clouds,
    reduce_collection,
)
from app.services.vegetation_index.vegetation_index_service import VegetationIndexService
from app.services.gee_extract.dataset_extractor_service import DatasetExtractorService


class GeeAnalysisService:
    # GEE Core helpers
    _create_roi = staticmethod(create_roi)
    _mask_s2_clouds = staticmethod(mask_s2_clouds)
    _reduce_collection = staticmethod(reduce_collection)
    _get_sentinel_composite = staticmethod(get_sentinel_composite)
    _mask_landsat_sr = staticmethod(mask_landsat_sr)
    _get_landsat_composite = staticmethod(get_landsat_composite)
    _get_sentinel1_composite = staticmethod(get_sentinel1_composite)
    _build_agb_feature_image = staticmethod(build_agb_feature_image)
    _get_satellite_composite = staticmethod(get_satellite_composite)

    # Vegetation Index calculations
    compute_index_image = staticmethod(VegetationIndexService.compute_index_image)
    _get_agb_job_required_detail = staticmethod(VegetationIndexService._get_agb_job_required_detail)
    analyze_area = classmethod(lambda cls, *args, **kwargs: VegetationIndexService.analyze_area(*args, **kwargs))
    save_to_astragis = classmethod(lambda cls, *args, **kwargs: VegetationIndexService.save_to_astragis(*args, **kwargs))

    # GEE Satellite Dataset Extraction
    extract_satellite_dataset_preview = classmethod(
        lambda cls, *args, **kwargs: DatasetExtractorService.extract_satellite_dataset_preview(*args, **kwargs)
    )
    extract_satellite_dataset_download = classmethod(
        lambda cls, *args, **kwargs: DatasetExtractorService.extract_satellite_dataset_download(*args, **kwargs)
    )
    save_dataset_to_astragis = classmethod(
        lambda cls, *args, **kwargs: DatasetExtractorService.save_dataset_to_astragis(*args, **kwargs)
    )
