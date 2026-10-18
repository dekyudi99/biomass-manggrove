import sys
from app.services.agb_analysis import analysis_job_service

sys.modules[__name__] = analysis_job_service
