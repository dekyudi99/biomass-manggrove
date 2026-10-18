"""Read and validate versioned model metadata from the model registry file."""

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Transformer


REGISTRY_PATH = Path(__file__).resolve().parents[3] / "config" / "model_registry.json"
ALLOWED_MODEL_STATUSES = {"beta", "candidate", "production", "retired"}


@dataclass(frozen=True)
class ModelConfig:
    registry_key: str
    model_path: Path
    mangrove_mask_path: Path
    version: str
    status: str
    features: tuple[str, ...]
    preprocessing: dict[str, Any]
    target: dict[str, Any]
    disclaimer: str
    metrics_display_allowed: bool
    display_range: dict[str, float]
    layer_metadata: dict[str, str]

    @property
    def preprocessing_parameters(self) -> dict[str, Any]:
        parameters = dict(self.preprocessing)
        parameters["model_version"] = self.version
        return parameters


@lru_cache(maxsize=1)
def get_active_model_config() -> ModelConfig:
    with REGISTRY_PATH.open("r", encoding="utf-8") as registry_file:
        registry = json.load(registry_file)

    active_key = registry.get("active_model")
    model_data = registry.get("models", {}).get(active_key)
    if not isinstance(model_data, dict):
        raise ValueError(f"Active model '{active_key}' is missing from {REGISTRY_PATH}.")

    version = model_data.get("version")
    status = model_data.get("status")
    features = model_data.get("features")
    if not isinstance(version, str) or not version.strip():
        raise ValueError("Active model must define a non-empty version.")
    if status not in ALLOWED_MODEL_STATUSES:
        raise ValueError(f"Unsupported model status: {status!r}.")
    if not isinstance(features, list) or not features or any(not isinstance(name, str) for name in features):
        raise ValueError("Active model must define an ordered, non-empty feature list.")

    model_path = (REGISTRY_PATH.parents[1] / model_data["model_path"]).resolve()
    mangrove_mask_path = (REGISTRY_PATH.parents[1] / model_data["mangrove_mask_path"]).resolve()
    return ModelConfig(
        registry_key=active_key,
        model_path=model_path,
        mangrove_mask_path=mangrove_mask_path,
        version=version,
        status=status,
        features=tuple(features),
        preprocessing=model_data.get("preprocessing", {}),
        target=model_data.get("target", {}),
        disclaimer=model_data.get("disclaimer", ""),
        metrics_display_allowed=bool(model_data.get("metrics_display_allowed", False)),
        display_range=model_data.get("display_range", {}),
        layer_metadata=model_data.get("layer_metadata", {}),
    )


def get_agb_layer_metadata(
    job_id: str,
    *,
    model_version: str | None = None,
    model_status: str | None = None,
    model_unit: str | None = None,
    disclaimer: str | None = None,
) -> dict[str, str]:
    model = get_active_model_config()
    template = model.layer_metadata
    version = model_version or model.version
    status = model_status or model.status
    unit = model_unit or model.target["unit"]
    model_disclaimer = disclaimer or model.disclaimer
    return {
        "layer_name": f"agb_{job_id}",
        "title": template["title_template"].format(version=version, status=status),
        "abstract": template["abstract_template"].format(
            disclaimer=model_disclaimer,
            version=version,
            status=status,
            unit=unit,
        ),
    }


@lru_cache(maxsize=1)
def get_aoi_limits() -> dict[str, Any]:
    with REGISTRY_PATH.open("r", encoding="utf-8") as registry_file:
        registry = json.load(registry_file)
        limits = registry.get("aoi_limits", {})
        active_model = registry.get("models", {}).get(registry.get("active_model"), {})
        preprocessing = active_model.get("preprocessing", {})
        pixel_size_meters = preprocessing.get("pixel_size_meters")
        raster_crs = preprocessing.get("crs")
    maximum_tiles = limits.get("maximum_tiles")
    tile_size_pixels = limits.get("tile_size_pixels")
    if not isinstance(maximum_tiles, int) or maximum_tiles < 1:
        raise ValueError("AOI maximum_tiles must be a positive integer.")
    if not isinstance(tile_size_pixels, int) or tile_size_pixels < 1:
        raise ValueError("AOI tile_size_pixels must be a positive integer.")
    if not isinstance(pixel_size_meters, (int, float)) or pixel_size_meters <= 0:
        raise ValueError("Active model pixel_size_meters must be positive.")
    if not isinstance(raster_crs, str) or not raster_crs:
        raise ValueError("Active model crs must be configured.")
    return {
        "maximum_tiles": maximum_tiles,
        "tile_size_pixels": tile_size_pixels,
        "pixel_size_meters": pixel_size_meters,
        "crs": raster_crs,
    }


def get_aoi_crs(geometry) -> str:
    """Determine the optimal UTM CRS for any global longitude/latitude geometry."""
    try:
        center_x = float(geometry.centroid.x)
        center_y = float(geometry.centroid.y)
        # Khusus area default Thailand/Ranong tetap konsisten menggunakan EPSG:32647
        if 96.0 <= center_x <= 102.0 and center_y >= 0:
            return get_aoi_limits()["crs"]
        utm_zone = int((center_x + 180) / 6) + 1
        epsg = 32600 + utm_zone if center_y >= 0 else 32700 + utm_zone
        return f"EPSG:{epsg}"
    except Exception:
        return get_aoi_limits()["crs"]


def get_aligned_raster_grid(
    bounds: tuple[float, float, float, float], crs: str | None = None
) -> dict[str, int | float | str]:
    """Return the tile-aligned raster grid shared by AOI validation and workers."""
    limits = get_aoi_limits()
    min_x, min_y, max_x, max_y = bounds
    tile_pixels = limits["tile_size_pixels"]
    pixel_size = limits["pixel_size_meters"]
    tile_span = pixel_size * tile_pixels
    origin_x = math.floor(min_x / tile_span) * tile_span
    origin_y = math.ceil(max_y / tile_span) * tile_span
    columns = max(1, math.ceil((max_x - origin_x) / tile_span))
    rows = max(1, math.ceil((origin_y - min_y) / tile_span))
    return {
        "origin_x": origin_x,
        "origin_y": origin_y,
        "columns": columns,
        "rows": rows,
        "width": columns * tile_pixels,
        "height": rows * tile_pixels,
        "tile_count": columns * rows,
        "pixel_size": pixel_size,
        "tile_size": tile_pixels,
        "crs": crs or limits["crs"],
    }


def validate_aoi_geojson(geojson: dict[str, Any]) -> tuple[dict[str, Any], int]:
    """Validate polygon GeoJSON and enforce AOI limits using raster tile count."""
    if not isinstance(geojson, dict) or geojson.get("type") not in {"Polygon", "MultiPolygon"}:
        raise ValueError("AOI GeoJSON geometry must be Polygon or MultiPolygon.")
    try:
        geometry = shape(geojson)
    except (TypeError, ValueError) as error:
        raise ValueError("AOI GeoJSON coordinates are malformed.") from error
    if geometry.is_empty or not geometry.is_valid or geometry.area <= 0:
        raise ValueError("AOI GeoJSON geometry must be non-empty, valid, and have positive area.")
    min_x, min_y, max_x, max_y = geometry.bounds
    if min_x < -180 or max_x > 180 or min_y < -90 or max_y > 90:
        raise ValueError("AOI GeoJSON coordinates must use WGS84 longitude/latitude ranges.")
    aoi_limits = get_aoi_limits()
    crs = get_aoi_crs(geometry)
    transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    projected_geometry = transform(transformer.transform, geometry)
    grid = get_aligned_raster_grid(projected_geometry.bounds, crs=crs)
    tile_count = int(grid["tile_count"])
    if tile_count > aoi_limits["maximum_tiles"]:
        raise ValueError(
            f"AOI membutuhkan {tile_count} tile; batas adalah "
            f"{aoi_limits['maximum_tiles']} tile."
        )
    return geojson, tile_count