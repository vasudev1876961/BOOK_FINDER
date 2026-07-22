from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database.database import Base


class ReadingList(Base):
    __tablename__ = "reading_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, default="want_to_read")  # 'want_to_read', 'reading', 'completed'
    added_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="reading_lists")
    book = relationship("Book", back_populates="reading_lists")

    # Enforce one shelf status per user per book
    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="uq_user_book_reading_list"),
    )
