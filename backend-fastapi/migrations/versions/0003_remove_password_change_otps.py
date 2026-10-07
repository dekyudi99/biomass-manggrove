"""Remove OTP records from the former authenticated password-change flow.

Revision ID: 0003_remove_password_change_otps
Revises: 0002_auth_otp_purposes
Create Date: 2026-10-06
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_remove_password_change_otps"
down_revision = "0002_auth_otp_purposes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(
        sa.text("DELETE FROM email_verification_otps WHERE purpose = :purpose"),
        {"purpose": "password_change"},
    )


def downgrade() -> None:
    pass