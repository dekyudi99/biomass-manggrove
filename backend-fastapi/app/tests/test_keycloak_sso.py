import time
import unittest
from unittest.mock import MagicMock, patch
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config.database import Base
from app.config.settings import KEYCLOAK_CLIENT_ID, KEYCLOAK_ISSUER
from app.models.auth import User
from app.services.common.keycloak_auth import (
    require_role,
    resolve_keycloak_user,
    verify_keycloak_jwt,
)

# In-memory SQLite for testing
engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(bind=engine)


class TestKeycloakSSO(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

        # Generate RSA keypair for JWT signing tests
        cls.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        cls.public_key = cls.private_key.public_key()
        cls.public_pem = cls.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

    def setUp(self):
        self.db = TestingSessionLocal()
        # Bersihkan tabel users setiap sebelum tes
        self.db.query(User).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _create_token(
        self,
        sub="sub-grovia-123",
        email="test@example.com",
        name="Test User",
        email_verified=True,
        roles=None,
        issuer=None,
        azp=None,
        exp_delta=3600,
    ):
        if roles is None:
            roles = ["user"]
        if issuer is None:
            issuer = KEYCLOAK_ISSUER
        if azp is None:
            azp = KEYCLOAK_CLIENT_ID

        now = int(time.time())
        payload = {
            "sub": sub,
            "email": email,
            "name": name,
            "preferred_username": "testuser",
            "email_verified": email_verified,
            "iss": issuer,
            "azp": azp,
            "exp": now + exp_delta,
            "iat": now,
            "resource_access": {
                KEYCLOAK_CLIENT_ID: {
                    "roles": roles,
                }
            },
        }
        token = jwt.encode(payload, self.private_key, algorithm="RS256", headers={"kid": "key-1"})
        return token, payload

    def _mock_jwks_client(self):
        mock_client = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = self.public_pem
        mock_client.get_signing_key_from_jwt.return_value = mock_signing_key
        return mock_client

    # 1. Token valid dengan role benar -> lolos verifikasi
    def test_token_valid_with_correct_role(self):
        token, _ = self._create_token(roles=["user"])
        with patch("app.services.common.keycloak_auth.get_jwks_client", return_value=self._mock_jwks_client()):
            payload = verify_keycloak_jwt(token)
            self.assertEqual(payload["sub"], "sub-grovia-123")
            self.assertIn("user", payload["_effective_roles"])

    # 2. Token tanpa role -> 403 Forbidden
    def test_token_without_role(self):
        token, _ = self._create_token(roles=[])
        with patch("app.services.common.keycloak_auth.get_jwks_client", return_value=self._mock_jwks_client()):
            with self.assertRaises(HTTPException) as ctx:
                verify_keycloak_jwt(token)
            self.assertEqual(ctx.exception.status_code, 403)

    # 3. Token dengan role client lain -> 403 Forbidden
    def test_token_role_from_other_client(self):
        now = int(time.time())
        payload = {
            "sub": "other_sub",
            "iss": KEYCLOAK_ISSUER,
            "azp": KEYCLOAK_CLIENT_ID,
            "exp": now + 3600,
            "resource_access": {
                "other_client": {"roles": ["admin"]}
            },
        }
        token = jwt.encode(payload, self.private_key, algorithm="RS256")
        with patch("app.services.common.keycloak_auth.get_jwks_client", return_value=self._mock_jwks_client()):
            with self.assertRaises(HTTPException) as ctx:
                verify_keycloak_jwt(token)
            self.assertEqual(ctx.exception.status_code, 403)

    # 4. Token expired -> 401 Unauthorized
    def test_token_expired(self):
        token, _ = self._create_token(exp_delta=-60)
        with patch("app.services.common.keycloak_auth.get_jwks_client", return_value=self._mock_jwks_client()):
            with self.assertRaises(HTTPException) as ctx:
                verify_keycloak_jwt(token)
            self.assertEqual(ctx.exception.status_code, 401)

    # 5. Token invalid issuer -> 401 Unauthorized
    def test_token_invalid_issuer(self):
        token, _ = self._create_token(issuer="http://fake-issuer.com/realms/fake")
        with patch("app.services.common.keycloak_auth.get_jwks_client", return_value=self._mock_jwks_client()):
            with self.assertRaises(HTTPException) as ctx:
                verify_keycloak_jwt(token)
            self.assertEqual(ctx.exception.status_code, 401)

    # 6. Matching user via sub -> mengembalikan user lokal yang ada
    def test_resolve_user_via_sub(self):
        user = User(
            keycloak_sub="sub-matched-001",
            name="Existing Sub User",
            email="subuser@example.com",
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()

        payload = {
            "sub": "sub-matched-001",
            "email": "subuser_updated@example.com",
            "name": "Updated Sub User",
            "_effective_roles": ["user"],
        }
        resolved, roles = resolve_keycloak_user(self.db, payload)
        self.assertEqual(resolved.id, user.id)
        self.assertEqual(resolved.email, "subuser_updated@example.com")
        self.assertEqual(resolved.name, "Updated Sub User")

    # 7. Matching email terverifikasi -> menautkan sub ke akun lokal
    def test_resolve_user_via_email_verified_true(self):
        user = User(
            name="Email User",
            email="local@example.com",
            is_verified=False,
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()

        payload = {
            "sub": "sub-new-002",
            "email": "Local@Example.Com",
            "email_verified": True,
            "name": "Updated Email User",
            "_effective_roles": ["user"],
        }
        resolved, roles = resolve_keycloak_user(self.db, payload)
        self.assertEqual(resolved.id, user.id)
        self.assertEqual(resolved.keycloak_sub, "sub-new-002")
        self.assertTrue(resolved.is_verified)

    # 8. Matching email belum terverifikasi -> ditolak 403 ("Verifikasi email Anda terlebih dahulu.")
    def test_resolve_user_via_email_verified_false(self):
        user = User(
            name="Local Unverified User",
            email="unverified@example.com",
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()

        payload = {
            "sub": "sub-unverified-003",
            "email": "unverified@example.com",
            "email_verified": False,
            "_effective_roles": ["user"],
        }
        with self.assertRaises(HTTPException) as ctx:
            resolve_keycloak_user(self.db, payload)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Verifikasi email Anda terlebih dahulu", str(ctx.exception.detail))

    # 9. Penanganan duplikasi email lokal -> 409 Conflict
    def test_resolve_user_duplicate_email_conflict(self):
        mock_db = MagicMock()
        mock_db.query(User).filter.return_value.first.return_value = None
        mock_u1 = MagicMock(spec=User, id="user-1", email="shared@example.com")
        mock_u2 = MagicMock(spec=User, id="user-2", email="shared@example.com")
        mock_db.query(User).filter.return_value.all.return_value = [mock_u1, mock_u2]

        payload = {
            "sub": "sub-conflict-004",
            "email": "shared@example.com",
            "email_verified": True,
            "_effective_roles": ["user"],
        }
        with self.assertRaises(HTTPException) as ctx:
            resolve_keycloak_user(mock_db, payload)
        self.assertEqual(ctx.exception.status_code, 409)

    # 10. Dependency require_role berjalan sesuai role di token
    def test_require_role_dependency(self):
        checker = require_role("admin")

        mock_req_user = MagicMock()
        mock_req_user.state.roles = ["user"]
        with self.assertRaises(HTTPException) as ctx:
            checker(mock_req_user)
        self.assertEqual(ctx.exception.status_code, 403)

        mock_req_admin = MagicMock()
        mock_req_admin.state.roles = ["admin"]
        self.assertTrue(checker(mock_req_admin))


if __name__ == "__main__":
    unittest.main()
