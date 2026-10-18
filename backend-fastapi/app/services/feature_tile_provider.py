import sys
from app.services.agb_worker import feature_tile_provider

sys.modules[__name__] = feature_tile_provider
