from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.auth import EmailVerificationOTP, User
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    RequestPasswordResetOTP,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from .otp_service import (
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN,
    OTP_TTL,
    generate_otp,
    hash_otp,
    utc_now,
    verify_otp_hash,
)
from .password_service import hash_password, verify_password


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = AuthRepository(db)

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().casefold()

    def register(self, request: RegisterRequest) -> tuple[User, str]:
        email = self.normalize_email(str(request.email))
        user = self.repository.get_user_by_email(email, for_update=True)
        if user:
            code = "AUTH_EMAIL_EXISTS" if user.is_verified else "AUTH_EMAIL_PENDING"
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": code})

        now = utc_now()
        code = generate_otp()
        user = User(name=request.name, email=email, password_hash=hash_password(request.password))
        self.repository.add_user(user)
        self.repository.add_otp(
            EmailVerificationOTP(
                user_id=user.id,
                purpose="email_verification",
                code_hash=hash_otp(user.id, code),
                expires_at=now + OTP_TTL,
                sent_at=now,
            )
        )

        try:
            self.db.commit()
        except IntegrityError as error:
            self.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": "AUTH_EMAIL_EXISTS"}) from error
        self.db.refresh(user)
        return user, code

    def discard_verification_otp(self, user_id: str) -> None:
        otp = self.repository.get_otp(user_id, "email_verification")
        if otp:
            self.db.delete(otp)
            self.db.commit()

    def discard_password_reset_otp(self, user_id: str) -> None:
        otp = self.repository.get_otp(user_id, "password_reset")
        if otp:
            self.db.delete(otp)
            self.db.commit()

    def resend_verification(self, email: str) -> tuple[User | None, str | None]:
        user = self.repository.get_user_by_email(self.normalize_email(email), for_update=True)
        if not user or user.is_verified or not user.is_active:
            self.db.rollback()
            return None, None

        now = utc_now()
        otp = self.repository.get_otp(user.id, "email_verification", for_update=True)
        if otp:
            sent_at = otp.sent_at
            if sent_at.tzinfo is None:
                sent_at = sent_at.replace(tzinfo=now.tzinfo)
            expires_at = otp.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=now.tzinfo)
            elapsed = now - sent_at
            if expires_at > now and elapsed < OTP_RESEND_COOLDOWN:
                retry_after = max(1, int((OTP_RESEND_COOLDOWN - elapsed).total_seconds()))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={"code": "AUTH_OTP_RESEND_COOLDOWN"},
                    headers={"Retry-After": str(retry_after)},
                )

        code = generate_otp()
        if otp is None:
            otp = EmailVerificationOTP(
                user_id=user.id,
                purpose="email_verification",
                code_hash=hash_otp(user.id, code, "email_verification"),
                expires_at=now + OTP_TTL,
                sent_at=now,
            )
            self.repository.add_otp(otp)
        else:
            otp.code_hash = hash_otp(user.id, code, "email_verification")
            otp.expires_at = now + OTP_TTL
            otp.sent_at = now
            otp.attempts = 0
            otp.used_at = None
        self.db.commit()
        return user, code

    def verify_email(self, request: VerifyEmailRequest) -> None:
        user = self.repository.get_user_by_email(self.normalize_email(str(request.email)), for_update=True)
        if not user or user.is_verified or not user.is_active:
            self.db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "AUTH_INVALID_OTP"})

        otp = self.repository.get_otp(user.id, "email_verification", for_update=True)
        now = utc_now()
        if not otp:
            self.db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "AUTH_INVALID_OTP"})

        expires_at = otp.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=now.tzinfo)
        if otp.used_at is not None or expires_at <= now or otp.attempts >= OTP_MAX_ATTEMPTS:
            self.db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "AUTH_INVALID_OTP"})

        if not verify_otp_hash(user.id, request.otp, otp.code_hash, "email_verification"):
            otp.attempts += 1
            self.db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "AUTH_INVALID_OTP"})

        user.is_verified = True
        otp.used_at = now
        otp.code_hash = "0" * 64
        self.db.commit()

    def login(self, request: LoginRequest) -> dict:
        user = self.repository.get_user_by_email(self.normalize_email(str(request.email)))
        if not user or not verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "AUTH_INVALID_CREDENTIALS"})
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "AUTH_ACCOUNT_DISABLED"})
        if not user.is_verified:
            try:
                pending_user, otp = self.resend_verification(user.email)
            except HTTPException as error:
                if error.status_code != status.HTTP_429_TOO_MANY_REQUESTS:
                    raise
                pending_user, otp = user, None

            return {
                "verification_required": True,
                "verification_email": pending_user.email,
                "verification_otp": otp,
            }
        return {"user": user}

    def change_password(self, user: User, request: ChangePasswordRequest) -> None:
        locked_user = self.repository.get_user_by_email(user.email, for_update=True)
        if (
            not locked_user
            or locked_user.id != user.id
            or not locked_user.is_active
            or not locked_user.is_verified
        ):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "AUTH_INVALID_TOKEN"})
        if not verify_password(request.current_password, locked_user.password_hash):
            self.db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "AUTH_CURRENT_PASSWORD_INVALID"})
        locked_user.password_hash = hash_password(request.new_password)
        locked_user.token_version += 1
        self.db.commit()

    def request_password_reset_otp(
        self, request: RequestPasswordResetOTP
    ) -> tuple[User | None, str | None]:
        email = self.normalize_email(str(request.email))
        user = self.repository.get_user_by_email(email, for_update=True)
        if not user or not user.is_active or not user.is_verified:
            self.db.rollback()
            return None, None

        now = utc_now()
        otp = self.repository.get_otp(user.id, "password_reset", for_update=True)
        if otp:
            sent_at = otp.sent_at
            expires_at = otp.expires_at
            if sent_at.tzinfo is None:
                sent_at = sent_at.replace(tzinfo=now.tzinfo)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=now.tzinfo)
            elapsed = now - sent_at
            if expires_at > now and otp.used_at is None and elapsed < OTP_RESEND_COOLDOWN:
                self.db.rollback()
                return user, None

        code = generate_otp()
        if otp is None:
            otp = EmailVerificationOTP(
                user_id=user.id,
                purpose="password_reset",
                code_hash=hash_otp(user.id, code, "password_reset"),
                expires_at=now + OTP_TTL,
                sent_at=now,
            )
            self.repository.add_otp(otp)
        else:
            otp.code_hash = hash_otp(user.id, code, "password_reset")
            otp.expires_at = now + OTP_TTL
            otp.sent_at = now
            otp.attempts = 0
            otp.used_at = None
        self.db.commit()
        return user, code

    def reset_password(self, request: ResetPasswordRequest) -> None:
        email = self.normalize_email(str(request.email))
        user = self.repository.get_user_by_email(email, for_update=True)
        if not user or not user.is_active or not user.is_verified:
            self.db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "AUTH_INVALID_OTP"})

        otp = self.repository.get_otp(user.id, "password_reset", for_update=True)
        now = utc_now()
        if not otp:
            self.db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "AUTH_INVALID_OTP"})
        expires_at = otp.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=now.tzinfo)
        if otp.used_at is not None or expires_at <= now or otp.attempts >= OTP_MAX_ATTEMPTS:
            self.db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "AUTH_INVALID_OTP"})
        if not verify_otp_hash(user.id, request.otp, otp.code_hash, "password_reset"):
            otp.attempts += 1
            self.db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "AUTH_INVALID_OTP"})

        user.password_hash = hash_password(request.new_password)
        user.token_version += 1
        otp.used_at = now
        otp.code_hash = "0" * 64
        self.db.commit()


def get_authenticated_user(db: Session, user_id: str, token_version: int) -> User:
    user = AuthRepository(db).get_user_by_id(user_id)
    if (
        not user
        or not user.is_active
        or not user.is_verified
        or user.token_version != token_version
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_INVALID_TOKEN"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user