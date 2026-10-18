import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import HTTPException, Request, status

from app.config.settings import AUTH_CSRF_COOKIE_NAME, JWT_SECRET_KEY


def csrf_signature(nonce: str, expires_at: int) -> str:
    message = f"{nonce}.{expires_at}".encode("ascii")
    return hmac.new(JWT_SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()


def csrf_token_is_valid(token: str) -> bool:
    try:
        nonce, expires_text, signature = token.split(".", 2)
        expires_at = int(expires_text)
    except (ValueError, TypeError):
        return False
    if not nonce or expires_at <= int(datetime.now(timezone.utc).timestamp()):
        return False
    return hmac.compare_digest(signature, csrf_signature(nonce, expires_at))


def require_csrf(request: Request) -> None:
    cookie_token = request.cookies.get(AUTH_CSRF_COOKIE_NAME, "")
    header_token = request.headers.get("X-CSRF-Token", "")
    if (
        not cookie_token
        or not header_token
        or not hmac.compare_digest(cookie_token, header_token)
        or not csrf_token_is_valid(cookie_token)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "AUTH_CSRF_INVALID"})