"""
Configuration settings for AI Engine.
Adapted for standalone deployment on Hugging Face Spaces.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')


class Settings:
    """Application settings with optional environment variables for standalone operation."""
    
    # MongoDB (optional - only needed if using DB features)
    MONGO_URL: str = os.environ.get('MONGO_URL', '')
    DB_NAME: str = os.environ.get('DB_NAME', 'opentriage')
    
    # GitHub OAuth (optional for AI-only endpoints)
    GITHUB_CLIENT_ID: str = os.environ.get('GITHUB_CLIENT_ID', '')
    GITHUB_CLIENT_SECRET: str = os.environ.get('GITHUB_CLIENT_SECRET', '')
    
    # JWT (optional for AI-only endpoints)
    JWT_SECRET: str = os.environ.get('JWT_SECRET', 'dev-secret-change-in-prod')
    
    # AI - Required for triage/chat features
    OPENROUTER_API_KEY: str = os.environ.get('OPENROUTER_API_KEY', '')
    OPENAI_API_KEY: str = os.environ.get('OPENAI_API_KEY', '')
    
    # URLs
    FRONTEND_URL: str = os.environ.get('FRONTEND_URL', "http://localhost:3000")
    API_URL: str = os.environ.get('API_URL', "http://localhost:8000")
    BACKEND_TS_URL: str = os.environ.get('BACKEND_TS_URL', "http://localhost:3001")
    
    # CORS
    ALLOWED_ORIGINS: list = os.environ.get('CORS_ORIGINS', 
        "http://localhost:3000,http://localhost:5173,https://opentriage.onrender.com,https://open-triage.vercel.app"
    ).split(',')
    
    # Spark Configuration (optional - disabled by default for HF deployment)
    SPARK_ENABLED: bool = os.environ.get('SPARK_ENABLED', 'false').lower() == 'true'
    SPARK_APP_NAME: str = os.environ.get('SPARK_APP_NAME', 'OpenTriage')
    SPARK_MASTER: str = os.environ.get('SPARK_MASTER', 'local[*]')
    SPARK_DRIVER_MEMORY: str = os.environ.get('SPARK_DRIVER_MEMORY', '4g')
    SPARK_EXECUTOR_MEMORY: str = os.environ.get('SPARK_EXECUTOR_MEMORY', '2g')
    SPARK_LOG_LEVEL: str = os.environ.get('SPARK_LOG_LEVEL', 'WARN')
    
    # Environment
    ENVIRONMENT: str = os.environ.get('ENVIRONMENT', 'development')
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == 'production'
    
    @property
    def api_key(self) -> str:
        """Get the active API key (prefer OpenRouter)."""
        return self.OPENROUTER_API_KEY or self.OPENAI_API_KEY


settings = Settings()
