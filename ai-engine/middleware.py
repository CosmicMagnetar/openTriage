"""
Authentication Middleware for AI Engine

Provides API key and JWT-based authentication for protecting endpoints.
"""

import os
import logging
from typing import Optional
from functools import wraps
from fastapi import Request, HTTPException, Depends, Header
import jwt

from config.settings import settings

logger = logging.getLogger(__name__)

# API key for service-to-service communication
API_KEY = os.getenv("AI_ENGINE_API_KEY", "")

# Allowed origins for CORS
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://open-triage.vercel.app",
    "https://opentriage.onrender.com",
    "https://opentriage-backend.onrender.com",
]


def verify_api_key(x_api_key: Optional[str] = Header(None)) -> bool:
    """
    Verify API key for service-to-service calls.
    Returns True if API key is valid or not required.
    """
    if not API_KEY:
        # API key not configured, allow all requests
        return True
    
    if x_api_key and x_api_key == API_KEY:
        return True
    
    return False


def verify_jwt_token(token: str) -> dict:
    """
    Verify and decode a JWT token.
    Returns the decoded payload or raises HTTPException.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Extract user from Authorization header if present.
    Returns None if no valid token is provided.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization[7:]  # Remove "Bearer "
    
    try:
        payload = verify_jwt_token(token)
        return {
            "user_id": payload.get("user_id"),
            "role": payload.get("role"),
        }
    except HTTPException:
        return None


async def require_auth(authorization: Optional[str] = Header(None)) -> dict:
    """
    Require valid authentication.
    Raises HTTPException if not authenticated.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization[7:]
    payload = verify_jwt_token(token)
    
    return {
        "user_id": payload.get("user_id"),
        "role": payload.get("role"),
    }


async def require_api_key_or_auth(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None)
) -> dict:
    """
    Require either valid API key or JWT authentication.
    Used for endpoints that can be called by both services and users.
    """
    # Check API key first (service-to-service)
    if verify_api_key(x_api_key):
        return {"service": True, "user_id": None, "role": None}
    
    # Fall back to JWT auth
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            payload = verify_jwt_token(token)
            return {
                "service": False,
                "user_id": payload.get("user_id"),
                "role": payload.get("role"),
            }
        except HTTPException:
            pass
    
    raise HTTPException(status_code=401, detail="Authentication required")


def validate_origin(request: Request) -> bool:
    """
    Validate request origin against allowed origins.
    """
    origin = request.headers.get("origin", "")
    
    if not origin:
        # No origin header (direct API call, not browser)
        return True
    
    return origin in ALLOWED_ORIGINS
