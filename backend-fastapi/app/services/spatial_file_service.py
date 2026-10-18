import sys
from app.services.common.spatial import spatial_file_service

sys.modules[__name__] = spatial_file_service
