import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.models.auth import User


class UserLayer(Base):
    __tablename__ = "user_layers"
    __table_args__ = (
        Index("ix_user_layers_user_id", "user_id"),
        Index("ix_user_layers_layer_id", "layer_id"),
        UniqueConstraint("user_id", "layer_id", name="uq_user_layers_user_layer"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    layer_id: Mapped[str] = mapped_column(String(120), nullable=False)
    layer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="upload")  # 'upload', 'gee_analysis', 'agb_job'
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user: Mapped[User] = relationship()
