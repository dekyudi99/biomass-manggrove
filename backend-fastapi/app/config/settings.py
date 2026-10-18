import os

from dotenv import load_dotenv


load_dotenv()


def _required_secret(name: str) -> str:
    value = os.getenv(name, "").strip()
    if len(value) < 32:
        raise RuntimeError(f"{name} must be set to a random value of at least 32 characters.")
    return value


DB_HOST = os.getenv("DB_HOST", "db-central-postgres").strip()
DB_PORT = os.getenv("DB_PORT", "5432").strip()
DB_NAME = os.getenv("DB_NAME", "mangrove").strip()
DB_USER = os.getenv("DB_USER", "mangrove_app").strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "").strip()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    if DB_PASSWORD:
        DATABASE_URL = f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    else:
        raise RuntimeError("DATABASE_URL or DB_PASSWORD must be configured in the backend environment.")
JWT_SECRET_KEY = _required_secret("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256").strip() or "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
if JWT_ACCESS_TOKEN_EXPIRE_MINUTES < 1:
    raise RuntimeError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be at least 1.")
AUTH_SESSION_COOKIE_NAME = os.getenv("AUTH_SESSION_COOKIE_NAME", "grovia_session").strip()
AUTH_CSRF_COOKIE_NAME = os.getenv("AUTH_CSRF_COOKIE_NAME", "grovia_csrf").strip()
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", str(APP_ENV == "production")).lower() == "true"
if APP_ENV == "production" and not AUTH_COOKIE_SECURE:
    raise RuntimeError("AUTH_COOKIE_SECURE must be true in production.")
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower()
if AUTH_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("AUTH_COOKIE_SAMESITE must be lax, strict, or none.")
if AUTH_COOKIE_SAMESITE == "none" and not AUTH_COOKIE_SECURE:
    raise RuntimeError("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE is none.")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip()
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Grovia").strip()
SMTP_REPLY_TO = os.getenv("SMTP_REPLY_TO", "").strip()
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "true" if SMTP_PORT == 465 else "false").strip().lower() == "true"
SMTP_USE_TLS = (
    False
    if SMTP_USE_SSL or SMTP_PORT == 465
    else os.getenv("SMTP_USE_TLS", "true").strip().lower() == "true"
)