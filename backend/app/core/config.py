from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Crop & Irrigation Planner API"
    PROJECT_VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # CORS origins for local development
    # In production, set the CORS_ORIGINS_EXTRA env variable to a
    # comma-separated list of allowed frontend origins, e.g.:
    #   CORS_ORIGINS_EXTRA=https://your-quantum-agri-app.vercel.app
    CORS_ORIGINS_EXTRA: Optional[str] = None

    @property
    def CORS_ORIGINS(self) -> List[str]:
        # Always include localhost origins for local development
        origins: List[str] = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
        # Append any production origins configured via environment variable
        if self.CORS_ORIGINS_EXTRA:
            for origin in self.CORS_ORIGINS_EXTRA.split(","):
                stripped = origin.strip()
                if stripped and stripped not in origins:
                    origins.append(stripped)
        return origins

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )


settings = Settings()
