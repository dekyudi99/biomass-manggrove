import sys
from app.services.common.auth import otp_service

sys.modules[__name__] = otp_service
