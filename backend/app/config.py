from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    GROQ_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "hr-feedback"

    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@yourdomain.com"
    FRONTEND_URL: str = "http://localhost:5173"
    IS_PRODUCTION: bool = False  # set IS_PRODUCTION=true on Render/Vercel

    class Config:
        env_file = ".env"


settings = Settings()
