from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.database.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, default="user")  # 'user' or 'admin'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Reading Goals & Progress
    daily_pages_goal = Column(Integer, default=30)
    monthly_books_goal = Column(Integer, default=2)
    yearly_books_goal = Column(Integer, default=12)
    reading_speed = Column(Float, default=1.5)  # pages/min
    daily_pages_read = Column(Integer, default=0)
    last_page_read_date = Column(String, default="")

    # Relationships
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    reading_lists = relationship("ReadingList", back_populates="user", cascade="all, delete-orphan")
    search_histories = relationship("SearchHistory", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
