import sys
from app.services.common.email import email_service

sys.modules[__name__] = email_service
