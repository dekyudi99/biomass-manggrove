"""Add persistent analysis jobs, beta model snapshots, and notifications.

Revision ID: 0004_analysis_jobs_notifications
Revises: 0003_remove_password_change_otps
Create Date: 2026-10-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_analysis_jobs_notifications"
down_revision = "0003_remove_password_change_otps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analysis_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("aoi_geojson", sa.JSON(), nullable=False),
        sa.Column("requested_start_date", sa.String(length=10), nullable=True),
        sa.Column("requested_end_date", sa.String(length=10), nullable=True),
        sa.Column("tile_count", sa.Integer(), nullable=False),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("model_status", sa.String(length=24), nullable=False),
        sa.Column("model_unit", sa.String(length=64), nullable=False),
        sa.Column("disclaimer", sa.Text(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_analysis_jobs"),
    )
    op.create_index("ix_analysis_jobs_user_created", "analysis_jobs", ["user_id", "created_at"])
    op.create_index("ix_analysis_jobs_status_created", "analysis_jobs", ["status", "created_at"])
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["analysis_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_notifications"),
    )
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_user_created", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_analysis_jobs_status_created", table_name="analysis_jobs")
    op.drop_index("ix_analysis_jobs_user_created", table_name="analysis_jobs")
    op.drop_table("analysis_jobs")