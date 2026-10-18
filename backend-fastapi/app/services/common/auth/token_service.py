from datetime import datetime, timedelta, timezone

import jwt

from app.config.settings import JWT_ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET_KEY
from app.models.auth import User


def create_access_token(user: User) -> tuple[str, int]:
    expires_in = JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "ver": user.token_version,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
        "iss": "biomass-mangrove-api",
        "aud": "biomass-mangrove-frontend",
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM), expires_in