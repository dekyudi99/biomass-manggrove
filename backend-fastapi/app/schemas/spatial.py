from typing import List, Optional

from pydantic import BaseModel


class ExportShapefileRequest(BaseModel):
    points: List[List[float]]
    name: Optional[str] = "Mangrove_AOI"
    area_hectares: Optional[float] = 0.0