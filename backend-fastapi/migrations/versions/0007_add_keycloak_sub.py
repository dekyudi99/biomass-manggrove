"""Add keycloak_sub and make password_hash nullable on users table.

Revision ID: 0007_add_keycloak_sub
Revises: 0006_user_layers
Create Date: 2026-10-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_add_keycloak_sub"
down_revision = "0006_user_layers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("keycloak_sub", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_users_keycloak_sub", "users", ["keycloak_sub"])
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
    op.drop_constraint("uq_users_keycloak_sub", "users", type_="unique")
    op.drop_column("users", "keycloak_sub")
