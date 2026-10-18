import sys
from app.services.agb_analysis import ml_agb_service

sys.modules[__name__] = ml_agb_service
