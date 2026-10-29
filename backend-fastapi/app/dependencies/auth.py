import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import (
    AUTH_SESSION_COOKIE_NAME,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    LEGACY_AUTH_ENABLED,
)
from app.models.auth import User
from app.services.common.auth import get_authenticated_user
from app.services.common.keycloak_auth import (
    require_role,
    resolve_keycloak_user,
    verify_keycloak_jwt,
)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    # 1. Cek header Authorization: Bearer <token> (Keycloak SSO)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.strip().startswith("Bearer "):
        bearer_token = auth_header.strip()[7:].strip()
        payload = verify_keycloak_jwt(bearer_token)
        user, roles = resolve_keycloak_user(db, payload)
        request.state.roles = roles
        request.state.auth_type = "keycloak"
        request.state.keycloak_sub = payload.get("sub")
        return user

    # 2. Jika tidak ada Bearer token, periksa cookie sesi login lama (bila aktif)
    if LEGACY_AUTH_ENABLED:
        token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)
        if token:
            try:
                payload = jwt.decode(
                    token,
                    JWT_SECRET_KEY,
                    algorithms=[JWT_ALGORITHM],
                    audience="biomass-mangrove-frontend",
                    issuer="biomass-mangrove-api",
                    options={"require": ["sub", "ver", "exp", "iat", "iss", "aud"]},
                )
                user_id = payload.get("sub")
                token_version = payload.get("ver")
                if isinstance(user_id, str) and isinstance(token_version, int):
                    user = get_authenticated_user(db, user_id, token_version)
                    request.state.roles = ["app-grovia", "viewer"]
                    request.state.auth_type = "legacy"
                    return user
            except (jwt.InvalidTokenError, TypeError, ValueError, HTTPException):
                pass

    # 3. Tidak ada token yang valid
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "AUTH_NOT_AUTHENTICATED", "message": "Not authenticated"},
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    try:
        return get_current_user(request, db)
    except HTTPException:
        return None