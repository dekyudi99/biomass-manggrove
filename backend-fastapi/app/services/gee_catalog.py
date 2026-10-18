import sys
from app.services.gee_core import gee_catalog

sys.modules[__name__] = gee_catalog
