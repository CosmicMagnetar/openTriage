from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid
import logging
from config.database import db
from models.chat import ChatHistory
from utils.dependencies import get_current_user
from services.ai_service import ai_chat_service

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    context: Optional[dict] = None


@router.get("/test-ai")
async def test_ai(user: dict = Depends(get_current_user)):
    """Test AI service endpoint."""
    try:
        response = await ai_chat_service.chat(
            message="Hello, AI!", history=[], context={}
        )
        return {"response": response}
    except Exception as e:
        logger.error(f"AI test endpoint error: {e}")
        raise HTTPException(status_code=500, detail="AI service unavailable")


@router.post("/chat")
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    """Send a message to the AI chat assistant."""
    try:
        session_id = request.sessionId or str(uuid.uuid4())
        history_doc = await db.chat_history.find_one(
            {"userId": user['id'], "sessionId": session_id},
            {"_id": 0}
        )
        history = history_doc['messages'] if history_doc else []
        
        response = await ai_chat_service.chat(
            message=request.message,
            history=history,
            context=request.context
        )
        
        history.append({"role": "user", "content": request.message})
        history.append({"role": "assistant", "content": response})
        
        if history_doc:
            await db.chat_history.update_one(
                {"userId": user['id'], "sessionId": session_id},
                {"$set": {"messages": history}}
            )
        else:
            chat_hist = ChatHistory(
                userId=user['id'],
                sessionId=session_id,
                messages=history
            )
            hist_dict = chat_hist.model_dump()
            hist_dict['createdAt'] = hist_dict['createdAt'].isoformat()
            await db.chat_history.insert_one(hist_dict)
        
        return {"response": response, "sessionId": session_id}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/history")
async def get_chat_history(sessionId: str, user: dict = Depends(get_current_user)):
    """Get chat history for a session."""
    history_doc = await db.chat_history.find_one({
        "userId": user["id"],
        "sessionId": sessionId
    }, {"_id": 0})
    if not history_doc:
        raise HTTPException(status_code=404, detail="Chat history not found")
    return {"messages": history_doc.get("messages", [])}
