import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import AUTH_SESSION_COOKIE_NAME, JWT_ALGORITHM, JWT_SECRET_KEY
from app.models.auth import User
from app.services.auth_service import get_authenticated_user


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    invalid_token = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "AUTH_INVALID_TOKEN"},
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)
    if not token:
        raise invalid_token
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
        if not isinstance(user_id, str) or not isinstance(token_version, int):
            raise invalid_token
    except (jwt.InvalidTokenError, TypeError, ValueError) as error:
        raise invalid_token from error
    return get_authenticated_user(db, user_id, token_version)