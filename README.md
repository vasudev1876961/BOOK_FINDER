# Aetheria - Enterprise AI Book Discovery & Recommendation Platform

Aetheria is an enterprise-grade AI-powered book discovery platform showcasing advanced full-stack software engineering, information retrieval (IR), recommendation systems, and generative AI (RAG).

The platform transitions smoothly from a zero-setup local SQLite/Numpy deployment to a containerized production environment (PostgreSQL + Redis + Qdrant) with simple environment variables.

---

## 🚀 Key Pillars & Features

### 1. Advanced Information Retrieval (Search Engine)
- **Fuzzy Spell Correction**: Preprocesses queries using Levenshtein distance against a dynamic vocabulary trained on the database catalog.
- **Keyword Search (BM25)**: Evaluates query relevance across book titles, descriptions, and authors.
- **Semantic Vector Search**: Generates dense embeddings using `sentence-transformers/all-MiniLM-L6-v2` and retrieves matching chunks.
- **Reciprocal Rank Fusion (RRF)**: Blends ranks from keyword and semantic pipelines to resolve search results.
- **Relevance Boosting**: Dynamically boosts search ranks based on book average ratings and review popularity.

### 2. Multi-Strategy Recommendation System
- **Content-Based Filtering**: Computes similarity scores using book metadata and description embeddings.
- **Collaborative Filtering**: Neighbourhood-based collaborative filtering matching user Jaccard overlaps on favorites.
- **Popularity & Trending**: Fallback mechanisms for cold-start (new user) profiles.
- **Weighted Fusion Layer**: Blends content similarity, collaborative signal, and popularity into a unified recommendation score.

### 3. Generative AI & RAG Pipeline
- **AI Book Dossiers**: Automatically synthesizes summaries, key lessons, and difficulty metrics.
- **AI Librarian Q&A**: Uses recursive text chunking and vector indexing to retrieve relevant context and answer specific questions about a book.
- **Review Sentiment Consolidator**: Compiles dozens of user reviews into summarized lists of praise and criticisms.

### 4. Reading Analytics & User Dashboard
- Interactive analytics dashboard showing reading streaking metrics, total finished pages, and charts for genre breakdown and monthly reading velocity (using Recharts).

---

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack Query (React Query), React Router, Recharts, Framer Motion, Lucide Icons.
- **Backend**: FastAPI (Python 3.12), SQLAlchemy 2.0 (ORM), Alembic (Migrations), Pydantic v2 (Validation), Passlib/Bcrypt (Security).
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
- **Vector Database**: ChromaDB (dev) / Swap-ready to Qdrant (prod).
- **LLM Integrations**: OpenAI GPT API, Ollama (local Llama 3 / Mistral), and high-quality Mock fallbacks.

---

## 📦 Setup & Installation

### 1. Clone & Configure Environment
1. Clone the repository to your desktop.
2. Duplicate `.env.example` as `.env` and adjust settings:
   ```bash
   cp .env.example .env
   ```
   *By default, `LLM_PROVIDER="mock"` is enabled, which generates realistic mock AI outputs so the app works instantly without requiring OpenAI keys.*

### 2. Backend Setup
1. Navigate to the server folder and set up a virtual environment:
   ```bash
   cd server
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run migrations and seed data:
   ```bash
   # Generate schema and seed initial users/books
   python app/database/seed/seed_data.py
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```
   *The Swagger interactive documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).*

### 3. Frontend Setup
1. Navigate to the client folder and install libraries:
   ```bash
   cd client
   npm install
   ```
2. Run the Vite development server:
   ```bash
   npm run dev
   ```
   *Open [http://localhost:5173](http://localhost:5173) in your browser.*

---

## 🧪 Verification & Testing
Run backend unit and integration tests using `pytest` inside the virtual environment:
```bash
pytest
```

## 🔒 Security Implementations
- **Credentials**: Passwords hashed with bcrypt before database storage.
- **Authentication**: JWT token authorization with access and refresh tokens.
- **Role-Based Guards**: Admin endpoints (e.g. creating/deleting books) are strictly role-guarded.
- **API CORS**: Restricted to permitted local origins.
