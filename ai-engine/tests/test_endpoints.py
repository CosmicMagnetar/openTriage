"""
Tests for API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestHealthEndpoints:
    """Test cases for health check endpoints."""
    
    @pytest.fixture
    def client(self):
        """Create a test client."""
        from main import app
        return TestClient(app)
    
    def test_health_check(self, client):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_root_endpoint(self, client):
        """Test the root endpoint returns service info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "version" in data
        assert "endpoints" in data


class TestTriageEndpoint:
    """Test cases for the triage endpoint."""
    
    @pytest.fixture
    def client(self):
        """Create a test client."""
        from main import app
        return TestClient(app)
    
    def test_triage_requires_auth(self, client):
        """Test that triage endpoint requires authentication."""
        response = client.post(
            "/triage",
            json={
                "title": "Test Issue",
                "body": "This is a test issue body",
            }
        )
        # Should require auth
        assert response.status_code in [401, 422]  # 422 if validation runs first
    
    def test_triage_with_auth(self, client, auth_headers):
        """Test triage endpoint with valid authentication."""
        response = client.post(
            "/triage",
            json={
                "title": "Bug: Application crashes on startup",
                "body": "The application crashes when I try to start it.",
                "authorName": "testuser",
                "isPR": False,
            },
            headers=auth_headers
        )
        # May fail due to AI service, but should not be 401
        assert response.status_code != 401


class TestChatEndpoint:
    """Test cases for the chat endpoint."""
    
    @pytest.fixture
    def client(self):
        """Create a test client."""
        from main import app
        return TestClient(app)
    
    def test_chat_requires_auth(self, client):
        """Test that chat endpoint requires authentication."""
        response = client.post(
            "/chat",
            json={
                "message": "Hello, how can you help me?",
            }
        )
        assert response.status_code in [401, 422]
    
    def test_chat_with_auth(self, client, auth_headers):
        """Test chat endpoint with valid authentication."""
        response = client.post(
            "/chat",
            json={
                "message": "Hello, how can you help me?",
            },
            headers=auth_headers
        )
        # May fail due to AI service, but should not be 401
        assert response.status_code != 401


class TestRAGEndpoints:
    """Test cases for RAG chatbot endpoints."""
    
    @pytest.fixture
    def client(self):
        """Create a test client."""
        from main import app
        return TestClient(app)
    
    def test_rag_chat_requires_auth(self, client):
        """Test that RAG chat endpoint requires authentication."""
        response = client.post(
            "/rag/chat",
            json={
                "question": "How does the authentication work?",
            }
        )
        assert response.status_code in [401, 422]
    
    def test_rag_index_requires_auth(self, client):
        """Test that RAG index endpoint requires authentication."""
        response = client.post(
            "/rag/index",
            json={
                "repo_name": "facebook/react",
            }
        )
        assert response.status_code in [401, 422]
    
    def test_rag_suggestions_public(self, client):
        """Test that RAG suggestions endpoint is publicly accessible."""
        response = client.get("/rag/suggestions")
        # Should not require auth
        assert response.status_code != 401


class TestMentorMatchEndpoint:
    """Test cases for mentor matching endpoint."""
    
    @pytest.fixture
    def client(self):
        """Create a test client."""
        from main import app
        return TestClient(app)
    
    def test_mentor_match_requires_auth(self, client):
        """Test that mentor match endpoint requires authentication."""
        response = client.post(
            "/mentor-match",
            json={
                "user_id": "user-123",
                "username": "testuser",
            }
        )
        assert response.status_code in [401, 422]


class TestHypeEndpoint:
    """Test cases for hype generator endpoint."""
    
    @pytest.fixture
    def client(self):
        """Create a test client."""
        from main import app
        return TestClient(app)
    
    def test_hype_requires_auth(self, client):
        """Test that hype endpoint requires authentication."""
        response = client.post(
            "/hype",
            json={
                "pr_title": "Add new feature",
                "additions": 100,
                "deletions": 10,
            }
        )
        assert response.status_code in [401, 422]
