"""
Mentorship Chat API Routes for OpenTriage.
Includes WebSocket endpoint for real-time messaging.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from services.mentorship_chat_service import mentorship_chat_service, ConnectionManager

logger = logging.getLogger(__name__)
router = APIRouter()


# Request Models

class CreateSessionRequest(BaseModel):
    mentor_id: str
    mentor_username: str
    mentee_id: str
    mentee_username: str
    issue_id: Optional[str] = None
    repo_name: Optional[str] = None
    topic: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str
    message_type: str = "text"
    language: Optional[str] = None


class ReactionRequest(BaseModel):
    message_id: str
    emoji: str


# HTTP Routes

@router.post("/session")
async def create_chat_session(request: CreateSessionRequest):
    """
    Create a new mentorship chat session.
    """
    try:
        session = await mentorship_chat_service.create_session(
            mentor_id=request.mentor_id,
            mentor_username=request.mentor_username,
            mentee_id=request.mentee_id,
            mentee_username=request.mentee_username,
            issue_id=request.issue_id,
            repo_name=request.repo_name,
            topic=request.topic
        )
        
        return {
            "status": "created",
            "session": session.model_dump()
        }
    except Exception as e:
        logger.error(f"Create session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """
    Get chat session details.
    """
    try:
        session = await mentorship_chat_service.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return session.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{user_id}")
async def get_user_sessions(user_id: str, active_only: bool = True):
    """
    Get all chat sessions for a user.
    """
    try:
        sessions = await mentorship_chat_service.get_user_sessions(
            user_id=user_id,
            active_only=active_only
        )
        
        return {
            "user_id": user_id,
            "count": len(sessions),
            "sessions": [s.model_dump() for s in sessions]
        }
    except Exception as e:
        logger.error(f"Get user sessions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/history")
async def get_chat_history(
    session_id: str,
    limit: int = 100
):
    """
    Get message history for a session.
    """
    try:
        messages = await mentorship_chat_service.get_chat_history(
            session_id=session_id,
            limit=limit
        )
        
        return {
            "session_id": session_id,
            "count": len(messages),
            "messages": [m.model_dump() for m in messages]
        }
    except Exception as e:
        logger.error(f"Get history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/message")
async def send_message_http(
    session_id: str,
    request: SendMessageRequest,
    sender_id: str,
    sender_username: str
):
    """
    Send a message (HTTP fallback for non-WebSocket clients).
    """
    try:
        message = await mentorship_chat_service.send_message(
            session_id=session_id,
            sender_id=sender_id,
            sender_username=sender_username,
            content=request.content,
            message_type=request.message_type,
            language=request.language
        )
        
        return message.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Send message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/end")
async def end_session(session_id: str):
    """
    End a chat session and generate summary.
    """
    try:
        session = await mentorship_chat_service.end_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "status": "ended",
            "session": session.model_dump()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"End session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/summary")
async def get_session_summary(session_id: str):
    """
    Get or generate summary for a session.
    """
    try:
        summary = await mentorship_chat_service.generate_session_summary(session_id)
        
        if not summary:
            raise HTTPException(status_code=404, detail="No messages to summarize")
        
        return summary.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reaction")
async def add_reaction(request: ReactionRequest, user_id: str):
    """
    Add a reaction to a message.
    """
    try:
        success = await mentorship_chat_service.add_reaction(
            message_id=request.message_id,
            user_id=user_id,
            emoji=request.emoji
        )
        
        return {"added": success}
    except Exception as e:
        logger.error(f"Add reaction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket Route

@router.websocket("/ws/{session_id}/{user_id}")
async def websocket_chat(
    websocket: WebSocket,
    session_id: str,
    user_id: str
):
    """
    WebSocket endpoint for real-time chat.
    """
    await mentorship_chat_service.connection_manager.connect(
        websocket, session_id, user_id
    )
    
    try:
        # Send chat history on connect
        history = await mentorship_chat_service.get_chat_history(session_id, limit=50)
        await websocket.send_json({
            "type": "history",
            "messages": [m.model_dump() for m in history]
        })
        
        # Listen for messages
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                message = await mentorship_chat_service.send_message(
                    session_id=session_id,
                    sender_id=user_id,
                    sender_username=data.get("username", "Unknown"),
                    content=data.get("content", ""),
                    message_type=data.get("message_type", "text"),
                    language=data.get("language")
                )
                # Message is broadcast automatically in send_message
                
            elif data.get("type") == "reaction":
                await mentorship_chat_service.add_reaction(
                    message_id=data.get("message_id"),
                    user_id=user_id,
                    emoji=data.get("emoji", "👍")
                )
                
            elif data.get("type") == "typing":
                # Broadcast typing indicator
                await mentorship_chat_service.connection_manager.broadcast_to_session(
                    session_id,
                    {"type": "typing", "user_id": user_id}
                )
                
    except WebSocketDisconnect:
        mentorship_chat_service.connection_manager.disconnect(
            websocket, session_id, user_id
        )
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        mentorship_chat_service.connection_manager.disconnect(
            websocket, session_id, user_id
        )
