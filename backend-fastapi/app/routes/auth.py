import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import (
    AUTH_COOKIE_SAMESITE,
    AUTH_COOKIE_SECURE,
    AUTH_CSRF_COOKIE_NAME,
    AUTH_SESSION_COOKIE_NAME,
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.dependencies.auth import get_current_user
from app.dependencies.csrf import csrf_signature as _csrf_signature
from app.dependencies.csrf import csrf_token_is_valid as _csrf_token_is_valid
from app.dependencies.csrf import require_csrf
from app.models.auth import User
from app.schemas.auth import (
    ChangePasswordRequest,
    EmailRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RequestPasswordResetOTP,
    ResetPasswordRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.common.auth import AuthService, create_access_token
from app.services.common.email import EmailConfigurationError, send_verification_email


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])
SESSION_COOKIE_PATH = "/api"
CSRF_COOKIE_PATH = "/api"
CSRF_TOKEN_LIFETIME = timedelta(hours=12)


def _expire_legacy_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_SESSION_COOKIE_NAME,
        path="/api/auth",
        secure=AUTH_COOKIE_SECURE,
        httponly=True,
        samesite=AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=AUTH_CSRF_COOKIE_NAME,
        path="/api/auth",
        secure=AUTH_COOKIE_SECURE,
        httponly=False,
        samesite=AUTH_COOKIE_SAMESITE,
    )


def _set_session_cookie(response: Response, session_token: str) -> None:
    _expire_legacy_auth_cookies(response)
    response.set_cookie(
        key=AUTH_SESSION_COOKIE_NAME,
        value=session_token,
        max_age=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        path=SESSION_COOKIE_PATH,
    )


def _clear_session_cookie(response: Response) -> None:
    # Expire cookies set by the previous narrower path during the path rollout.
    _expire_legacy_auth_cookies(response)
    response.delete_cookie(
        key=AUTH_SESSION_COOKIE_NAME,
        path=SESSION_COOKIE_PATH,
        secure=AUTH_COOKIE_SECURE,
        httponly=True,
        samesite=AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=AUTH_CSRF_COOKIE_NAME,
        path=CSRF_COOKIE_PATH,
        secure=AUTH_COOKIE_SECURE,
        httponly=False,
        samesite=AUTH_COOKIE_SAMESITE,
    )


def _send_otp(email: str, code: str, purpose: str = "email_verification") -> None:
    try:
        send_verification_email(email, code, purpose=purpose)
    except EmailConfigurationError as error:
        logger.error("Email verification requested while SMTP is not configured.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AUTH_EMAIL_UNAVAILABLE"},
        ) from error


def _send_password_reset_otp(email: str, code: str) -> None:
    try:
        _send_otp(email, code, purpose="password_reset")
    except Exception:
        logger.exception("Could not send password reset email.")


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_csrf),
):
    service = AuthService(db)
    user, code = service.register(payload)
    try:
        _send_otp(user.email, code)
    except HTTPException:
        service.discard_verification_otp(user.id)
        raise
    return {"success": True, "code": "AUTH_VERIFICATION_SENT", "email": user.email}


@router.post("/verify-email")
def verify_email(
    payload: VerifyEmailRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_csrf),
):
    AuthService(db).verify_email(payload)
    return {"success": True, "code": "AUTH_EMAIL_VERIFIED"}


@router.post("/resend-verification")
def resend_verification(
    payload: EmailRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_csrf),
):
    service = AuthService(db)
    user, code = service.resend_verification(str(payload.email))
    if user and code:
        try:
            _send_otp(user.email, code)
        except HTTPException:
            service.discard_verification_otp(user.id)
            raise
    return {"success": True, "code": "AUTH_VERIFICATION_RESEND_ACCEPTED"}


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(require_csrf),
):
    service = AuthService(db)
    session = service.login(payload)
    if session.get("verification_required"):
        otp = session.get("verification_otp")
        if otp:
            try:
                _send_otp(session["verification_email"], otp)
            except HTTPException:
                service.discard_verification_otp(
                    service.repository.get_user_by_email(session["verification_email"]).id
                )
                raise
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "AUTH_EMAIL_NOT_VERIFIED"},
        )

    session_token, expires_in = create_access_token(session["user"])
    _set_session_cookie(response, session_token)
    return {**session, "expires_in": expires_in}


@router.get("/csrf")
def get_csrf_token(response: Response):
    expires_at = int((datetime.now(timezone.utc) + CSRF_TOKEN_LIFETIME).timestamp())
    nonce = secrets.token_urlsafe(32)
    token = f"{nonce}.{expires_at}.{_csrf_signature(nonce, expires_at)}"
    _expire_legacy_auth_cookies(response)
    response.set_cookie(
        key=AUTH_CSRF_COOKIE_NAME,
        value=token,
        max_age=int(CSRF_TOKEN_LIFETIME.total_seconds()),
        httponly=False,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        path=CSRF_COOKIE_PATH,
    )
    return {"csrf_token": token}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(require_csrf),
):
    AuthService(db).change_password(current_user, payload)
    _clear_session_cookie(response)
    return {"success": True, "code": "AUTH_PASSWORD_CHANGED"}


@router.post("/forgot-password/request-otp")
def request_password_reset_otp(
    payload: RequestPasswordResetOTP,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: None = Depends(require_csrf),
):
    service = AuthService(db)
    user, code = service.request_password_reset_otp(payload)
    if user and code:
        background_tasks.add_task(_send_password_reset_otp, user.email, code)
    return {"success": True, "code": "AUTH_PASSWORD_RESET_OTP_ACCEPTED"}


@router.post("/forgot-password/reset")
def reset_password(
    payload: ResetPasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(require_csrf),
):
    AuthService(db).reset_password(payload)
    _clear_session_cookie(response)
    return {"success": True, "code": "AUTH_PASSWORD_RESET"}


@router.post("/logout")
def logout(response: Response, _: None = Depends(require_csrf)):
    _clear_session_cookie(response)
    return {"success": True, "code": "AUTH_LOGGED_OUT"}