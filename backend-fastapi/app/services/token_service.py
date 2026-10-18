import sys
from app.services.common.auth import token_service

sys.modules[__name__] = token_service
