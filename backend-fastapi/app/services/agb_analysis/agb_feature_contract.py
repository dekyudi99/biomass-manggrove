"""Canonical feature contract shared by AGB inference and its GEE pipeline."""

import csv
from functools import lru_cache
from typing import Mapping

import numpy as np

from .model_registry import get_active_model_config


TRAINING_DATA_FILENAME = "final_ml_ready.csv"


def get_feature_contract() -> dict:
    config = get_active_model_config()
    preprocessing = config.preprocessing
    validity = preprocessing["validity"]
    return {
        "model_version": config.version,
        "features": config.features,
        "sentinel2_collection": preprocessing["sentinel2_collection"],
        "sentinel2_cloud_mask": preprocessing["sentinel2_cloud_mask"],
        "sentinel2_composite": preprocessing["sentinel2_composite"],
        "ndvi_bands": preprocessing["ndvi_bands"],
        "sentinel2_max_cloud_percentage_exclusive": preprocessing[
            "sentinel2_max_cloud_percentage_exclusive"
        ],
        "sentinel1_collection": preprocessing["sentinel1_collection"],
        "sentinel1_composite": preprocessing["sentinel1_composite"],
        "sentinel1_instrument_mode": preprocessing["sentinel1_instrument_mode"],
        "sentinel1_polarizations": preprocessing["sentinel1_polarizations"],
        "training_start_date": preprocessing["training_start_date_inclusive"],
        "training_end_date_exclusive": preprocessing["training_end_date_exclusive"],
        "crs": preprocessing["crs"],
        "pixel_size_meters": preprocessing["pixel_size_meters"],
        "minimum_ndvi": validity["minimum_ndvi_inclusive"],
        "minimum_vh_db": validity["minimum_vh_db_inclusive"],
        "finite_features": validity["finite_features"],
        "negative_prediction_floor": preprocessing["negative_prediction_floor"],
        "nodata": preprocessing["nodata"],
        "target_unit": config.target["unit"],
    }


def get_training_data_path():
    return get_active_model_config().model_path.parent / TRAINING_DATA_FILENAME


def valid_feature_mask(vv: np.ndarray, vh: np.ndarray, ndvi: np.ndarray) -> np.ndarray:
    """Return the agreed per-pixel validity mask, preserving the input shape."""
    preprocessing = get_active_model_config().preprocessing
    validity = preprocessing["validity"]
    vv_values, vh_values, ndvi_values = np.broadcast_arrays(
        np.asarray(vv, dtype=np.float64),
        np.asarray(vh, dtype=np.float64),
        np.asarray(ndvi, dtype=np.float64),
    )
    return (
        (
            np.isfinite(vv_values)
            & np.isfinite(vh_values)
            & np.isfinite(ndvi_values)
            if validity["finite_features"]
            else np.ones(vv_values.shape, dtype=bool)
        )
        & (ndvi_values >= validity["minimum_ndvi_inclusive"])
        & (vh_values >= validity["minimum_vh_db_inclusive"])
    )


@lru_cache(maxsize=1)
def get_training_feature_ranges() -> Mapping[str, tuple[float, float]]:
    """Read feature min/max from the training data rather than duplicating them."""
    model = get_active_model_config()
    return _read_training_feature_ranges(
        model.version,
        model.features,
        str(get_training_data_path()),
    )


@lru_cache(maxsize=8)
def _read_training_feature_ranges(
    model_version: str,
    feature_names: tuple[str, ...],
    training_data_filename: str,
) -> Mapping[str, tuple[float, float]]:
    """Cache ranges by model version/path so a registry switch cannot reuse stale ranges."""
    del model_version
    ranges: dict[str, tuple[float, float]] = {}
    with open(training_data_filename, "r", encoding="utf-8-sig", newline="") as training_file:
        reader = csv.DictReader(training_file)
        missing_features = set(feature_names).difference(reader.fieldnames or ())
        if missing_features:
            raise ValueError(
                f"Kolom fitur training tidak lengkap: {', '.join(sorted(missing_features))}"
            )

        values = {feature: [] for feature in feature_names}
        for row in reader:
            for feature in feature_names:
                try:
                    value = float(row[feature])
                except (TypeError, ValueError):
                    continue
                if np.isfinite(value):
                    values[feature].append(value)

    for feature, feature_values in values.items():
        if not feature_values:
            raise ValueError(f"Tidak ada nilai fitur training valid untuk {feature}.")
        ranges[feature] = (min(feature_values), max(feature_values))

    return ranges