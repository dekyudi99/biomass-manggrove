from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import EmailVerificationOTP, User


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str, *, for_update: bool = False) -> User | None:
        query = select(User).where(User.email == email)
        if for_update:
            query = query.with_for_update()
        return self.db.scalar(query)

    def get_user_by_id(self, user_id: str, *, for_update: bool = False) -> User | None:
        query = select(User).where(User.id == user_id)
        if for_update:
            query = query.with_for_update()
        return self.db.scalar(query)

    def add_user(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        return user

    def get_otp(
        self,
        user_id: str,
        purpose: str = "email_verification",
        *,
        for_update: bool = False,
    ) -> EmailVerificationOTP | None:
        query = select(EmailVerificationOTP).where(
            EmailVerificationOTP.user_id == user_id,
            EmailVerificationOTP.purpose == purpose,
        )
        if for_update:
            query = query.with_for_update()
        return self.db.scalar(query)

    def add_otp(self, otp: EmailVerificationOTP) -> EmailVerificationOTP:
        self.db.add(otp)
        self.db.flush()
        return otp