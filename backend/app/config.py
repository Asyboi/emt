from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""

    CASES_DIR: Path = Path("../cases")
    PROTOCOLS_DIR: Path = Path("../protocols")
    FIXTURES_DIR: Path = Path("../fixtures")

    FRONTEND_ORIGIN: str = "http://localhost:5173"


settings = Settings()
