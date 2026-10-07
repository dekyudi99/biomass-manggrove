from fastapi import FastAPI
from fastapi.testclient import TestClient
from datetime import timedelta

from app.config.database import get_db
from app.models.auth import EmailVerificationOTP
from app.routes import auth as auth_routes
from app.services.otp_service import OTP_RESEND_COOLDOWN, utc_now


def create_auth_client(db_session):
    application = FastAPI()
    application.include_router(auth_routes.router, prefix="/api")

    def override_get_db():
        yield db_session

    application.dependency_overrides[get_db] = override_get_db
    return TestClient(application)


def test_auth_cookie_csrf_registration_login_and_password_change(db_session, monkeypatch):
    sent_codes = []
    monkeypatch.setattr(auth_routes, "_send_otp", lambda email, code, **kwargs: sent_codes.append((email, code, kwargs)))
    client = create_auth_client(db_session)

    csrf_response = client.get("/api/auth/csrf")
    csrf_token = csrf_response.json()["csrf_token"]
    assert csrf_response.cookies.get("grovia_csrf") == csrf_token

    without_csrf = client.post(
        "/api/auth/register",
        json={
            "name": "Test Person",
            "email": "person@example.com",
            "password": "MangrovePass123",
            "password_confirmation": "MangrovePass123",
        },
    )
    assert without_csrf.status_code == 403
    assert without_csrf.json()["detail"]["code"] == "AUTH_CSRF_INVALID"

    registration = client.post(
        "/api/auth/register",
        headers={"X-CSRF-Token": csrf_token},
        json={
            "name": "Test Person",
            "email": "person@example.com",
            "password": "MangrovePass123",
            "password_confirmation": "MangrovePass123",
        },
    )
    assert registration.status_code == 201
    assert len(sent_codes) == 1

    verified = client.post(
        "/api/auth/verify-email",
        headers={"X-CSRF-Token": csrf_token},
        json={"email": "person@example.com", "otp": sent_codes[0][1]},
    )
    assert verified.status_code == 200

    login = client.post(
        "/api/auth/login",
        headers={"X-CSRF-Token": csrf_token},
        json={"email": "person@example.com", "password": "MangrovePass123"},
    )
    assert login.status_code == 200
    assert "access_token" not in login.json()
    assert "session_token" not in login.json()
    session_cookie = next(cookie for cookie in login.headers.get_list("set-cookie") if cookie.startswith("grovia_session="))
    assert "httponly" in session_cookie.lower()
    assert "samesite=lax" in session_cookie.lower()

    profile = client.get("/api/auth/me")
    assert profile.status_code == 200
    assert profile.json()["email"] == "person@example.com"

    changed = client.post(
        "/api/auth/change-password",
        headers={"X-CSRF-Token": csrf_token},
        json={
            "current_password": "MangrovePass123",
            "new_password": "DifferentPass456",
            "new_password_confirmation": "DifferentPass456",
        },
    )
    assert changed.status_code == 200
    cleared_cookies = changed.headers.get_list("set-cookie")
    assert any("grovia_session=" in value and "max-age=0" in value.lower() for value in cleared_cookies)
    assert client.get("/api/auth/me").status_code == 401


def test_forgot_password_request_is_generic_and_reset_invalidates_session(db_session, monkeypatch):
    sent_codes = []
    monkeypatch.setattr(
        auth_routes,
        "_send_otp",
        lambda email, code, **kwargs: sent_codes.append((email, code, kwargs)),
    )
    client = create_auth_client(db_session)
    csrf = client.get("/api/auth/csrf").json()["csrf_token"]
    headers = {"X-CSRF-Token": csrf}

    unknown = client.post(
        "/api/auth/forgot-password/request-otp",
        headers=headers,
        json={"email": "missing@example.com"},
    )
    assert unknown.status_code == 200
    assert unknown.json() == {"success": True, "code": "AUTH_PASSWORD_RESET_OTP_ACCEPTED"}
    assert sent_codes == []

    registration = client.post(
        "/api/auth/register",
        headers=headers,
        json={
            "name": "Reset Person",
            "email": "reset@example.com",
            "password": "MangrovePass123",
            "password_confirmation": "MangrovePass123",
        },
    )
    verification_code = sent_codes[-1][1]
    client.post(
        "/api/auth/verify-email",
        headers=headers,
        json={"email": "reset@example.com", "otp": verification_code},
    )
    login = client.post(
        "/api/auth/login",
        headers=headers,
        json={"email": "reset@example.com", "password": "MangrovePass123"},
    )
    assert registration.status_code == 201
    assert login.status_code == 200

    accepted = client.post(
        "/api/auth/forgot-password/request-otp",
        headers=headers,
        json={"email": "reset@example.com"},
    )
    assert accepted.status_code == 200
    reset_code = sent_codes[-1][1]
    assert sent_codes[-1][2] == {"purpose": "password_reset"}

    reset = client.post(
        "/api/auth/forgot-password/reset",
        headers=headers,
        json={
            "email": "reset@example.com",
            "otp": reset_code,
            "new_password": "RecoveredPass456",
            "new_password_confirmation": "RecoveredPass456",
        },
    )
    assert reset.status_code == 200
    assert reset.json()["code"] == "AUTH_PASSWORD_RESET"
    assert client.get("/api/auth/me").status_code == 401


def test_forgot_password_reset_does_not_accept_email_verification_otp(db_session, monkeypatch):
    sent_codes = []
    monkeypatch.setattr(auth_routes, "_send_otp", lambda email, code, **kwargs: sent_codes.append((email, code, kwargs)))
    client = create_auth_client(db_session)
    csrf = client.get("/api/auth/csrf").json()["csrf_token"]
    headers = {"X-CSRF-Token": csrf}
    client.post(
        "/api/auth/register",
        headers=headers,
        json={
            "name": "Reset Person",
            "email": "isolated@example.com",
            "password": "MangrovePass123",
            "password_confirmation": "MangrovePass123",
        },
    )
    verification_code = sent_codes[-1][1]
    client.post(
        "/api/auth/verify-email",
        headers=headers,
        json={"email": "isolated@example.com", "otp": verification_code},
    )

    reset = client.post(
        "/api/auth/forgot-password/reset",
        headers=headers,
        json={
            "email": "isolated@example.com",
            "otp": verification_code,
            "new_password": "RecoveredPass456",
            "new_password_confirmation": "RecoveredPass456",
        },
    )
    assert reset.status_code == 400
    assert reset.json()["detail"]["code"] == "AUTH_INVALID_OTP"


def test_logout_clears_both_auth_cookies(db_session):
    client = create_auth_client(db_session)
    csrf = client.get("/api/auth/csrf").json()["csrf_token"]
    response = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    assert response.status_code == 200
    cleared_cookies = response.headers.get_list("set-cookie")
    assert any("grovia_session=" in value and "max-age=0" in value.lower() for value in cleared_cookies)
    assert any("grovia_csrf=" in value and "max-age=0" in value.lower() for value in cleared_cookies)


def test_login_pending_account_in_cooldown_keeps_existing_otp(db_session, monkeypatch):
    sent_codes = []
    monkeypatch.setattr(auth_routes, "_send_otp", lambda email, code: sent_codes.append((email, code)))
    client = create_auth_client(db_session)
    csrf = client.get("/api/auth/csrf").json()["csrf_token"]
    payload = {
        "name": "Test Person",
        "email": "pending@example.com",
        "password": "MangrovePass123",
        "password_confirmation": "MangrovePass123",
    }

    registration = client.post("/api/auth/register", headers={"X-CSRF-Token": csrf}, json=payload)
    assert registration.status_code == 201
    initial_otp = sent_codes[-1][1]

    login = client.post(
        "/api/auth/login",
        headers={"X-CSRF-Token": csrf},
        json={"email": payload["email"], "password": payload["password"]},
    )

    assert login.status_code == 403
    assert login.json()["detail"]["code"] == "AUTH_EMAIL_NOT_VERIFIED"
    assert len(sent_codes) == 1
    assert sent_codes[-1][1] == initial_otp


def test_login_pending_account_after_cooldown_sends_new_otp(db_session, monkeypatch):
    sent_codes = []
    monkeypatch.setattr(auth_routes, "_send_otp", lambda email, code: sent_codes.append((email, code)))
    client = create_auth_client(db_session)
    csrf = client.get("/api/auth/csrf").json()["csrf_token"]
    payload = {
        "name": "Test Person",
        "email": "resend@example.com",
        "password": "MangrovePass123",
        "password_confirmation": "MangrovePass123",
    }
    client.post("/api/auth/register", headers={"X-CSRF-Token": csrf}, json=payload)
    initial_otp = sent_codes[-1][1]
    otp_record = db_session.query(EmailVerificationOTP).one()
    otp_record.sent_at = utc_now() - OTP_RESEND_COOLDOWN - timedelta(seconds=1)
    db_session.commit()

    login = client.post(
        "/api/auth/login",
        headers={"X-CSRF-Token": csrf},
        json={"email": payload["email"], "password": payload["password"]},
    )

    assert login.status_code == 403
    assert login.json()["detail"]["code"] == "AUTH_EMAIL_NOT_VERIFIED"
    assert len(sent_codes) == 2
    assert sent_codes[-1][1] != initial_otp


def test_login_invalid_credentials_do_not_send_otp(db_session, monkeypatch):
    sent_codes = []
    monkeypatch.setattr(auth_routes, "_send_otp", lambda email, code: sent_codes.append((email, code)))
    client = create_auth_client(db_session)
    csrf = client.get("/api/auth/csrf").json()["csrf_token"]
    payload = {
        "name": "Test Person",
        "email": "wrong-password@example.com",
        "password": "MangrovePass123",
        "password_confirmation": "MangrovePass123",
    }
    client.post("/api/auth/register", headers={"X-CSRF-Token": csrf}, json=payload)
    sent_codes.clear()

    login = client.post(
        "/api/auth/login",
        headers={"X-CSRF-Token": csrf},
        json={"email": payload["email"], "password": "WrongPassword123"},
    )

    assert login.status_code == 401
    assert sent_codes == []


def test_register_password_confirmation_validation_points_to_confirmation_field(db_session):
    client = create_auth_client(db_session)
    csrf = client.get("/api/auth/csrf").json()["csrf_token"]
    response = client.post(
        "/api/auth/register",
        headers={"X-CSRF-Token": csrf},
        json={
            "name": "Test Person",
            "email": "mismatch@example.com",
            "password": "MangrovePass123",
            "password_confirmation": "DifferentPass456",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "password_confirmation"]