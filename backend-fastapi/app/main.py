from fastapi import FastAPI
from app.routes import test_endpoint
import app.config.gee_initialize

app = FastAPI()

app.include_router(test_endpoint.router)