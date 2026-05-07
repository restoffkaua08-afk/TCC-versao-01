from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "TSEA Sistema"
    database_url: str = "sqlite:///./tsea.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    base_dir: Path = Path(__file__).resolve().parents[2]

    # Integração opcional com OpenAI.
    # Não coloque a chave no código. Use backend/.env.
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
