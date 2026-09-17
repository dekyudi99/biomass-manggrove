from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import test_endpoint, spatial
import app.config.gee_initialize

import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Biomass Mangrove API", version="1.0.0")

# CORS configuration - dibaca dari .env (CORS_ORIGINS)
default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
env_cors = os.getenv("CORS_ORIGINS")
origins = [orig.strip() for orig in env_cors.split(",") if orig.strip()] if env_cors else default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(test_endpoint.router)
app.include_router(spatial.router, prefix="/api")