"""Add persisted analysis job progress.

Revision ID: 0005_analysis_job_progress
Revises: 0004_analysis_jobs_notifications
Create Date: 2026-10-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_analysis_job_progress"
down_revision = "0004_analysis_jobs_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analysis_jobs",
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("analysis_jobs", "progress")