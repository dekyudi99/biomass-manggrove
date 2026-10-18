import sys
from app.services.common.auth import auth_service

sys.modules[__name__] = auth_service
