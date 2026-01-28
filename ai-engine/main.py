"""
OpenTriage AI Engine - Full-Featured Backend

Lift-and-shift deployment of the original Python AI backend.
All service logic is preserved exactly as-is from the original codebase.

Designed for Hugging Face Spaces deployment.
"""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware

# Import authentication middleware
from middleware import require_api_key_or_auth, get_optional_user
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Import original services (unchanged logic)
from services.ai_service import ai_triage_service, ai_chat_service
from services.rag_chatbot_service import rag_chatbot_service
from services.mentor_matching_service import mentor_matching_service
from services.hype_generator_service import hype_generator_service
from services.rag_data_prep import rag_data_prep

# Import models for request/response types
from models.issue import Issue


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting OpenTriage AI Engine (Full Backend)...")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
    yield
    logger.info("Shutting down OpenTriage AI Engine...")


app = FastAPI(
    title="OpenTriage AI Engine",
    description="Full-featured AI backend for issue triage, RAG chatbot, mentor matching, and hype generation",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,https://open-triage.vercel.app,https://opentriage.onrender.com").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include data routes (contributor, messaging, auth)
from routes.data_routes import router as data_router
app.include_router(data_router)


# =============================================================================
# Request Models (matching original service expectations)
# =============================================================================

class TriageRequest(BaseModel):
    """Request for issue triage - matches ai_service.classify_issue()"""
    title: str
    body: Optional[str] = ""
    authorName: str = "unknown"
    isPR: bool = False
    # Full Issue object fields for compatibility
    id: Optional[str] = None
    githubIssueId: Optional[int] = None
    number: Optional[int] = None
    repoId: Optional[str] = None
    repoName: Optional[str] = None


class ChatRequest(BaseModel):
    """Request for AI chat - matches ai_chat_service.chat()"""
    message: str
    history: Optional[List[Dict[str, str]]] = None
    context: Optional[Dict[str, Any]] = None


class RAGChatRequest(BaseModel):
    """Request for RAG chatbot - matches rag_chatbot_service.answer_question()"""
    question: str
    repo_name: Optional[str] = None
    top_k: int = 5
    github_access_token: Optional[str] = None


class MentorMatchRequest(BaseModel):
    """Request for mentor matching - matches mentor_matching_service.find_mentors_for_user()"""
    user_id: str
    username: str
    limit: int = 5
    skill_filter: Optional[List[str]] = None


class HypeRequest(BaseModel):
    """Request for hype generation - matches hype_generator_service"""
    pr_title: str
    pr_body: Optional[str] = ""
    files_changed: Optional[List[str]] = None
    additions: int = 0
    deletions: int = 0
    repo_name: Optional[str] = None


class RAGIndexRequest(BaseModel):
    """Request for RAG indexing - matches rag_chatbot_service.index_repository()"""
    repo_name: str
    github_access_token: Optional[str] = None


class RAGDataPrepRequest(BaseModel):
    """Request for RAG data prep - matches rag_data_prep.prepare_documents()"""
    doc_types: Optional[List[str]] = ["issue", "pr", "comment"]
    repo_names: Optional[List[str]] = None
    collection_name: str = "rag_chunks"


# =============================================================================
# Health & Status Endpoints
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration."""
    return {
        "status": "healthy",
        "service": "ai-engine-full",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_key_configured": bool(os.environ.get('API_KEY', ''))
    }


@app.get("/debug/env")
async def debug_env(auth: dict = Depends(require_api_key_or_auth)):
    """Debug endpoint to show environment variable configuration."""
    return {
        "api_key_set": bool(os.environ.get('API_KEY', '')),
        "api_key_value": os.environ.get('API_KEY', 'NOT_SET'),
        "jwt_secret_set": bool(os.environ.get('JWT_SECRET', '')),
    }


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "OpenTriage AI Engine (Full)",
        "version": "2.0.0",
        "description": "Full-featured AI backend lifted from original Python codebase",
        "endpoints": {
            "triage": "POST /triage - Issue classification",
            "chat": "POST /chat - AI chat assistant",
            "rag_chat": "POST /rag/chat - RAG-based Q&A",
            "rag_index": "POST /rag/index - Index repository for RAG",
            "rag_suggestions": "GET /rag/suggestions - Get suggested questions",
            "mentor_match": "POST /mentor-match - Find mentor matches",
            "hype": "POST /hype - Generate PR hype"
        }
    }


# =============================================================================
# Triage Endpoints
# =============================================================================

@app.post("/triage")
async def triage_issue(request: TriageRequest, auth: dict = Depends(require_api_key_or_auth)):
    """
    Classify and triage a GitHub issue using AI.
    
    Passes directly to ai_triage_service.classify_issue()
    Requires authentication (API key or JWT token).
    
    Implements Redis caching with 24-hour TTL.
    """
    try:
        # Import Redis utilities (lazy import to avoid startup dependencies)
        from config.redis import generate_cache_key, cache_get, cache_set
        
        # Generate cache key from request data
        cache_data = {
            "title": request.title,
            "body": request.body or "",
            "isPR": request.isPR
        }
        cache_key = generate_cache_key("triage", cache_data)
        
        # Check cache first
        cached_result = cache_get(cache_key)
        if cached_result is not None:
            logger.info(f"Cache HIT for triage request: {cache_key}")
            # Add cache metadata
            cached_result["_cached"] = True
            cached_result["_cache_key"] = cache_key
            return cached_result
        
        logger.info(f"Cache MISS for triage request: {cache_key}")
        
        # Create Issue object matching the original service expectation
        issue = Issue(
            id=request.id or "temp-id",
            githubIssueId=request.githubIssueId or 0,
            number=request.number or 0,
            title=request.title,
            body=request.body or "",
            authorName=request.authorName,
            repoId=request.repoId or "temp-repo",
            repoName=request.repoName or "unknown/repo",
            isPR=request.isPR
        )
        
        # Call AI service (cache miss)
        result = await ai_triage_service.classify_issue(issue)
        
        # Cache the result with 24-hour TTL (86400 seconds)
        cache_set(cache_key, result, ttl=86400)
        logger.info(f"Cached triage result: {cache_key}")
        
        # Add cache metadata
        result["_cached"] = False
        result["_cache_key"] = cache_key
        
        return result
    except Exception as e:
        logger.error(f"Triage error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Chat Endpoints
# =============================================================================

@app.post("/chat")
async def chat(request: ChatRequest, auth: dict = Depends(require_api_key_or_auth)):
    """
    AI chat endpoint for general assistance.
    
    Passes directly to ai_chat_service.chat()
    Requires authentication (API key or JWT token).
    """
    try:
        response = await ai_chat_service.chat(
            message=request.message,
            history=request.history,
            context=request.context
        )
        return {"response": response}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# RAG Chatbot Endpoints
# =============================================================================

@app.post("/rag/chat")
async def rag_chat(request: RAGChatRequest, auth: dict = Depends(require_api_key_or_auth)):
    """
    Answer questions using RAG (Retrieval-Augmented Generation).
    
    Passes directly to rag_chatbot_service.answer_question()
    Requires authentication.
    """
    try:
        result = await rag_chatbot_service.answer_question(
            question=request.question,
            repo_name=request.repo_name,
            top_k=request.top_k,
            github_access_token=request.github_access_token
        )
        return result
    except Exception as e:
        logger.error(f"RAG chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/index")
async def rag_index(request: RAGIndexRequest, auth: dict = Depends(require_api_key_or_auth)):
    """
    Index a repository for RAG search.
    
    Passes directly to rag_chatbot_service.index_repository()
    Requires authentication.
    """
    try:
        result = await rag_chatbot_service.index_repository(
            repo_name=request.repo_name,
            github_access_token=request.github_access_token
        )
        return {"success": True, "message": result}
    except Exception as e:
        logger.error(f"RAG index error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/rag/suggestions")
async def rag_suggestions(repo_name: Optional[str] = None):
    """Get suggested questions for RAG chatbot."""
    try:
        suggestions = await rag_chatbot_service.get_suggested_questions(repo_name)
        return {"suggestions": suggestions}
    except Exception as e:
        logger.error(f"RAG suggestions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Mentor Matching Endpoints
# =============================================================================

@app.post("/mentor-match")
async def mentor_match(request: MentorMatchRequest, auth: dict = Depends(require_api_key_or_auth)):
    """
    Find mentor matches for a user.
    
    Passes directly to mentor_matching_service.find_mentors_for_user()
    Requires authentication.
    """
    try:
        matches = mentor_matching_service.find_mentors_for_user(
            user_id=request.user_id,
            username=request.username,
            limit=request.limit,
            skill_filter=request.skill_filter
        )
        return {"matches": matches}
    except Exception as e:
        logger.error(f"Mentor match error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Hype Generator Endpoints
# =============================================================================

@app.post("/hype")
async def generate_hype(request: HypeRequest, auth: dict = Depends(require_api_key_or_auth)):
    """
    Generate hype/celebration message for a PR.
    
    Passes directly to hype_generator_service.generate_hype()
    Requires authentication.
    """
    try:
        result = hype_generator_service.generate_hype(
            pr_title=request.pr_title,
            pr_body=request.pr_body or "",
            files_changed=request.files_changed or [],
            additions=request.additions,
            deletions=request.deletions,
            repo_name=request.repo_name
        )
        return result
    except Exception as e:
        logger.error(f"Hype generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# RAG Data Preparation Endpoints
# =============================================================================

@app.post("/rag/prepare")
async def rag_prepare(request: RAGDataPrepRequest):
    """
    Prepare documents for RAG vector database.
    
    Passes directly to rag_data_prep.prepare_documents()
    """
    try:
        result = rag_data_prep.prepare_documents(
            doc_types=request.doc_types,
            repo_names=request.repo_names,
            collection_name=request.collection_name
        )
        return {"success": True, "chunks_created": result}
    except Exception as e:
        logger.error(f"RAG prepare error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/rag/chunks")
async def get_rag_chunks(batch_size: int = 100, skip_embedded: bool = True):
    """Get chunks ready for embedding."""
    try:
        chunks = rag_data_prep.get_chunks_for_embedding(
            batch_size=batch_size,
            skip_embedded=skip_embedded
        )
        return {"chunks": chunks, "count": len(chunks)}
    except Exception as e:
        logger.error(f"RAG chunks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Run with: uvicorn main:app --host 0.0.0.0 --port 7860
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "7860"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENVIRONMENT", "development") != "production"
    )
