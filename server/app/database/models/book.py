from sqlalchemy import Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database.database import Base
from app.database.models.association_tables import book_genre_association


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    isbn = Column(String, unique=True, index=True, nullable=True)
    pub_date = Column(String, nullable=True)
    pages = Column(Integer, nullable=True)
    cover_url = Column(String, nullable=True)
    language = Column(String, default="English")
    rating = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)

    # Foreign Keys
    author_id = Column(Integer, ForeignKey("authors.id", ondelete="SET NULL"), nullable=True)
    publisher_id = Column(Integer, ForeignKey("publishers.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    author = relationship("Author", back_populates="books")
    publisher = relationship("Publisher", back_populates="books")
    genres = relationship("Genre", secondary=book_genre_association, back_populates="books")
    reviews = relationship("Review", back_populates="book", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="book", cascade="all, delete-orphan")
    reading_lists = relationship("ReadingList", back_populates="book", cascade="all, delete-orphan")
    embeddings = relationship("Embedding", back_populates="book", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="book", cascade="all, delete-orphan")
