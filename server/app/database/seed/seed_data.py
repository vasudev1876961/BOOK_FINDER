import os
import sys
from datetime import datetime

# Ensure backend directory is in the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session

from app.auth.security import get_password_hash
from app.database.database import Base, SessionLocal, engine
from app.database.models import (
    Author,
    Book,
    Genre,
    Notification,
    Publisher,
    Review,
    User,
)

# List of initial books with rich details
BOOKS_DATA = [
    {
        "title": "Atomic Habits",
        "author": "James Clear",
        "author_bio": "James Clear is a writer and speaker focused on habits, decision-making, and continuous improvement. He is the author of the #1 New York Times bestseller Atomic Habits.",
        "publisher": "Avery",
        "genres": ["Self-Help", "Psychology", "Business"],
        "description": "No matter your goals, Atomic Habits offers a proven framework for improving every day. James Clear, one of the world's leading experts on habit formation, reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results. Learn how to make time for new habits, overcome a lack of motivation and willpower, design your environment to make success easier, and get back on track when you fall off course.",
        "isbn": "9780735211292",
        "pub_date": "2018-10-16",
        "pages": 320,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/91bYsX41hRL.jpg",
        "language": "English",
        "rating": 4.8,
        "rating_count": 150
    },
    {
        "title": "Deep Work",
        "author": "Cal Newport",
        "author_bio": "Cal Newport is an Associate Professor of Computer Science at Georgetown University and the author of several books, including Digital Minimalism and So Good They Can't Ignore You.",
        "publisher": "Grand Central Publishing",
        "genres": ["Business", "Self-Help", "Tech"],
        "description": "Deep work is the ability to focus without distraction on a cognitively demanding task. It's a skill that allows you to quickly master complicated information and produce better results in less time. Deep work will make you better at what you do and provide the sense of true fulfillment that comes from craftsmanship. In short, deep work is like a super power in our increasingly competitive twenty-first century economy. This book guides you through a training regimen to build a deep focus habit.",
        "isbn": "9781455586691",
        "pub_date": "2016-01-05",
        "pages": 304,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/417yF4jI1vL.jpg",
        "language": "English",
        "rating": 4.6,
        "rating_count": 98
    },
    {
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "author_bio": "Robert C. Martin, colloquially known as Uncle Bob, is an American software engineer, instructor, and author. He is best known for being one of the authors of the Agile Manifesto.",
        "publisher": "Prentice Hall",
        "genres": ["Tech", "Education"],
        "description": "Even bad code can function. But if code isn't clean, it can bring a development organization to its knees. Every year, countless hours and significant resources are lost because of poorly written code. But it doesn't have to be that way. Noted software expert Robert C. Martin presents a revolutionary paradigm with Clean Code: A Handbook of Agile Software Craftsmanship. Martin has teamed up with his colleagues from Object Mentor to distill their best agile practice of cleaning code 'on the fly' into a book that will instill within you the values of a software craftsman.",
        "isbn": "9780132350884",
        "pub_date": "2008-08-01",
        "pages": 464,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/41SH-I14sNL.jpg",
        "language": "English",
        "rating": 4.7,
        "rating_count": 85
    },
    {
        "title": "The Hobbit",
        "author": "J.R.R. Tolkien",
        "author_bio": "John Ronald Reuel Tolkien was an English writer, poet, philologist, and academic, best known as the author of the high fantasy works The Hobbit and The Lord of the Rings.",
        "publisher": "George Allen & Unwin",
        "genres": ["Fantasy", "Fiction"],
        "description": "Written for J.R.R. Tolkien's own children, The Hobbit met with instant critical acclaim when it was first published in 1937. Now recognized as a timeless classic, this introduction to the hobbit Bilbo Baggins, the wizard Gandalf, Gollum, and the spectacular world of Middle-earth, recounts of the adventures of a reluctant hero, a powerful and dangerous ring, and the cruel dragon Smaug the Magnificent. It sets the stage for the epic conflict of the War of the Ring.",
        "isbn": "9780007525492",
        "pub_date": "1937-09-21",
        "pages": 310,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/710+HcoPq7L.jpg",
        "language": "English",
        "rating": 4.9,
        "rating_count": 210
    },
    {
        "title": "Dune",
        "author": "Frank Herbert",
        "author_bio": "Frank Herbert was an American science fiction writer best known for the 1965 novel Dune and its five sequels. The Dune saga is widely considered one of the pillars of science fiction.",
        "publisher": "Chilton Books",
        "genres": ["Sci-Fi", "Fiction", "Fantasy"],
        "description": "Set in the far future amidst a sprawling feudal interstellar empire, Dune tells the story of Paul Atreides as he and his family accept control of the desert planet Arrakis. A planet containing the only source of the spice melange, the most valuable and vital substance in the cosmos. Dune is a stunning blend of adventure and mysticism, environmentalism and politics, which won the first Nebula Award and shared the Hugo Award. It investigates the dangers of messianic leaders and complex socio-ecological systems.",
        "isbn": "9780441172719",
        "pub_date": "1965-06-01",
        "pages": 608,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/41m-vj-mJML.jpg",
        "language": "English",
        "rating": 4.7,
        "rating_count": 180
    },
    {
        "title": "Sapiens: A Brief History of Humankind",
        "author": "Yuval Noah Harari",
        "author_bio": "Yuval Noah Harari is an Israeli public intellectual, historian and a professor in the Department of History at the Hebrew University of Jerusalem. He is the author of Sapiens and Homo Deus.",
        "publisher": "Harper",
        "genres": ["History", "Psychology", "Education"],
        "description": "Destined to become a modern classic, Sapiens explores how the cognitive, agricultural, and scientific revolutions have shaped us and our society. Yuval Noah Harari spans the whole of human history, from the very first humans to walk the earth to the radical breakthroughs of the Cognitive, Agricultural and Scientific Revolutions. Drawing on insights from biology, anthropology, paleontology and economics, he explores how the currents of history have shaped our human societies, the animals and plants around us, and even our personalities.",
        "isbn": "9780062316097",
        "pub_date": "2014-09-04",
        "pages": 443,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/713jIoMO3UL.jpg",
        "language": "English",
        "rating": 4.5,
        "rating_count": 120
    },
    {
        "title": "Thinking, Fast and Slow",
        "author": "Daniel Kahneman",
        "author_bio": "Daniel Kahneman was an Israeli-American psychologist and economist notable for his work on the psychology of judgment and decision-making, for which he was awarded the 2002 Nobel Memorial Prize in Economic Sciences.",
        "publisher": "Farrar, Straus and Giroux",
        "genres": ["Psychology", "Business", "Self-Help"],
        "description": "In the international bestseller, Thinking, Fast and Slow, Daniel Kahneman, the renowned psychologist and winner of the Nobel Prize in Economics, takes us on a groundbreaking tour of the mind and explains the two systems that drive the way we think. System 1 is fast, intuitive, and emotional; System 2 is slower, more deliberative, and more logical. Kahneman exposes the extraordinary capabilities—and also the faults and biases—of fast thinking, and reveals where we can and cannot trust our intuitions.",
        "isbn": "9780374275631",
        "pub_date": "2011-10-25",
        "pages": 499,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/41shdptqwxL.jpg",
        "language": "English",
        "rating": 4.4,
        "rating_count": 105
    },
    {
        "title": "The Pragmatic Programmer",
        "author": "David Thomas",
        "author_bio": "David Thomas is a programmer and author, best known for co-authoring The Pragmatic Programmer and for bringing Ruby to Western developers.",
        "publisher": "Addison-Wesley",
        "genres": ["Tech", "Education"],
        "description": "The Pragmatic Programmer is one of the most significant books in software development. It cuts through the increasing specialization and technicalities of modern software development to examine the core process—taking a requirement and producing working, maintainable code that delights its users. It covers topics ranging from personal responsibility and career development to architectural techniques for keeping your code flexible and easy to adapt and reuse.",
        "isbn": "9780135957059",
        "pub_date": "1999-10-30",
        "pages": 352,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/41as+45FUTL.jpg",
        "language": "English",
        "rating": 4.8,
        "rating_count": 92
    },
    {
        "title": "Zero to One",
        "author": "Peter Thiel",
        "author_bio": "Peter Thiel is a billionaire entrepreneur and venture capitalist. He co-founded PayPal, Palantir Technologies, and Founders Fund.",
        "publisher": "Crown Business",
        "genres": ["Business", "Self-Help"],
        "description": "If you want to build a better future, you must believe in secrets. The great secret of our time is that there are still uncharted frontiers to explore and new inventions to create. In Zero to One, legendary entrepreneur and investor Peter Thiel shows how we can find singular ways to create those new things. Thiel begins with the contrarian premise that we live in an age of technological stagnation. Zero to One presents at once an optimistic view of the future of progress in America and a new way of thinking about innovation.",
        "isbn": "9780804139298",
        "pub_date": "2014-09-16",
        "pages": 224,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/71uGyZqR2AL.jpg",
        "language": "English",
        "rating": 4.5,
        "rating_count": 80
    },
    {
        "title": "Educated",
        "author": "Tara Westover",
        "author_bio": "Tara Westover is an American memoirist, essayist, and historian. Her memoir Educated debuted at #1 on the New York Times bestseller list.",
        "publisher": "Random House",
        "genres": ["Biography", "History", "Education"],
        "description": "Educated is an account of the struggle for self-invention. It is a story of fierce family loyalty, and of the grief that comes with severing the closest ties. Tara Westover was seventeen the first time she set foot in a classroom. Born to survivalists in the mountains of Idaho, she prepared for the end of the world by stewing herbs and sleeping with her 'head-for-the-hills' bag. In the end, Tara's quest for knowledge would transform her, taking her over oceans and across continents, to Harvard and to Cambridge University. Only then would she wonder if she'd traveled too far, if there was still a way home.",
        "isbn": "9780399588174",
        "pub_date": "2018-02-20",
        "pages": 352,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/81W5upn2VNL.jpg",
        "language": "English",
        "rating": 4.7,
        "rating_count": 130
    },
    {
        "title": "Steve Jobs",
        "author": "Walter Isaacson",
        "author_bio": "Walter Isaacson is an American author, journalist, and professor. He has served as the president and CEO of the Aspen Institute and CNN.",
        "publisher": "Simon & Schuster",
        "genres": ["Biography", "Business", "Tech"],
        "description": "Based on more than forty interviews with Steve Jobs conducted over two years—as well as interviews with more than a hundred family members, friends, adversaries, competitors, and colleagues—Walter Isaacson has written a riveting story of the roller-coaster life and searingly intense personality of a creative entrepreneur whose passion for perfection and ferocious drive revolutionized six industries: personal computers, animated movies, music, phones, tablet computing, and digital publishing.",
        "isbn": "9781451648539",
        "pub_date": "2011-10-24",
        "pages": 656,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/41dK48gB9oL.jpg",
        "language": "English",
        "rating": 4.6,
        "rating_count": 115
    },
    {
        "title": "The Silent Patient",
        "author": "Alex Michaelides",
        "author_bio": "Alex Michaelides is a British-Cypriot author and screenwriter. His debut novel, the psychological thriller The Silent Patient, was a #1 New York Times bestseller.",
        "publisher": "Celadon Books",
        "genres": ["Mystery", "Fiction", "Psychology"],
        "description": "Alicia Berenson's life is seemingly perfect. A famous painter married to an in-demand fashion photographer, she lives in a grand house overlooking a park in one of London's most desirable areas. One evening her husband Gabriel returns home late from a fashion shoot, and Alicia shoots him five times in the face, and then never speaks another word. Alicia's refusal to talk, or give any kind of explanation, turns a domestic tragedy into something far grander, a mystery that captures the public imagination and casts Alicia into notoriety. Theo Faber is a criminal psychotherapist who has waited a long time for the opportunity to work with Alicia.",
        "isbn": "9781250301697",
        "pub_date": "2019-02-05",
        "pages": 336,
        "cover_url": "https://images-na.ssl-images-amazon.com/images/I/81TxJ6-qZML.jpg",
        "language": "English",
        "rating": 4.3,
        "rating_count": 140
    }
]

def seed_db():
    db: Session = SessionLocal()
    try:
        # 1. Create tables if not exist (as safety fallback)
        Base.metadata.create_all(bind=engine)

        # 2. Check if users table already seeded
        if db.query(User).count() > 0:
            print("Database already seeded with initial data. Skipping seed process.")
            return

        # 3. Create Seed Users
        print("Seeding Users...")
        admin_user = User(
            email="admin@bookfinder.com",
            hashed_password=get_password_hash("adminpassword123"),
            full_name="Platform Admin",
            role="admin",
            is_active=True
        )
        demo_user = User(
            email="demo@bookfinder.com",
            hashed_password=get_password_hash("demopassword123"),
            full_name="Demo Reader",
            role="user",
            is_active=True
        )
        db.add_all([admin_user, demo_user])
        db.commit()

        # 4. Ingest Books, Authors, Publishers, and Genres
        print("Seeding Catalog (Authors, Publishers, Genres, Books)...")
        for item in BOOKS_DATA:
            # Get or create Author
            author = db.query(Author).filter(Author.name == item["author"]).first()
            if not author:
                author = Author(name=item["author"], bio=item["author_bio"])
                db.add(author)
                db.flush()  # obtain author.id

            # Get or create Publisher
            publisher = db.query(Publisher).filter(Publisher.name == item["publisher"]).first()
            if not publisher:
                publisher = Publisher(name=item["publisher"])
                db.add(publisher)
                db.flush()

            # Get or create Genres
            genre_objects = []
            for g_name in item["genres"]:
                genre = db.query(Genre).filter(Genre.name == g_name).first()
                if not genre:
                    genre = Genre(name=g_name)
                    db.add(genre)
                    db.flush()
                genre_objects.append(genre)

            # Create Book
            book = Book(
                title=item["title"],
                description=item["description"],
                isbn=item["isbn"],
                pub_date=item["pub_date"],
                pages=item["pages"],
                cover_url=item["cover_url"],
                language=item["language"],
                rating=item["rating"],
                rating_count=item["rating_count"],
                author=author,
                publisher=publisher,
                genres=genre_objects
            )
            db.add(book)
            db.flush()

            # 5. Add a couple of initial mock reviews for books
            review_text_positive = f"Absolutely loved reading '{item['title']}'. It was eye-opening and highly informative. Highly recommended for anyone interested in this topic!"
            review_text_critical = f"While '{item['title']}' contains valuable insights, I found the pace a bit slow and it became somewhat repetitive in the middle chapters."

            review_1 = Review(
                user_id=demo_user.id,
                book_id=book.id,
                rating=5,
                review_text=review_text_positive,
                created_at=datetime.utcnow()
            )
            review_2 = Review(
                user_id=admin_user.id,
                book_id=book.id,
                rating=3,
                review_text=review_text_critical,
                created_at=datetime.utcnow()
            )
            db.add_all([review_1, review_2])

        # 6. Add some initial mock notifications for users
        notif_user_1 = Notification(
            user_id=demo_user.id,
            title="Welcome to Aetheria!",
            message="Welcome to Aetheria AI Book Discovery! Search, create reading lists, and ask our AI librarian anything about books.",
            created_at=datetime.utcnow()
        )
        notif_user_2 = Notification(
            user_id=demo_user.id,
            title="AI Recommendations Ready",
            message="We precomputed content recommendations based on your preferences. Check them out on your dashboard!",
            created_at=datetime.utcnow()
        )
        notif_admin = Notification(
            user_id=admin_user.id,
            title="System Alert",
            message="The search index database is successfully synced with the local SQLite storage.",
            created_at=datetime.utcnow()
        )
        db.add_all([notif_user_1, notif_user_2, notif_admin])

        db.commit()
        print("Database successfully seeded!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
