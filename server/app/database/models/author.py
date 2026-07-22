from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database.database import Base


class Author(Base):
    __tablename__ = "authors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    bio = Column(Text, nullable=True)

    # Relationships
    books = relationship("Book", back_populates="author", cascade="all, delete-orphan")
