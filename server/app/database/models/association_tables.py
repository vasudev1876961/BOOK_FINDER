from sqlalchemy import Column, ForeignKey, Integer, Table

from app.database.database import Base

# Many-to-many association table between books and genres
book_genre_association = Table(
    "book_genre",
    Base.metadata,
    Column("book_id", Integer, ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
    Column("genre_id", Integer, ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True),
)
