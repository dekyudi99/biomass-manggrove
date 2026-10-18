import sys
from app.services.agb_analysis import model_registry

sys.modules[__name__] = model_registry
