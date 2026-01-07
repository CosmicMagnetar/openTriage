"""
RAG Chatbot API Routes for OpenTriage.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from utils.dependencies import get_current_user

from services.rag_chatbot_service import rag_chatbot_service

logger = logging.getLogger(__name__)
router = APIRouter()


# Request Models

class ChatQuestionRequest(BaseModel):
    question: str
    repo_name: Optional[str] = None
    top_k: int = 5


class SearchRequest(BaseModel):
    query: str
    repo_name: Optional[str] = None
    limit: int = 10


class IndexRepoRequest(BaseModel):
    repo_name: str


# Routes

@router.post("/chat")
async def ask_question(request: ChatQuestionRequest):
    """
    Ask the RAG chatbot a question about the project.
    """
    try:
        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")
        
        answer = await rag_chatbot_service.answer_question(
            question=request.question,
            repo_name=request.repo_name,
            top_k=request.top_k
        )
        
        return answer.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"RAG chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_documents(request: SearchRequest):
    """
    Search project documents and issues.
    """
    try:
        results = await rag_chatbot_service.search_documents(
            query=request.query,
            repo_name=request.repo_name,
            top_k=request.limit
        )
        
        return {
            "query": request.query,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/index")
async def index_repository(request: IndexRepoRequest, user: dict = Depends(get_current_user)):
    """
    Index a repository's content for RAG.
    """
    try:
        github_token = user.get('githubAccessToken')
        result = await rag_chatbot_service.index_repository(request.repo_name, github_token)
        return result
    except Exception as e:
        logger.error(f"Index error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suggestions")
async def get_suggested_questions(repo_name: Optional[str] = None):
    """
    Get suggested questions for the chatbot.
    """
    try:
        suggestions = await rag_chatbot_service.get_suggested_questions(repo_name)
        
        return {
            "repo_name": repo_name,
            "suggestions": suggestions
        }
    except Exception as e:
        logger.error(f"Suggestions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
