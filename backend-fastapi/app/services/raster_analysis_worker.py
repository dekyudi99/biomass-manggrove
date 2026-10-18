import sys
from app.services.agb_worker import raster_analysis_worker

sys.modules[__name__] = raster_analysis_worker
