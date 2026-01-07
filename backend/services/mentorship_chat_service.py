"""
Mentorship Chat Service for OpenTriage.
WebSocket-based real-time messaging for mentor-mentee communication.
"""
import logging
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, timezone, timedelta
import asyncio
import json

from models.chat_session import ChatSession, ChatMessage, SessionSummary, SessionStatus, SessionType

from config.settings import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for chat."""
    
    def __init__(self):
        # session_id -> set of websocket connections
        self.active_connections: Dict[str, Set] = {}
        # user_id -> session_ids they're in
        self.user_sessions: Dict[str, Set[str]] = {}
    
    async def connect(self, websocket, session_id: str, user_id: str):
        """Add a connection to a session."""
        await websocket.accept()
        
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)
        
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = set()
        self.user_sessions[user_id].add(session_id)
        
        logger.info(f"User {user_id} connected to session {session_id}")
    
    def disconnect(self, websocket, session_id: str, user_id: str):
        """Remove a connection from a session."""
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        
        if user_id in self.user_sessions:
            self.user_sessions[user_id].discard(session_id)
        
        logger.info(f"User {user_id} disconnected from session {session_id}")
    
    async def broadcast_to_session(self, session_id: str, message: dict):
        """Send message to all connections in a session."""
        if session_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add(connection)
            
            # Clean up disconnected
            for conn in disconnected:
                self.active_connections[session_id].discard(conn)


class MentorshipChatService:
    """
    Service for managing mentorship chat sessions.
    
    Features:
    - Real-time WebSocket messaging
    - Session management
    - AI-generated session summaries
    - Resource extraction from chat
    """
    
    def __init__(self):
        self.connection_manager = ConnectionManager()
    
    async def create_session(
        self,
        mentor_id: str,
        mentor_username: str,
        mentee_id: str,
        mentee_username: str,
        issue_id: Optional[str] = None,
        repo_name: Optional[str] = None,
        topic: Optional[str] = None
    ) -> ChatSession:
        """
        Create a new mentorship chat session.
        
        Args:
            mentor_id: Mentor's user ID
            mentor_username: Mentor's username
            mentee_id: Mentee's user ID
            mentee_username: Mentee's username
            issue_id: Optional related issue
            repo_name: Optional repository context
            topic: Optional session topic
            
        Returns:
            Created ChatSession
        """
        from config.database import db
        
        session = ChatSession(
            mentor_id=mentor_id,
            mentor_username=mentor_username,
            mentee_ids=[mentee_id],
            mentee_usernames=[mentee_username],
            session_type=SessionType.ONE_ON_ONE,
            issue_id=issue_id,
            repo_name=repo_name,
            topic=topic
        )
        
        session_dict = session.model_dump()
        session_dict['started_at'] = session_dict['started_at'].isoformat()
        session_dict['last_activity_at'] = session_dict['last_activity_at'].isoformat()
        session_dict['session_type'] = session.session_type.value
        session_dict['status'] = session.status.value
        
        await db.chat_sessions.insert_one(session_dict)
        
        logger.info(f"Created chat session {session.id} between {mentor_username} and {mentee_username}")
        return session
    
    async def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Get a chat session by ID."""
        from config.database import db
        
        session = await db.chat_sessions.find_one(
            {"id": session_id},
            {"_id": 0}
        )
        
        if session:
            return ChatSession(**session)
        return None
    
    async def get_user_sessions(
        self,
        user_id: str,
        active_only: bool = True
    ) -> List[ChatSession]:
        """Get all sessions for a user."""
        from config.database import db
        
        query = {
            "$or": [
                {"mentor_id": user_id},
                {"mentee_ids": user_id}
            ]
        }
        
        if active_only:
            query["status"] = SessionStatus.ACTIVE.value
        
        cursor = db.chat_sessions.find(query, {"_id": 0}).sort("last_activity_at", -1)
        sessions = await cursor.to_list(length=50)
        
        return [ChatSession(**s) for s in sessions]
    
    async def send_message(
        self,
        session_id: str,
        sender_id: str,
        sender_username: str,
        content: str,
        message_type: str = "text",
        language: Optional[str] = None
    ) -> ChatMessage:
        """
        Send a message in a session.
        
        Args:
            session_id: Session ID
            sender_id: Sender's user ID
            sender_username: Sender's username
            content: Message content
            message_type: Type of message (text, code, link)
            language: Programming language for code
            
        Returns:
            Created ChatMessage
        """
        from config.database import db
        
        # Get session to determine if sender is mentor
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        is_mentor = sender_id == session.mentor_id
        
        # Check for resources in message
        contains_resource = False
        resource_id = None
        
        try:
            from services.resource_vault_service import resource_vault_service
            extraction = await resource_vault_service.extract_resources_from_message(
                message=content,
                author=sender_username,
                author_id=sender_id,
                repo_name=session.repo_name or "",
                source_type="chat",
                source_id=session_id
            )
            
            if extraction.extracted_resources:
                contains_resource = True
                saved_ids = await resource_vault_service.save_extracted_resources(extraction)
                resource_id = saved_ids[0] if saved_ids else None
        except Exception as e:
            logger.debug(f"Resource extraction skipped: {e}")
        
        # Create message
        message = ChatMessage(
            session_id=session_id,
            sender_id=sender_id,
            sender_username=sender_username,
            is_mentor=is_mentor,
            content=content,
            message_type=message_type,
            language=language,
            contains_resource=contains_resource,
            extracted_resource_id=resource_id
        )
        
        message_dict = message.model_dump()
        message_dict['timestamp'] = message_dict['timestamp'].isoformat()
        
        await db.chat_messages.insert_one(message_dict)
        
        # Update session
        await db.chat_sessions.update_one(
            {"id": session_id},
            {
                "$set": {"last_activity_at": datetime.now(timezone.utc).isoformat()},
                "$inc": {"message_count": 1}
            }
        )
        
        # Broadcast to connected clients
        broadcast_data = {
            "type": "message",
            "message": message_dict
        }
        await self.connection_manager.broadcast_to_session(session_id, broadcast_data)
        
        return message
    
    async def get_chat_history(
        self,
        session_id: str,
        limit: int = 100,
        before: Optional[datetime] = None
    ) -> List[ChatMessage]:
        """Get message history for a session."""
        from config.database import db
        
        query = {"session_id": session_id}
        if before:
            query["timestamp"] = {"$lt": before.isoformat()}
        
        cursor = db.chat_messages.find(query, {"_id": 0}).sort(
            "timestamp", -1
        ).limit(limit)
        
        messages = await cursor.to_list(length=limit)
        messages.reverse()  # Oldest first
        
        return [ChatMessage(**m) for m in messages]
    
    async def end_session(self, session_id: str) -> Optional[ChatSession]:
        """End a chat session and generate summary."""
        from config.database import db
        
        # Generate summary
        summary = await self.generate_session_summary(session_id)
        
        # Update session
        result = await db.chat_sessions.update_one(
            {"id": session_id},
            {
                "$set": {
                    "status": SessionStatus.COMPLETED.value,
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "summary": summary.overview if summary else None,
                    "key_points": summary.key_takeaways if summary else []
                }
            }
        )
        
        if result.modified_count > 0:
            return await self.get_session(session_id)
        return None
    
    async def generate_session_summary(self, session_id: str) -> Optional[SessionSummary]:
        """
        Generate AI summary of a chat session.
        
        Args:
            session_id: Session to summarize
            
        Returns:
            SessionSummary with key points and takeaways
        """
        from openai import OpenAI
        
        # Get messages
        messages = await self.get_chat_history(session_id, limit=200)
        
        if not messages:
            return None
        
        # Build conversation text
        conversation = "\n".join([
            f"{'[Mentor]' if m.is_mentor else '[Mentee]'} {m.sender_username}: {m.content[:200]}"
            for m in messages
        ])
        
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.OPENROUTER_API_KEY
        )
        
        try:
            response = client.chat.completions.create(
                model="google/gemini-2.0-flash-001",
                messages=[
                    {
                        "role": "system",
                        "content": """Summarize this mentorship chat session. Provide:
1. A brief overview (2-3 sentences)
2. Main topics discussed (3-5 bullet points)
3. Key takeaways for the mentee (2-4 bullet points)
4. Any action items mentioned

Format as JSON with keys: overview, topics, takeaways, action_items"""
                    },
                    {"role": "user", "content": conversation}
                ],
                max_tokens=400,
                temperature=0.3
            )
            
            content = response.choices[0].message.content.strip()
            
            # Parse JSON response
            try:
                import json
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                
                data = json.loads(content)
                
                return SessionSummary(
                    session_id=session_id,
                    overview=data.get("overview", ""),
                    topics_discussed=data.get("topics", []),
                    key_takeaways=data.get("takeaways", []),
                    action_items=data.get("action_items", []),
                    total_messages=len(messages),
                    mentor_messages=sum(1 for m in messages if m.is_mentor),
                    mentee_messages=sum(1 for m in messages if not m.is_mentor)
                )
            except json.JSONDecodeError:
                return SessionSummary(
                    session_id=session_id,
                    overview=content[:500],
                    total_messages=len(messages)
                )
                
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return SessionSummary(
                session_id=session_id,
                overview="Session completed. Summary generation unavailable.",
                total_messages=len(messages)
            )
    
    async def add_reaction(
        self,
        message_id: str,
        user_id: str,
        emoji: str
    ) -> bool:
        """Add a reaction to a message."""
        from config.database import db
        
        result = await db.chat_messages.update_one(
            {"id": message_id},
            {"$addToSet": {f"reactions.{emoji}": user_id}}
        )
        
        return result.modified_count > 0


# Singleton instance
mentorship_chat_service = MentorshipChatService()
