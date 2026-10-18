import sys
from app.services.common.geoserver import geoserver_service

sys.modules[__name__] = geoserver_service
