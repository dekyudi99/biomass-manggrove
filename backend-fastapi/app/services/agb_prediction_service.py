import sys
from app.services.agb_analysis import agb_prediction_service

sys.modules[__name__] = agb_prediction_service
