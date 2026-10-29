import logging
import secrets
import jwt
from jwt import PyJWKClient, PyJWTError
from fastapi import HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config.settings import (
    KEYCLOAK_CLIENT_ID,
    KEYCLOAK_ISSUER,
    KEYCLOAK_JWKS_URL,
    KEYCLOAK_VALID_ROLES,
)
from app.models.auth import User

logger = logging.getLogger(__name__)

# Cache public keys to minimize network roundtrips to Keycloak
_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(KEYCLOAK_JWKS_URL, cache_keys=True, max_cached_keys=16)
    return _jwks_client


def verify_keycloak_jwt(token: str) -> dict:
    """
    Validates a Keycloak Access Token:
    1. Signature verification (RS256 via PyJWKClient JWKS)
    2. Expiration (exp), nbf
    3. Issuer (iss == KEYCLOAK_ISSUER)
    4. Authorized Party / Client ID check (azp or aud)
    5. Role check: resource_access[KEYCLOAK_CLIENT_ID].roles must contain a valid role
    """
    unauthorized_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "AUTH_INVALID_TOKEN", "message": "Invalid or expired token"},
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=KEYCLOAK_ISSUER,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": False,  # Client ID is verified via azp or resource_access
            },
        )
    except jwt.ExpiredSignatureError as e:
        logger.warning(f"Keycloak token expired: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_TOKEN_EXPIRED", "message": "Token has expired"},
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except (PyJWTError, Exception) as e:
        logger.warning(f"Keycloak JWT validation failed: {e}")
        raise unauthorized_exc from e

    # Verify azp (Authorized Party) or aud if present
    azp = payload.get("azp")
    aud = payload.get("aud")
    is_valid_client = (azp == KEYCLOAK_CLIENT_ID) or (
        isinstance(aud, list) and KEYCLOAK_CLIENT_ID in aud
    ) or (aud == KEYCLOAK_CLIENT_ID)

    if not is_valid_client and azp:
        logger.warning(f"Invalid azp '{azp}', expected '{KEYCLOAK_CLIENT_ID}'")
        raise unauthorized_exc

    # Extract roles: resource_access[<client_id>].roles (Fase 1)
    resource_access = payload.get("resource_access", {})
    client_access = resource_access.get(KEYCLOAK_CLIENT_ID, {}) if isinstance(resource_access, dict) else {}
    client_roles = client_access.get("roles", []) if isinstance(client_access, dict) else []

    # Also capture realm roles for backward compatibility / fallback
    realm_access = payload.get("realm_access", {})
    realm_roles = realm_access.get("roles", []) if isinstance(realm_access, dict) else []
    effective_roles = list(dict.fromkeys(client_roles + [r for r in realm_roles if r in KEYCLOAK_VALID_ROLES]))

    # Validasi role: user harus memiliki salah satu role valid untuk aplikasi ini
    has_valid_role = any(r in KEYCLOAK_VALID_ROLES for r in effective_roles)
    if not has_valid_role:
        logger.warning(
            f"User '{payload.get('preferred_username')}' lacks any valid role for {KEYCLOAK_CLIENT_ID}. "
            f"Client roles: {client_roles}, Expected one of: {KEYCLOAK_VALID_ROLES}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "AUTH_FORBIDDEN_ROLE",
                "message": f"Anda belum memiliki akses ke aplikasi ini. Membutuhkan salah satu role: {KEYCLOAK_VALID_ROLES}",
            },
        )

    # Simpan roles di payload agar mudah diakses
    payload["_effective_roles"] = effective_roles
    return payload


def resolve_keycloak_user(db: Session, payload: dict) -> tuple[User, list[str]]:
    """
    Sinkronisasi token Keycloak ke User lokal:
    1. Cek berdasarkan keycloak_sub. Jika ada, gunakan user tersebut.
    2. Jika belum ada, cari berdasarkan email (case-insensitive).
       - Jika duplicate email (> 1 user), tolak dengan 409 Conflict.
       - Jika 1 user dan email_verified == True: tautkan keycloak_sub.
       - Jika 1 user dan email_verified == False: tolak dengan 403 ("Verifikasi email Anda terlebih dahulu.").
    3. Jika tidak ditemukan sama sekali: auto-provision user baru dengan data token.
    4. Selalu perbarui email dan nama di DB lokal jika ada perbedaan.
    """
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_INVALID_TOKEN", "message": "Missing 'sub' claim"},
        )

    roles = payload.get("_effective_roles", [])
    raw_email = payload.get("email")
    clean_email = raw_email.strip().lower() if raw_email else None
    email_verified = bool(payload.get("email_verified", False))
    token_name = (
        payload.get("name")
        or payload.get("preferred_username")
        or (clean_email.split("@")[0] if clean_email else f"User_{sub[:8]}")
    ).strip()

    # 1. Match by keycloak_sub
    user = db.query(User).filter(User.keycloak_sub == sub).first()
    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "AUTH_USER_INACTIVE", "message": "User account is inactive"},
            )
        # Selalu update email & nama jika berbeda dengan token terbaru
        updated = False
        if clean_email and user.email != clean_email:
            user.email = clean_email
            updated = True
        if token_name and user.name != token_name:
            user.name = token_name
            updated = True
        if updated:
            db.commit()
            db.refresh(user)
        return user, roles

    # 2. Match by email jika belum ada keycloak_sub
    if clean_email:
        matching_users = db.query(User).filter(func.lower(User.email) == clean_email).all()

        if len(matching_users) > 1:
            logger.warning(
                f"Multiple ({len(matching_users)}) users found with email '{clean_email}'. Skipping ambiguous auto-link."
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "AUTH_EMAIL_CONFLICT",
                    "message": "Konflik duplikasi email terdeteksi pada database lokal. Harap hubungi administrator.",
                },
            )

        if len(matching_users) == 1:
            existing_user = matching_users[0]
            if not email_verified:
                logger.warning(
                    f"Account with email '{clean_email}' exists locally, but Keycloak token email_verified is False. Refusing link."
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Verifikasi email Anda terlebih dahulu.",
                )

            # Tautkan keycloak_sub
            existing_user.keycloak_sub = sub
            existing_user.is_verified = True
            if token_name and existing_user.name != token_name:
                existing_user.name = token_name
            db.commit()
            db.refresh(existing_user)
            logger.info(f"Linked existing user '{existing_user.email}' to Keycloak sub '{sub}'")
            return existing_user, roles

    # 3. Auto-provision user baru jika tidak ditemukan
    safe_email = clean_email or f"{sub[:8]}@keycloak.local"
    new_user = User(
        keycloak_sub=sub,
        name=token_name,
        email=safe_email,
        password_hash=f"!keycloak_sso_managed_{secrets.token_hex(16)}",
        is_verified=email_verified,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(f"Auto-provisioned new user '{new_user.email}' from Keycloak sub '{sub}'")
    return new_user, roles


def require_role(required_role: str):
    """
    FastAPI dependency untuk otorisasi berbasis role Keycloak.
    Contoh: Depends(require_role("admin"))
    """
    def _role_checker(request: Request):
        roles = getattr(request.state, "roles", [])
        if required_role not in roles and "admin" not in roles:
            logger.warning(
                f"Access denied: User requires role '{required_role}', but has: {roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "AUTH_FORBIDDEN_ROLE",
                    "message": f"Anda tidak memiliki hak akses yang memadai. Membutuhkan role: '{required_role}'",
                },
            )
        return True

    return _role_checker
