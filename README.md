# 📚 Aetheria — Enterprise AI Book Discovery & Recommendation Platform

[![CI Pipeline](https://github.com/vasudev1876961/BOOK_FINDER/actions/workflows/ci.yml/badge.svg)](https://github.com/vasudev1876961/BOOK_FINDER/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Aetheria** is an enterprise-grade AI-powered book discovery, recommendation, and personal library management platform. It combines modern Information Retrieval (IR), Reciprocal Rank Fusion (RRF), dense neural embeddings, multi-strategy recommender algorithms, Retrieval-Augmented Generation (RAG), computer vision OCR & barcode scanning, and interactive reading analytics.

The system is architected for zero-setup local execution (SQLite + in-process Numpy vector indexing + Mock LLM) as well as effortless scale-out to containerized production infrastructure (PostgreSQL + Redis + Chroma/Qdrant + OpenAI/Ollama + Nginx).

---

## 🏗 Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                        React 18 + TypeScript Client                               |
|   (Vite, Tailwind CSS, TanStack Query, Recharts, Framer Motion, Lucide Icons)     |
+------------------------------------------+----------------------------------------+
                                           | HTTPS / REST (JWT Auth)
                                           v
+-----------------------------------------------------------------------------------+
|                            FastAPI Backend Server                                 |
|  * Hybrid Search Pipeline (BM25 + Semantic Embeddings + Reciprocal Rank Fusion)   |
|  * Recommender Engine (Content Centroid + Jaccard Collaborative + Popularity)     |
|  * RAG AI Librarian & Audio Dossier Synthesizer (OpenAI / Ollama / Mock)          |
|  * OCR Text Parser (Adaptive Thresholding, Cropping, Rotation) & Barcode Scanner  |
|  * Ingestion Engine (Google Books 1-Click Sync & Open Library Resolution)         |
+--------------------+---------------------+--------------------+-------------------+
                     |                     |                    |
                     v                     v                    v
              +--------------+      +--------------+     +--------------+
              |  Relational  |      | Vector Store |     | Cache/Queue  |
              | SQLite / PG  |      | Numpy / Chroma|    | Memory/Redis |
              +--------------+      +--------------+     +--------------+
```

---

## 🌟 Key Features

### 1. 🔍 Enterprise Hybrid Search Engine
- **Fuzzy Levenshtein Spell Correction**: Dynamically builds spelling vocabulary from catalog titles, authors, and genres to offer auto-corrections for misspelled queries.
- **Lexical BM25 Matching**: Tokenized keyword scoring over book titles, descriptions, and authors.
- **Dense Vector Semantic Search**: Encodes queries and passage chunks into 384-dimensional dense vectors using `sentence-transformers/all-MiniLM-L6-v2`.
- **Reciprocal Rank Fusion (RRF)**: Fuses lexical and semantic ranking lists using:
  $$\text{RRF}(d) = \sum_{m \in M} \frac{1}{60 + r_m(d)}$$
- **Dynamic Popularity Boosting**: Elevates highly-rated and actively reviewed books in search rankings.
- **Multi-Facet Filtering**: Filter by genres, minimum star rating, maximum page count, and language.
- **Instant Autocomplete & Search History**: Debounced real-time suggestions with persistent search history and 24-hour trending queries.
- **Side-by-Side Book Comparison**: Select any 2 books to generate an instant comparative analysis dossier.

### 2. 🤖 Generative AI & RAG Capabilities
- **AI Librarian Q&A**: Interactive chatbot that performs context retrieval over chunked book embeddings to answer nuanced questions about themes, characters, or actionable advice.
- **AI Book Dossiers**: Automatically synthesizes elevator pitches, key takeaways, writing tone, and target audience.
- **AI Review Sentiment Consolidator**: Compiles dozens of reader reviews into summarized bullets of praise and criticism.
- **AI Audio Dossier**: Synthesizes book summaries into spoken audio with real-time browser playback and adjustable speed (0.75x to 2.0x).
- **Flexible LLM Provider**: Toggle seamlessly between `mock` (zero-latency offline testing), `openai` (GPT-4o / GPT-3.5), or `ollama` (local Llama 3 / Mistral).

### 3. 🎯 Multi-Strategy Recommender System
- **Content-Based Filtering**: Compiles user reading history into an embedding centroid to find books with matching conceptual vectors.
- **Collaborative Filtering**: Computes Jaccard similarity across user bookshelves and favorites to discover titles enjoyed by readers with similar tastes.
- **Popularity Fallback**: Cold-start mitigation ensuring new users immediately receive curated high-relevance recommendations.
- **Ensemble Score Fusion**: Blends all strategies:
  $$\text{Score} = 0.6 \cdot S_{\text{content}} + 0.3 \cdot S_{\text{collaborative}} + 0.1 \cdot S_{\text{popularity}}$$

### 4. 📷 Computer Vision OCR & Barcode Scanner
- **Cover Image OCR**: Extract title and author from book cover photos with image rotation, binarization/contrast enhancement, and custom bounding box cropping.
- **Barcode ISBN Scanner**: Decodes ISBN barcodes directly from camera feeds or uploaded images and queries Open Library for automatic catalog resolution.

### 5. 📥 1-Click Google Books Ingestion & Admin Catalog
- **Live Google Books Search**: Search billions of books directly from the admin panel.
- **1-Click Catalog Ingestion**: Imports metadata, high-resolution cover artwork, ISBNs, descriptions, authors, and publishers with automatic deduplication.
- **Background Vector Worker**: Automatically chunks and indexes newly imported books into the vector store without blocking user requests.

### 6. 📊 Reading Analytics & Goal Tracking
- **Streak Tracker**: Calculates consecutive reading days and longest streaks.
- **Speed & Reading Time Estimation**: Configurable reading velocity (pages per minute) with time-to-read calculations.
- **Progress Tracking**: Daily page goals, monthly book targets, and yearly reading challenges with interactive progress bars.
- **Interactive Visualizations**: Monthly reading velocity bar charts and genre distribution breakdown powered by Recharts.

### 7. 📖 Bookshelves, Favorites & Data Export
- **Multi-Shelf Organization**: Organize books across *Want to Read*, *Currently Reading*, and *Completed* shelves.
- **1-Click Favorites**: Bookmark favorite books with instant optimistic UI updates.
- **Data Portability / Export**: One-click export of personal reading lists to **CSV** or **JSON** for easy backup or migration.

### 8. 🔔 In-App Notification Center
- Real-time dropdown notification center with unread counters, mark-as-read actions, and automated alerts for AI recommendations, reading milestones, and system updates.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router v7, Recharts, Framer Motion, Lucide Icons |
| **Backend** | FastAPI, Python 3.12, SQLAlchemy 2.0 ORM, Alembic, Pydantic v2, Passlib/Bcrypt, Starlette |
| **Search & AI** | SentenceTransformers (`all-MiniLM-L6-v2`), BM25, Reciprocal Rank Fusion, RapidFuzz, OpenAI SDK |
| **Storage & Cache** | SQLite (WAL mode, memory PRAGMAs) / PostgreSQL, In-memory cache / Redis |
| **DevOps & CI/CD**| Docker, Docker Compose, Nginx, GitHub Actions (Ruff, Pytest, ESLint, TypeScript compilation) |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.12+
- Node.js 20+ & npm

### 1. Clone & Configure
```bash
git clone https://github.com/vasudev1876961/BOOK_FINDER.git
cd BOOK_FINDER
cp .env.example .env
```
*(By default, `.env` uses `LLM_PROVIDER="mock"` and SQLite for zero-configuration startup without third-party API keys).*

### 2. Backend Setup
```bash
cd server
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

pip install -r requirements.txt

# Run migrations and seed the catalog with rich initial data
python app/database/seed/seed_data.py

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
- API Documentation (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
- Alternative Docs (ReDoc): [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 3. Frontend Setup
```bash
cd ../client
npm install
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## 🔑 Demo Credentials

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@bookfinder.com` | `adminpassword123` | Full access (Google Ingestion, Catalog CRUD, User Management) |
| **Reader** | `demo@bookfinder.com` | `demopassword123` | Standard reader (Search, Shelves, Favorites, Chat, Analytics) |

---

## 🧪 Testing & Code Quality

### Backend Tests (Pytest)
```bash
cd server
pytest -v
```
*Runs 48 comprehensive unit and integration tests covering authentication, hybrid search pipeline, vector store indexing, recommendation algorithms, AI librarian RAG, OCR & barcode scanning, ingestion, notifications, caching, and reading list exports.*

### Backend Linter (Ruff)
```bash
cd server
ruff check .
```

### Frontend Typechecking & Linter
```bash
cd client
npm run lint
npm run build
```

---

## 🐳 Docker Deployment (Production)

Deploy the complete multi-container stack (PostgreSQL, Redis, FastAPI, React/Nginx, and Reverse Proxy):

```bash
docker-compose up -d --build
```

Services exposed:
- **Web App & API Proxy**: `http://localhost:80`
- **FastAPI Direct**: `http://localhost:8000`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

---

## 📡 Key API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new account | No |
| `POST` | `/api/v1/auth/login` | Login and receive JWT access/refresh tokens | No |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile | Yes |
| `POST` | `/api/v1/search/` | Execute hybrid search (BM25 + Semantic + RRF) | Optional |
| `GET` | `/api/v1/search/autocomplete` | Real-time search suggestions | No |
| `GET` | `/api/v1/search/trending` | Trending queries over past 24 hours | No |
| `GET` | `/api/v1/books/` | Paginated catalog list | No |
| `GET` | `/api/v1/books/{id}` | Book details with cached response | No |
| `POST` | `/api/v1/books/external/search` | Search books on Google Books API | Admin |
| `POST` | `/api/v1/books/external/ingest` | 1-click ingest book from Google Books | Admin |
| `POST` | `/api/v1/books/compare` | Compare 2 books side-by-side | No |
| `POST` | `/api/v1/books/{id}/chat` | RAG Chat with a specific book | Yes |
| `POST` | `/api/v1/books/chat` | RAG Chat with the entire library | Yes |
| `GET` | `/api/v1/reading-lists/` | Get user reading shelves | Yes |
| `POST` | `/api/v1/reading-lists/` | Add or update book shelf status | Yes |
| `GET` | `/api/v1/reading-lists/export` | Export reading list to CSV or JSON | Yes |
| `POST` | `/api/v1/reading-lists/{id}/favorite` | Toggle book favorite status | Yes |
| `GET` | `/api/v1/recommendations/` | Get hybrid ensembled recommendations | Yes |
| `GET` | `/api/v1/analytics/` | User reading metrics, streaks & charts | Yes |
| `POST` | `/api/v1/analytics/goals` | Update reading goals and speed | Yes |
| `POST` | `/api/v1/ocr/parse-cover` | OCR book cover with crop/rotation | Yes |
| `POST` | `/api/v1/ocr/scan-barcode` | Decode ISBN barcode and query Open Library | Yes |
| `GET` | `/api/v1/notifications/` | Fetch user notification feed | Yes |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
