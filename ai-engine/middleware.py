"""
Authentication middleware for API endpoints.
Supports both API key and JWT authentication.
"""

import os
from fastapi import Header, HTTPException, Depends
from typing import Optional
from utils.jwt_utils import verify_jwt_token
from config.settings import settings


async def require_api_key_or_auth(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None)
) -> dict:
    """
    Authenticate request using either JWT token or API key.
    
    Supports two authentication methods:
    1. Bearer token in Authorization header: "Authorization: Bearer <jwt_token>"
    2. API key in X-API-Key header: "X-API-Key: <api_key>"
    
    Args:
        authorization: Authorization header with Bearer token
        x_api_key: X-API-Key header for API key authentication
    
    Returns:
        dict: Authentication context with user info or api_key
    
    Raises:
        HTTPException: If authentication fails
    """
    
    # Try JWT token authentication
    if authorization and authorization.startswith('Bearer '):
        token = authorization.replace('Bearer ', '')
        try:
            payload = verify_jwt_token(token)
            return {
                'type': 'jwt',
                'user_id': payload.get('user_id'),
                'role': payload.get('role'),
                'authenticated': True
            }
        except HTTPException:
            raise
    
    # Try API key authentication
    if x_api_key:
        # Validate API key (can be extended to check against database)
        api_key = os.environ.get('API_KEY', '')
        # Log for debugging (remove in production)
        import logging
        logging.warning(f"API Key validation: received='{x_api_key}', configured='{api_key}', match={x_api_key == api_key}")
        if api_key and x_api_key == api_key:
            return {
                'type': 'api_key',
                'api_key': x_api_key,
                'authenticated': True
            }
        raise HTTPException(status_code=401, detail=f"Invalid API key (expected: {api_key})")
    
    # No authentication provided
    raise HTTPException(
        status_code=401,
        detail="Missing authentication. Provide either Bearer token or X-API-Key header"
    )


async def get_optional_user(
    authorization: Optional[str] = Header(None)
) -> Optional[dict]:
    """
    Get the current user from JWT token if available.
    Does not raise exceptions if authentication is missing.
    
    Args:
        authorization: Authorization header with Bearer token
    
    Returns:
        dict: User info if authenticated, None otherwise
    """
    if not authorization or not authorization.startswith('Bearer '):
        return None
    
    token = authorization.replace('Bearer ', '')
    try:
        payload = verify_jwt_token(token)
        return {
            'user_id': payload.get('user_id'),
            'role': payload.get('role'),
            'authenticated': True
        }
    except HTTPException:
        # Return None instead of raising exception for optional auth
        return None
