"""
OpenTriage AI Engine - Full-Featured Backend

Lift-and-shift deployment of the original Python AI backend.
All service logic is preserved exactly as-is from the original codebase.

Designed for Hugging Face Spaces deployment.

Build: 2026-02-09 v2.1 - Fixed import issues, added README cache
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
from services.sentiment_analysis_service import sentiment_analysis_service
from services.mentor_leaderboard_service import mentor_leaderboard_service

# Import models for request/response types
from models.issue import Issue
from models.mentor_leaderboard import (
    MentorLeaderboardEntry,
    LeaderboardResponse,
    LeaderboardEdit
)


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
    version="2.1.0",
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


class ImpactSummaryRequest(BaseModel):
    """Request for impact summary generation"""
    pr_title: str
    pr_body: Optional[str] = ""
    repo_name: str
    files_changed: int = 0
    additions: int = 0
    deletions: int = 0


class RAGIndexRequest(BaseModel):
    """Request for RAG indexing - matches rag_chatbot_service.index_repository()"""
    repo_name: str
    github_access_token: Optional[str] = None


class RAGDataPrepRequest(BaseModel):
    """Request for RAG data prep - matches rag_data_prep.prepare_documents()"""
    doc_types: Optional[List[str]] = ["issue", "pr", "comment"]
    repo_names: Optional[List[str]] = None
    collection_name: str = "rag_chunks"


class CommentSentimentRequest(BaseModel):
    """Request for sentiment analysis of a single comment"""
    comment_id: str
    body: str
    author: Optional[str] = "unknown"
    force_recalc: bool = False


class BatchCommentSentimentRequest(BaseModel):
    """Request for sentiment analysis of multiple comments"""
    comments: List[Dict[str, Any]]
    # Each comment dict should have: id, body, author (optional)


class LeaderboardEditRequest(BaseModel):
    """Request to edit a leaderboard entry"""
    mentor_id: str
    edited_by: str  # Maintainer username
    reason: Optional[str] = None
    # Can update:
    custom_notes: Optional[str] = None
    sentiment_score: Optional[float] = None
    expertise_score: Optional[float] = None
    engagement_score: Optional[float] = None
    best_language: Optional[str] = None


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


@app.post("/debug/test-openrouter")
async def test_openrouter(auth: dict = Depends(require_api_key_or_auth)):
    """Test OpenRouter API connectivity."""
    try:
        from openai import OpenAI
        from config.settings import settings
        
        api_key = settings.OPENROUTER_API_KEY
        if not api_key:
            return {
                "status": "error",
                "message": "OPENROUTER_API_KEY not configured",
                "api_key_configured": False
            }
        
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        
        # Try a simple completion
        response = client.chat.completions.create(
            model="meta-llama/llama-3.3-70b-instruct:free",
            messages=[
                {"role": "user", "content": "Say 'test successful' in one word"}
            ],
            temperature=0.7,
            max_tokens=10
        )
        
        return {
            "status": "success",
            "message": "OpenRouter API is working",
            "response": response.choices[0].message.content,
            "api_key_configured": True
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "api_key_configured": bool(settings.OPENROUTER_API_KEY)
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


@app.get("/rag/check-index")
async def check_rag_index(
    repo_name: str,
    auth: dict = Depends(require_api_key_or_auth)
):
    """
    Check how many chunks are indexed for a repository.
    
    Query params:
        repo_name: Repository name (owner/repo format)
    
    Returns:
        {"repo_name": str, "chunk_count": int}
    """
    from config.database import db
    
    try:
        # Count documents in MongoDB rag_chunks collection
        count = await db.rag_chunks.count_documents({"sourceRepo": repo_name})
        
        return {
            "repo_name": repo_name,
            "chunk_count": count
        }
    except Exception as e:
        logger.error(f"Failed to check RAG index for {repo_name}: {e}")
        return {
            "repo_name": repo_name,
            "chunk_count": 0,
            "error": str(e)
        }



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


@app.post("/hype/impact-summary")
async def generate_impact_summary(request: ImpactSummaryRequest, auth: dict = Depends(require_api_key_or_auth)):
    """
    Generate a short impact summary for a merged PR.
    
    Returns a motivating one-liner to show in the celebration popup.
    Requires authentication.
    """
    try:
        summary = await hype_generator_service.generate_impact_summary(
            pr_title=request.pr_title,
            pr_body=request.pr_body or "",
            repo_name=request.repo_name,
            files_changed=request.files_changed,
            additions=request.additions,
            deletions=request.deletions
        )
        return {"impact_summary": summary}
    except Exception as e:
        logger.error(f"Impact summary generation error: {e}")
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
# Sentiment Analysis Endpoints (Stage 3 Integration)
# =============================================================================

@app.post("/sentiment/analyze")
async def analyze_comment_sentiment(request: CommentSentimentRequest):
    """
    Analyze sentiment of a single PR comment using DistilBERT.
    
    Returns:
    - sentiment_label: "POSITIVE" or "NEGATIVE"
    - sentiment_score: Confidence (0.0-1.0)
    - prominent_language: Detected language category (technical, positive, negative, etc.)
    
    Used in Stage 3 RAG prompt: "The reviewers' sentiment is {sentiment_label}...
    with focus on {prominent_language} aspects"
    """
    try:
        result = sentiment_analysis_service.analyze_comment(
            comment_id=request.comment_id,
            comment_text=request.body,
            author=request.author,
            force_recalc=request.force_recalc
        )
        return result
    except Exception as e:
        logger.error(f"Sentiment analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sentiment/analyze-batch")
async def analyze_batch_sentiment(request: BatchCommentSentimentRequest):
    """
    Analyze sentiment for multiple comments at once.
    
    Each comment should have:
    - id: Comment identifier
    - body: Comment text
    - author: (optional) Comment author
    
    Returns List of sentiment results + summary stats
    """
    try:
        results = sentiment_analysis_service.analyze_batch(request.comments)
        
        # Get summary overview
        summary = sentiment_analysis_service.get_summary(results)
        
        return {
            "comments": results,
            "summary": summary,
            "total_analyzed": len(results)
        }
    except Exception as e:
        logger.error(f"Batch sentiment analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sentiment/summary")
async def get_sentiment_summary(repo_name: Optional[str] = None):
    """
    Get sentiment summary for comments (if you have them cached).
    
    For Stage 3 prompt input, this helps determine:
    - Is the review tone supportive or critical?
    - Are reviewers focused on technical debt or new features?
    """
    try:
        # In a real implementation, fetch comments from DB for this repo
        # For now, return cache stats
        cache_stats = sentiment_analysis_service.get_cache_stats()
        
        return {
            "cache_status": cache_stats,
            "message": "Sentiment analysis service is ready. Send /sentiment/analyze-batch with comments to get summary."
        }
    except Exception as e:
        logger.error(f"Sentiment summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sentiment/clear-cache")
async def clear_sentiment_cache(auth: dict = Depends(require_api_key_or_auth)):
    """
    Clear the sentiment analysis cache (admin only).
    
    Useful if you've updated keywords or want fresh analysis.
    """
    try:
        sentiment_analysis_service.clear_cache()
        return {"message": "Sentiment analysis cache cleared", "status": "success"}
    except Exception as e:
        logger.error(f"Cache clear error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Mentor Leaderboard Endpoints (AI-Powered Rankings with Sentiment)
# =============================================================================

@app.post("/leaderboard/generate")
async def generate_leaderboard(
    exclude_maintainer: Optional[str] = None,
    auth: dict = Depends(require_api_key_or_auth)
):
    """
    Generate the mentor leaderboard from scratch.
    
    This endpoint:
    1. Fetches all mentor conversations
    2. Analyzes sentiment of each conversation using DistilBERT
    3. Detects programming languages mentioned
    4. Ranks mentors by: Sentiment (35%) + Expertise (40%) + Engagement (25%)
    
    Returns ranked mentors with scores for each component.
    
    **Parameters:**
    - exclude_maintainer: User ID of maintainer to exclude from rankings
    
    **Returns leaderboard with:**
    - overall_score: Weighted ranking score (0-100)
    - sentiment_score: Quality of mentorship interactions
    - expertise_score: Programming language proficiency
    - best_language: Top detected language
    - rank: Current position
    """
    try:
        logger.info(f"Generating leaderboard (exclude_maintainer={exclude_maintainer})...")
        result = await mentor_leaderboard_service.generate_leaderboard(
            exclude_maintainer_id=exclude_maintainer
        )
        return result
    except Exception as e:
        logger.error(f"Leaderboard generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/leaderboard")
async def get_leaderboard(
    limit: int = 50,
    skip: int = 0,
    auth: dict = Depends(require_api_key_or_auth)
):
    """
    Get the cached mentor leaderboard.
    
    Returns top mentors with their rankings.
    
    **Query Parameters:**
    - limit: Number of entries to return (default: 50)
    - skip: Number to skip for pagination (default: 0)
    """
    try:
        result = await mentor_leaderboard_service.get_leaderboard(
            limit=limit,
            skip=skip
        )
        return result
    except Exception as e:
        logger.error(f"Get leaderboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/leaderboard/mentor/{mentor_id}")
async def get_mentor_leaderboard_entry(
    mentor_id: str,
    auth: dict = Depends(require_api_key_or_auth)
):
    """
    Get leaderboard entry for a specific mentor.
    
    Returns their ranking, scores, language proficiency, and edit history.
    """
    try:
        entry = await mentor_leaderboard_service.get_entry(mentor_id)
        if not entry:
            raise HTTPException(status_code=404, detail=f"Mentor {mentor_id} not in leaderboard")
        return entry
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get mentor entry error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/leaderboard/edit")
async def edit_leaderboard_entry(
    request: LeaderboardEditRequest,
    auth: dict = Depends(require_api_key_or_auth)
):
    """
    Edit a leaderboard entry (maintainer only).
    
    Allows manual adjustments to mentor rankings. All edits are tracked.
    
    **Editable fields:**
    - custom_notes: Custom notes about this mentor
    - sentiment_score: Adjust sentiment component (0-100)
    - expertise_score: Adjust expertise component (0-100)
    - engagement_score: Adjust engagement component (0-100)
    - best_language: Override detected language
    
    **All edits are recorded in:**
    - edit_history: List of all changes with timestamp and reason
    - is_custom_edited: Flag marking entry as manually tweaked
    - last_edited_by: Who made the edit
    """
    try:
        # Build update dict from request
        updates = {
            "edited_by": request.edited_by,
            "reason": request.reason
        }
        
        if request.custom_notes is not None:
            updates["custom_notes"] = request.custom_notes
        if request.sentiment_score is not None:
            updates["score_sentiment"] = request.sentiment_score
        if request.expertise_score is not None:
            updates["score_expertise"] = request.expertise_score
        if request.engagement_score is not None:
            updates["score_engagement"] = request.engagement_score
        if request.best_language is not None:
            updates["best_language"] = request.best_language
        
        entry = await mentor_leaderboard_service.edit_entry(
            request.mentor_id,
            **updates
        )
        return entry
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Edit leaderboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/leaderboard/export")
async def export_leaderboard(
    format: str = "json",
    auth: dict = Depends(require_api_key_or_auth)
):
    """
    Export leaderboard in various formats.
    
    **Formats:**
    - json: Full JSON with all fields
    - csv: Simplified CSV for spreadsheets
    """
    try:
        if format not in ["json", "csv"]:
            raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")
        
        data = await mentor_leaderboard_service.export_leaderboard(format)
        
        if format == "csv":
            return {
                "format": "csv",
                "data": data,
                "message": "Copy this data into a CSV file"
            }
        
        return {
            "format": "json",
            "data": data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export leaderboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))




if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "7860"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENVIRONMENT", "development") != "production"
    )
