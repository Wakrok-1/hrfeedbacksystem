from datetime import datetime
from sqlalchemy import DateTime, func, ARRAY, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)  # AI-generated structured report
    sent_to: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    created_by: Mapped[int | None] = mapped_column(nullable=True)
