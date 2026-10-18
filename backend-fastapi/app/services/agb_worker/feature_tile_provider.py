"""Feature-tile sources for the raster worker.

The interface keeps Earth Engine downloads replaceable by a future object-store
provider without coupling job processing to a specific transport.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import ee
import numpy as np
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform

from app.services.agb_analysis.agb_feature_contract import get_feature_contract
from app.services.gee_core.gee_client import build_agb_feature_image
from app.services.agb_analysis.model_registry import (
    get_active_model_config,
    get_aligned_raster_grid,
    get_aoi_limits,
    get_aoi_crs,
)


@dataclass(frozen=True)
class RasterGrid:
    crs: str
    pixel_size: float
    tile_size: int
    origin_x: float
    origin_y: float
    width: int
    height: int
    tiles: tuple["RasterTile", ...]


@dataclass(frozen=True)
class RasterTile:
    x: int
    y: int
    width: int
    height: int

    @property
    def left(self) -> int:
        return self.x

    @property
    def top(self) -> int:
        return self.y


class FeatureTileProvider(Protocol):
    def download(self, tile: RasterTile) -> np.ndarray:
        """Return bands in model-registry order and shape (bands, rows, cols)."""


def build_raster_grid(geojson: dict) -> tuple[RasterGrid, object]:
    geom = shape(geojson)
    crs = get_aoi_crs(geom)
    transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    aoi = transform(transformer.transform, geom)
    aligned_grid = get_aligned_raster_grid(aoi.bounds, crs=crs)
    if crs != aligned_grid["crs"]:
        raise ValueError("AOI grid CRS does not match the model preprocessing CRS.")
    if aligned_grid["tile_count"] > get_aoi_limits()["maximum_tiles"]:
        raise ValueError("AOI grid exceeds the configured maximum tile count.")

    tiles = tuple(
        RasterTile(x, y, int(aligned_grid["tile_size"]), int(aligned_grid["tile_size"]))
        for y in range(0, int(aligned_grid["height"]), int(aligned_grid["tile_size"]))
        for x in range(0, int(aligned_grid["width"]), int(aligned_grid["tile_size"]))
    )
    return (
        RasterGrid(
            crs=crs,
            pixel_size=float(aligned_grid["pixel_size"]),
            tile_size=int(aligned_grid["tile_size"]),
            origin_x=float(aligned_grid["origin_x"]),
            origin_y=float(aligned_grid["origin_y"]),
            width=int(aligned_grid["width"]),
            height=int(aligned_grid["height"]),
            tiles=tiles,
        ),
        aoi,
    )


def is_memory_error(error: Exception) -> bool:
    text = str(error).lower()
    return any(
        marker in text
        for marker in (
            "memory",
            "user memory limit",
            "too many pixels",
            "computed value is too large",
            "payload size exceeds",
            "response size exceeds",
        )
    )


class EarthEngineFeatureTileProvider:
    """Download feature stacks directly from Earth Engine high-volume API."""

    def __init__(self, geojson: dict, grid: RasterGrid):
        self.grid = grid
        self.contract = get_feature_contract()
        geographic_aoi = shape(geojson)
        self.roi = ee.Geometry(mapping(geographic_aoi), "EPSG:4326", False)
        self.image = build_agb_feature_image(self.roi).unmask(
            float(self.contract["nodata"]), False
        )

    def download(self, tile: RasterTile) -> np.ndarray:
        pixel_size = self.grid.pixel_size
        tile_left = self.grid.origin_x + tile.x * pixel_size
        tile_top = self.grid.origin_y - tile.y * pixel_size
        # ComputePixels accepts a CRS-affine grid and avoids the classic endpoint.
        response = ee.data.computePixels(
            {
                "expression": self.image,
                "fileFormat": "NUMPY_NDARRAY",
                "grid": {
                    "dimensions": {"width": tile.width, "height": tile.height},
                    "affineTransform": {
                        "scaleX": pixel_size,
                        "shearX": 0,
                        "translateX": tile_left,
                        "shearY": 0,
                        "scaleY": -pixel_size,
                        "translateY": tile_top,
                    },
                    "crsCode": self.grid.crs,
                },
                "bandIds": list(self.contract["features"]),
            }
        )
        if isinstance(response, np.ndarray) and response.dtype.fields:
            bands = [
                np.asarray(response[name], dtype=np.float32)
                for name in self.contract["features"]
            ]
            result = np.stack(bands)
        else:
            result = np.asarray(response, dtype=np.float32)
            if result.shape == (tile.height, tile.width, len(self.contract["features"])):
                result = np.moveaxis(result, -1, 0)
        expected_shape = (len(self.contract["features"]), tile.height, tile.width)
        if result.shape != expected_shape:
            raise ValueError(
                f"Earth Engine returned tile shape {result.shape}; expected {expected_shape}."
            )
        return result


def split_tile(tile: RasterTile) -> tuple[RasterTile, ...]:
    if tile.width <= 1 and tile.height <= 1:
        return ()
    first_width = max(1, tile.width // 2)
    first_height = max(1, tile.height // 2)
    x_parts = ((0, first_width), (first_width, tile.width - first_width))
    y_parts = ((0, first_height), (first_height, tile.height - first_height))
    return tuple(
        RasterTile(tile.x + dx, tile.y + dy, width, height)
        for dy, height in y_parts
        for dx, width in x_parts
        if width > 0 and height > 0
    )