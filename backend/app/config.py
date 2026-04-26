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

    FRONTEND_ORIGINS: str = "http://localhost:5173"

    # Demo: when set, cases without their own upstream_cache.json (e.g. fresh
    # uploads from the New Report UI) reuse this case's warmed CAD/video/audio
    # events for the PCR Auto-Draft so the demo flow stays fast.
    DEMO_UPSTREAM_CACHE_CASE_ID: str = ""

    @property
    def frontend_origins_list(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]


settings = Settings()
