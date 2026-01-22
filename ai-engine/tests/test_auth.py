"""
Tests for authentication middleware and helpers.
"""

import pytest
import jwt
import time
import os


class TestMiddlewareAuth:
    """Test cases for middleware authentication functions."""
    
    def test_verify_api_key_valid(self):
        """Test that valid API key is accepted."""
        from middleware import verify_api_key
        
        # When no API key is configured, all requests should pass
        os.environ.pop("AI_ENGINE_API_KEY", None)
        assert verify_api_key(None) is True
    
    def test_verify_api_key_with_key_set(self):
        """Test API key verification when key is set."""
        import importlib
        import middleware
        
        # Set the API key and reload the module
        os.environ["AI_ENGINE_API_KEY"] = "test-api-key"
        importlib.reload(middleware)
        
        # Valid key
        assert middleware.verify_api_key("test-api-key") is True
        
        # Invalid key
        assert middleware.verify_api_key("wrong-key") is False
        
        # No key provided
        assert middleware.verify_api_key(None) is False
        
        # Clean up and reload
        os.environ.pop("AI_ENGINE_API_KEY", None)
        importlib.reload(middleware)
    
    def test_verify_jwt_token_valid(self):
        """Test JWT token verification with valid token."""
        from middleware import verify_jwt_token
        
        token = jwt.encode(
            {
                "user_id": "user-123",
                "role": "CONTRIBUTOR",
                "exp": int(time.time()) + 3600
            },
            os.environ.get("JWT_SECRET", "test-secret"),
            algorithm="HS256"
        )
        
        payload = verify_jwt_token(token)
        assert payload["user_id"] == "user-123"
        assert payload["role"] == "CONTRIBUTOR"
    
    def test_verify_jwt_token_expired(self):
        """Test JWT token verification with expired token."""
        from middleware import verify_jwt_token
        from fastapi import HTTPException
        
        token = jwt.encode(
            {
                "user_id": "user-123",
                "role": "CONTRIBUTOR",
                "exp": int(time.time()) - 3600  # Expired 1 hour ago
            },
            os.environ.get("JWT_SECRET", "test-secret"),
            algorithm="HS256"
        )
        
        with pytest.raises(HTTPException) as exc_info:
            verify_jwt_token(token)
        assert exc_info.value.status_code == 401
        assert "expired" in str(exc_info.value.detail).lower()
    
    def test_verify_jwt_token_invalid(self):
        """Test JWT token verification with invalid token."""
        from middleware import verify_jwt_token
        from fastapi import HTTPException
        
        with pytest.raises(HTTPException) as exc_info:
            verify_jwt_token("invalid-token")
        assert exc_info.value.status_code == 401


class TestOriginValidation:
    """Test cases for origin validation."""
    
    def test_validate_origin_allowed(self):
        """Test that allowed origins pass validation."""
        from middleware import ALLOWED_ORIGINS
        
        allowed = [
            "http://localhost:3000",
            "http://localhost:5173",
            "https://open-triage.vercel.app",
        ]
        
        for origin in allowed:
            assert origin in ALLOWED_ORIGINS
    
    def test_validate_origin_blocked(self):
        """Test that non-allowed origins are blocked."""
        from middleware import ALLOWED_ORIGINS
        
        blocked = [
            "http://malicious-site.com",
            "https://fake-opentriage.com",
        ]
        
        for origin in blocked:
            assert origin not in ALLOWED_ORIGINS
