from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Enterprise AI Book Discovery Platform"
    API_V1_STR: str = "/api/v1"

    # Security
    SECRET_KEY: str = "super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    # Default to local SQLite database for development
    DATABASE_URL: str = "sqlite:///./book_finder.db"

    # Vector Database
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"

    # AI Providers
    # "mock" runs realistic static outputs; "openai" or "ollama" for live integration
    LLM_PROVIDER: Literal["mock", "openai", "ollama"] = "mock"
    OPENAI_API_KEY: str | None = None
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    # Embedding Settings
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Caching / Redis Settings
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TYPE: Literal["redis", "in_memory"] = "in_memory"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
