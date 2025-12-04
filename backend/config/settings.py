import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')


class Settings:
    # MongoDB
    MONGO_URL: str = os.environ['MONGO_URL']
    DB_NAME: str = os.environ['DB_NAME']
    
    # GitHub OAuth
    GITHUB_CLIENT_ID: str = os.environ['GITHUB_CLIENT_ID']
    GITHUB_CLIENT_SECRET: str = os.environ['GITHUB_CLIENT_SECRET']
    
    # JWT
    JWT_SECRET: str = os.environ['JWT_SECRET']
    
    # AI
    OPENROUTER_API_KEY: str = os.environ['OPENROUTER_API_KEY']
    
    # URLs
    FRONTEND_URL: str = os.environ.get('FRONTEND_URL', "http://localhost:3000")
    API_URL: str = os.environ.get('API_URL', "http://localhost:8000")
    
    # CORS
    ALLOWED_ORIGINS: list = [
        "http://localhost:3000",
        "https://opentriage.onrender.com",
        "https://open-triage-lgdc49epc-cosmicmagnetars-projects.vercel.app"
    ]


settings = Settings()
