"""
Configuration for pytest fixtures and shared test utilities.
"""

import pytest
import os
import sys

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment variables
os.environ['TESTING'] = 'true'
os.environ['JWT_SECRET'] = 'test-jwt-secret-for-testing'
os.environ['ENVIRONMENT'] = 'test'


@pytest.fixture
def mock_user():
    """Fixture providing a mock user object."""
    return {
        "id": "test-user-123",
        "username": "testuser",
        "role": "CONTRIBUTOR",
        "avatarUrl": "https://github.com/test.png"
    }


@pytest.fixture
def mock_maintainer():
    """Fixture providing a mock maintainer user."""
    return {
        "id": "maintainer-123",
        "username": "maintainer",
        "role": "MAINTAINER",
        "avatarUrl": "https://github.com/maintainer.png"
    }


@pytest.fixture
def auth_headers(mock_user):
    """Fixture providing authorization headers with a valid token."""
    import jwt
    import time
    
    token = jwt.encode(
        {
            "user_id": mock_user["id"],
            "role": mock_user["role"],
            "exp": int(time.time()) + 3600
        },
        os.environ['JWT_SECRET'],
        algorithm="HS256"
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def api_key_headers():
    """Fixture providing API key headers for service-to-service calls."""
    return {"X-API-Key": os.environ.get("AI_ENGINE_API_KEY", "")}
