import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from app.config.settings import JWT_SECRET_KEY


OTP_TTL = timedelta(minutes=10)
OTP_RESEND_COOLDOWN = timedelta(seconds=60)
OTP_MAX_ATTEMPTS = 5


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(user_id: str, otp: str, purpose: str = "email_verification") -> str:
    purpose_prefix = {
        "email_verification": "email-verification",
        "password_reset": "password-reset",
    }.get(purpose, purpose)
    message = f"{purpose_prefix}:{user_id}:{otp}".encode("utf-8")
    return hmac.new(JWT_SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()


def verify_otp_hash(
    user_id: str,
    otp: str,
    expected_hash: str,
    purpose: str = "email_verification",
) -> bool:
    return hmac.compare_digest(hash_otp(user_id, otp, purpose), expected_hash)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)