"""Create user_layers table for per-user layer isolation.

Revision ID: 0006_user_layers
Revises: 0005_analysis_job_progress
Create Date: 2026-10-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_user_layers"
down_revision = "0005_analysis_job_progress"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_layers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("layer_id", sa.String(length=120), nullable=False),
        sa.Column("layer_name", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="upload"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "layer_id", name="uq_user_layers_user_layer"),
    )
    op.create_index("ix_user_layers_user_id", "user_layers", ["user_id"])
    op.create_index("ix_user_layers_layer_id", "user_layers", ["layer_id"])

    # Backfill: assign existing layer 'dc9d1a37-c580-490e-8b12-49ab5b821d33' to the first active user if available
    conn = op.get_bind()
    user_res = conn.execute(sa.text("SELECT id FROM users LIMIT 1")).fetchone()
    if user_res:
        first_user_id = user_res[0]
        conn.execute(
            sa.text(
                "INSERT INTO user_layers (id, user_id, layer_id, layer_name, source) "
                "VALUES ('dc9d1a37-c580-490e-8b12-49ab5b821d33', :user_id, 'dc9d1a37-c580-490e-8b12-49ab5b821d33', 'agriculture area poly', 'upload') "
                "ON CONFLICT DO NOTHING"
            ),
            {"user_id": first_user_id},
        )


def downgrade() -> None:
    op.drop_index("ix_user_layers_layer_id", table_name="user_layers")
    op.drop_index("ix_user_layers_user_id", table_name="user_layers")
    op.drop_table("user_layers")
