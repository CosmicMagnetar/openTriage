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
        "https://open-triage.vercel.app",
        "https://open-triage-lgdc49epc-cosmicmagnetars-projects.vercel.app"
    ]
    
    # Spark Configuration
    SPARK_APP_NAME: str = os.environ.get('SPARK_APP_NAME', 'OpenTriage')
    SPARK_MASTER: str = os.environ.get('SPARK_MASTER', 'local[*]')
    SPARK_DRIVER_MEMORY: str = os.environ.get('SPARK_DRIVER_MEMORY', '4g')
    SPARK_EXECUTOR_MEMORY: str = os.environ.get('SPARK_EXECUTOR_MEMORY', '2g')
    SPARK_LOG_LEVEL: str = os.environ.get('SPARK_LOG_LEVEL', 'WARN')


settings = Settings()
