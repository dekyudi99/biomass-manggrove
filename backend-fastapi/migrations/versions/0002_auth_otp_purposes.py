"""Support separate email verification and password change OTPs.

Revision ID: 0002_auth_otp_purposes
Revises: 0001_auth_users_and_email_otp
Create Date: 2026-10-06
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_auth_otp_purposes"
down_revision = "0001_auth_users_and_email_otp"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "email_verification_otps",
        sa.Column("purpose", sa.String(length=32), nullable=False, server_default="email_verification"),
    )
    op.alter_column("email_verification_otps", "purpose", server_default=None)
    op.drop_constraint(
        "uq_email_verification_otps_user_id",
        "email_verification_otps",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_email_verification_otps_user_purpose",
        "email_verification_otps",
        ["user_id", "purpose"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_email_verification_otps_user_purpose",
        "email_verification_otps",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_email_verification_otps_user_id",
        "email_verification_otps",
        ["user_id"],
    )
    op.drop_column("email_verification_otps", "purpose")