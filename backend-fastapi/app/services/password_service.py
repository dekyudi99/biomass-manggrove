import sys
from app.services.common.auth import password_service

sys.modules[__name__] = password_service
