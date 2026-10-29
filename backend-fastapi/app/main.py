from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routes import test_endpoint, spatial, gee, auth, analysis
from app.dependencies.auth import get_current_user
from app.models.auth import User
from app.schemas.auth import UserResponse
import app.config.gee_initialize

import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Biomass Mangrove API",
    version="1.0.0",
    swagger_ui_init_oauth={
        "clientId": "grovia",
        "usePkceWithAuthorizationCodeGrant": True,
    },
)

# CORS configuration - dibaca dari .env (CORS_ORIGINS)
default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://grovia.wefgis.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(test_endpoint.router)
app.include_router(spatial.router, prefix="/api")
app.include_router(gee.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")


@app.get("/api/me", response_model=UserResponse, tags=["Authentication"])
def get_current_user_profile(request: Request, current_user: User = Depends(get_current_user)):
    roles = getattr(request.state, "roles", [])
    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        is_verified=current_user.is_verified,
        keycloak_sub=current_user.keycloak_sub,
        roles=roles,
    )