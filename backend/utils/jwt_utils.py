import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import HTTPException
from config.settings import settings


def create_jwt_token(user_id: str, role: Optional[str] = None) -> str:
    """Create a JWT token for a user."""
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm='HS256')


def verify_jwt_token(token: str) -> dict:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
