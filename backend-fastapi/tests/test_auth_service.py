import pytest
from fastapi import HTTPException
from datetime import timedelta

from app.models.auth import EmailVerificationOTP
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, VerifyEmailRequest
from app.schemas.auth import RequestPasswordResetOTP
from app.services.auth_service import AuthService, get_authenticated_user
from app.services.otp_service import OTP_RESEND_COOLDOWN, hash_otp, utc_now
from app.services.password_service import verify_password
from app.services.token_service import create_access_token
from app.routes.auth import _csrf_signature, _csrf_token_is_valid


def registration_request(email="person@example.com"):
    return RegisterRequest(
        name="Test Person",
        email=email,
        password="MangrovePass123",
        password_confirmation="MangrovePass123",
    )


def test_registration_hashes_password_and_stores_only_otp_hash(db_session):
    user, otp = AuthService(db_session).register(registration_request())

    assert user.email == "person@example.com"
    assert not user.is_verified
    assert verify_password("MangrovePass123", user.password_hash)
    assert otp.isdigit() and len(otp) == 6
    stored_otp = db_session.query(EmailVerificationOTP).one()
    assert stored_otp.code_hash == hash_otp(user.id, otp)
    assert otp not in stored_otp.code_hash
    assert stored_otp.attempts == 0


def test_pending_registration_does_not_replace_existing_password_or_otp(db_session):
    service = AuthService(db_session)
    user, original_otp = service.register(registration_request())
    original_hash = user.password_hash

    with pytest.raises(HTTPException) as error:
        service.register(registration_request())

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "AUTH_EMAIL_PENDING"
    db_session.refresh(user)
    assert user.password_hash == original_hash
    assert db_session.query(EmailVerificationOTP).one().code_hash == hash_otp(user.id, original_otp)


def test_email_verification_is_one_time_and_enables_login(db_session):
    service = AuthService(db_session)
    user, otp = service.register(registration_request())
    service.verify_email(VerifyEmailRequest(email=user.email, otp=otp))

    assert user.is_verified
    response = service.login(LoginRequest(email=user.email, password="MangrovePass123"))
    assert response["user"].id == user.id

    with pytest.raises(HTTPException) as error:
        service.verify_email(VerifyEmailRequest(email=user.email, otp=otp))
    assert error.value.detail["code"] == "AUTH_INVALID_OTP"


def test_invalid_otp_increments_attempt_count(db_session):
    service = AuthService(db_session)
    user, otp = service.register(registration_request())
    incorrect_otp = "000000" if otp != "000000" else "000001"

    with pytest.raises(HTTPException):
        service.verify_email(VerifyEmailRequest(email=user.email, otp=incorrect_otp))

    assert db_session.query(EmailVerificationOTP).one().attempts == 1


def test_change_password_invalidates_previous_token(db_session):
    service = AuthService(db_session)
    user, otp = service.register(registration_request())
    service.verify_email(VerifyEmailRequest(email=user.email, otp=otp))
    token, _ = create_access_token(user)

    service.change_password(
        user,
        ChangePasswordRequest(
            current_password="MangrovePass123",
            new_password="DifferentPass456",
            new_password_confirmation="DifferentPass456",
        ),
    )

    assert verify_password("DifferentPass456", user.password_hash)
    assert user.token_version == 1
    with pytest.raises(HTTPException) as error:
        get_authenticated_user(db_session, user.id, 0)
    assert error.value.status_code == 401
    assert token


def test_authenticated_password_change_does_not_require_otp(db_session):
    service = AuthService(db_session)
    user, email_otp = service.register(registration_request())
    service.verify_email(VerifyEmailRequest(email=user.email, otp=email_otp))

    with pytest.raises(HTTPException) as error:
        service.change_password(
            user,
            ChangePasswordRequest(
                current_password="WrongPassword123",
                new_password="DifferentPass456",
                new_password_confirmation="DifferentPass456",
            ),
        )
    assert error.value.detail["code"] == "AUTH_CURRENT_PASSWORD_INVALID"
    assert verify_password("MangrovePass123", user.password_hash)


def test_password_reset_otp_is_generic_hashed_and_one_time(db_session):
    service = AuthService(db_session)
    user, email_otp = service.register(registration_request())
    service.verify_email(VerifyEmailRequest(email=user.email, otp=email_otp))
    token, _ = create_access_token(user)

    reset_user, reset_otp = service.request_password_reset_otp(
        RequestPasswordResetOTP(email=user.email)
    )
    assert reset_user.id == user.id
    reset_record = db_session.query(EmailVerificationOTP).filter_by(purpose="password_reset").one()
    assert reset_record.code_hash == hash_otp(user.id, reset_otp, "password_reset")
    assert reset_otp not in reset_record.code_hash

    service.reset_password(
        ResetPasswordRequest(
            email=user.email,
            otp=reset_otp,
            new_password="RecoveredPass456",
            new_password_confirmation="RecoveredPass456",
        )
    )
    assert verify_password("RecoveredPass456", user.password_hash)
    assert user.token_version == 1
    with pytest.raises(HTTPException):
        get_authenticated_user(db_session, user.id, 0)
    assert token
    with pytest.raises(HTTPException) as reused:
        service.reset_password(
            ResetPasswordRequest(
                email=user.email,
                otp=reset_otp,
                new_password="AnotherPass789",
                new_password_confirmation="AnotherPass789",
            )
        )
    assert reused.value.detail["code"] == "AUTH_INVALID_OTP"


def test_password_reset_does_not_disclose_unknown_email_and_respects_cooldown(db_session):
    service = AuthService(db_session)
    unknown_user, unknown_code = service.request_password_reset_otp(
        RequestPasswordResetOTP(email="missing@example.com")
    )
    assert unknown_user is None and unknown_code is None
    assert db_session.query(EmailVerificationOTP).count() == 0

    user, email_otp = service.register(registration_request())
    service.verify_email(VerifyEmailRequest(email=user.email, otp=email_otp))
    first_user, first_code = service.request_password_reset_otp(
        RequestPasswordResetOTP(email=user.email)
    )
    resend_user, resend_code = service.request_password_reset_otp(
        RequestPasswordResetOTP(email=user.email)
    )
    assert first_user.id == resend_user.id
    assert first_code is not None and resend_code is None
    assert db_session.query(EmailVerificationOTP).filter_by(purpose="password_reset").one().attempts == 0


def test_password_reset_invalid_otp_increments_attempts_and_wrong_purpose_isolated(db_session):
    service = AuthService(db_session)
    user, email_otp = service.register(registration_request())
    service.verify_email(VerifyEmailRequest(email=user.email, otp=email_otp))
    _, reset_otp = service.request_password_reset_otp(RequestPasswordResetOTP(email=user.email))
    wrong_code = "000000" if reset_otp != "000000" else "000001"

    with pytest.raises(HTTPException) as error:
        service.reset_password(
            ResetPasswordRequest(
                email=user.email,
                otp=wrong_code,
                new_password="RecoveredPass456",
                new_password_confirmation="RecoveredPass456",
            )
        )
    assert error.value.detail["code"] == "AUTH_INVALID_OTP"
    reset_record = db_session.query(EmailVerificationOTP).filter_by(purpose="password_reset").one()
    assert reset_record.attempts == 1
    assert db_session.query(EmailVerificationOTP).filter_by(purpose="email_verification").count() == 1


def test_expired_password_reset_otp_is_rejected(db_session):
    service = AuthService(db_session)
    user, email_otp = service.register(registration_request())
    service.verify_email(VerifyEmailRequest(email=user.email, otp=email_otp))
    _, reset_otp = service.request_password_reset_otp(RequestPasswordResetOTP(email=user.email))
    record = db_session.query(EmailVerificationOTP).filter_by(purpose="password_reset").one()
    record.expires_at = utc_now() - timedelta(seconds=1)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        service.reset_password(
            ResetPasswordRequest(
                email=user.email,
                otp=reset_otp,
                new_password="RecoveredPass456",
                new_password_confirmation="RecoveredPass456",
            )
        )
    assert error.value.detail["code"] == "AUTH_INVALID_OTP"
    assert verify_password("MangrovePass123", user.password_hash)


def test_password_reset_otp_cooldown_and_invalid_attempts(db_session):
    service = AuthService(db_session)
    user, email_otp = service.register(registration_request())
    service.verify_email(VerifyEmailRequest(email=user.email, otp=email_otp))
    _, code = service.request_password_reset_otp(RequestPasswordResetOTP(email=user.email))
    resend_user, resend_code = service.request_password_reset_otp(RequestPasswordResetOTP(email=user.email))
    assert resend_user.id == user.id
    assert resend_code is None

    wrong_code = "000000" if code != "000000" else "000001"
    with pytest.raises(HTTPException):
        service.reset_password(
            ResetPasswordRequest(
                email=user.email,
                new_password="DifferentPass456",
                new_password_confirmation="DifferentPass456",
                otp=wrong_code,
            ),
        )
    record = db_session.query(EmailVerificationOTP).filter_by(purpose="password_reset").one()
    assert record.attempts == 1


def test_login_pending_account_in_cooldown_keeps_existing_otp(db_session):
    service = AuthService(db_session)
    user, original_otp = service.register(registration_request())

    result = service.login(LoginRequest(email=user.email, password="MangrovePass123"))

    assert result["verification_required"] is True
    assert result["verification_email"] == user.email
    assert result["verification_otp"] is None
    stored_otp = db_session.query(EmailVerificationOTP).one()
    assert stored_otp.code_hash == hash_otp(user.id, original_otp)


def test_login_pending_account_resends_otp_after_cooldown(db_session):
    service = AuthService(db_session)
    user, original_otp = service.register(registration_request())
    stored_otp = db_session.query(EmailVerificationOTP).one()
    now = utc_now()
    stored_otp.sent_at = now - OTP_RESEND_COOLDOWN - timedelta(seconds=1)
    stored_otp.expires_at = now + timedelta(minutes=5)
    db_session.commit()

    result = service.login(LoginRequest(email=user.email, password="MangrovePass123"))

    assert result["verification_required"] is True
    assert result["verification_otp"] is not None
    assert result["verification_otp"] != original_otp
    db_session.refresh(stored_otp)
    assert stored_otp.code_hash == hash_otp(user.id, result["verification_otp"])


def test_login_pending_account_during_resend_cooldown_keeps_existing_otp(db_session):
    service = AuthService(db_session)
    user, original_otp = service.register(registration_request())

    result = service.login(LoginRequest(email=user.email, password="MangrovePass123"))

    assert result["verification_required"] is True
    assert result["verification_otp"] is None
    assert db_session.query(EmailVerificationOTP).one().code_hash == hash_otp(user.id, original_otp)

    service.verify_email(VerifyEmailRequest(email=user.email, otp=original_otp))
    assert user.is_verified is True


def test_login_pending_account_does_not_resend_when_password_is_invalid(db_session):
    service = AuthService(db_session)
    user, original_otp = service.register(registration_request())

    with pytest.raises(HTTPException) as error:
        service.login(LoginRequest(email=user.email, password="WrongPassword123"))

    assert error.value.status_code == 401
    assert db_session.query(EmailVerificationOTP).one().code_hash == hash_otp(user.id, original_otp)


def test_expired_otp_can_be_resent_without_waiting_for_cooldown(db_session):
    service = AuthService(db_session)
    user, old_otp = service.register(registration_request())
    stored_otp = db_session.query(EmailVerificationOTP).one()
    now = utc_now()
    stored_otp.sent_at = now - timedelta(seconds=5)
    stored_otp.expires_at = now - timedelta(seconds=1)
    db_session.commit()

    resent_user, new_otp = service.resend_verification(user.email)

    assert resent_user.id == user.id
    assert new_otp != old_otp
    db_session.refresh(stored_otp)
    assert stored_otp.code_hash == hash_otp(user.id, new_otp)


def test_password_schema_rejects_confirmation_mismatch():
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as error:
        RegisterRequest(
            name="Test Person",
            email="person@example.com",
            password="MangrovePass123",
            password_confirmation="AnotherPass123",
        )
    assert error.value.errors()[0]["loc"] == ("password_confirmation",)


def test_signed_csrf_token_requires_valid_signature_and_expiry():
    import time

    expires_at = int(time.time()) + 60
    nonce = "test-nonce"
    valid_token = f"{nonce}.{expires_at}.{_csrf_signature(nonce, expires_at)}"

    assert _csrf_token_is_valid(valid_token)
    assert not _csrf_token_is_valid(f"{nonce}.{expires_at}.invalid")
    assert not _csrf_token_is_valid(f"{nonce}.{int(time.time()) - 1}.{_csrf_signature(nonce, int(time.time()) - 1)}")


def test_session_and_csrf_cookies_use_scoped_paths():
    from app.routes.auth import CSRF_COOKIE_PATH, SESSION_COOKIE_PATH

    assert SESSION_COOKIE_PATH == "/api/auth"
    assert CSRF_COOKIE_PATH == "/api/auth"