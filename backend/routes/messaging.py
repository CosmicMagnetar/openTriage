from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone

from config.database import db
from models.messaging import Message, SendMessageRequest
from utils.dependencies import get_current_user
import uuid

router = APIRouter(prefix="/messaging", tags=["Messaging"])

@router.get("/history/{other_user_id}", response_model=List[Message])
async def get_chat_history(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """Fetch chat history between current user and other user."""
    current_user_id = str(current_user["_id"])
    
    # Find messages where (sender=me AND receiver=other) OR (sender=other AND receiver=me)
    cursor = db.messages.find({
        "$or": [
            {"sender_id": current_user_id, "receiver_id": other_user_id},
            {"sender_id": other_user_id, "receiver_id": current_user_id}
        ]
    }).sort("timestamp", 1)
    
    messages = await cursor.to_list(length=1000)
    return messages

@router.post("/send", response_model=Message)
async def send_message(request: SendMessageRequest, current_user: dict = Depends(get_current_user)):
    """Send a message to another user."""
    current_user_id = str(current_user["_id"])
    
    # Create message
    message = Message(
        sender_id=current_user_id,
        receiver_id=request.receiver_id,
        content=request.content
    )
    
    # Save to DB
    await db.messages.insert_one(message.model_dump())
    
    return message

@router.get("/poll/{other_user_id}", response_model=List[Message])
async def poll_messages(
    other_user_id: str, 
    last_message_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Poll for new messages from a specific user."""
    current_user_id = str(current_user["_id"])
    
    query = {
        "$or": [
            {"sender_id": current_user_id, "receiver_id": other_user_id},
            {"sender_id": other_user_id, "receiver_id": current_user_id}
        ]
    }
    
    # If last_message_id provided, filter for messages created after it
    if last_message_id:
        last_msg = await db.messages.find_one({"id": last_message_id})
        if last_msg:
             query["timestamp"] = {"$gt": last_msg["timestamp"]}
    
    cursor = db.messages.find(query).sort("timestamp", 1)
    messages = await cursor.to_list(length=100)
    
    return messages
