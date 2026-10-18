import sys
from app.services.agb_analysis import agb_feature_contract

sys.modules[__name__] = agb_feature_contract
