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
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    current_username = current_user.get("username", "")
    
    # Also get the other user's possible identifiers
    other_user = await db.users.find_one(
        {"$or": [{"id": other_user_id}, {"username": other_user_id}]},
        {"_id": 0, "id": 1, "username": 1}
    )
    
    # Build list of IDs to match
    my_ids = [current_user_id]
    if current_username:
        my_ids.append(current_username)
    
    other_ids = [other_user_id]
    if other_user:
        if other_user.get("id"):
            other_ids.append(str(other_user["id"]))
        if other_user.get("username"):
            other_ids.append(other_user["username"])
    
    # Find messages where (sender=me AND receiver=other) OR (sender=other AND receiver=me)
    cursor = db.messages.find({
        "$or": [
            {"sender_id": {"$in": my_ids}, "receiver_id": {"$in": other_ids}},
            {"sender_id": {"$in": other_ids}, "receiver_id": {"$in": my_ids}}
        ]
    }).sort("timestamp", 1)
    
    messages = await cursor.to_list(length=1000)
    return messages

@router.post("/send", response_model=Message)
async def send_message(request: SendMessageRequest, current_user: dict = Depends(get_current_user)):
    """Send a message to another user."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    
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
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    current_username = current_user.get("username", "")
    
    # Also get the other user's possible identifiers
    other_user = await db.users.find_one(
        {"$or": [{"id": other_user_id}, {"username": other_user_id}]},
        {"_id": 0, "id": 1, "username": 1}
    )
    
    # Build list of IDs to match
    my_ids = [current_user_id]
    if current_username:
        my_ids.append(current_username)
    
    other_ids = [other_user_id]
    if other_user:
        if other_user.get("id"):
            other_ids.append(str(other_user["id"]))
        if other_user.get("username"):
            other_ids.append(other_user["username"])
    
    query = {
        "$or": [
            {"sender_id": {"$in": my_ids}, "receiver_id": {"$in": other_ids}},
            {"sender_id": {"$in": other_ids}, "receiver_id": {"$in": my_ids}}
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


@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread messages for the current user."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    
    # Count unread messages where current user is the receiver
    count = await db.messages.count_documents({
        "receiver_id": current_user_id,
        "read": False
    })
    
    return {"count": count}


@router.post("/mark-read/{other_user_id}")
async def mark_messages_read(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """Mark all messages from a specific user as read."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    
    result = await db.messages.update_many(
        {
            "sender_id": other_user_id,
            "receiver_id": current_user_id,
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    return {"marked_read": result.modified_count}


@router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Get list of all conversation contacts with last message preview."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    
    # Get all unique users we've messaged with
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"sender_id": current_user_id},
                    {"receiver_id": current_user_id}
                ]
            }
        },
        {
            "$sort": {"timestamp": -1}
        },
        {
            "$group": {
                "_id": {
                    "$cond": [
                        {"$eq": ["$sender_id", current_user_id]},
                        "$receiver_id",
                        "$sender_id"
                    ]
                },
                "last_message": {"$first": "$content"},
                "last_timestamp": {"$first": "$timestamp"},
                "unread_count": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$eq": ["$receiver_id", current_user_id]},
                                {"$eq": ["$read", False]}
                            ]},
                            1, 0
                        ]
                    }
                }
            }
        },
        {
            "$sort": {"last_timestamp": -1}
        }
    ]
    
    results = await db.messages.aggregate(pipeline).to_list(length=50)
    
    # Enrich with user info
    conversations = []
    for r in results:
        other_user_id = r["_id"]
        # Try to get user info
        user_info = await db.users.find_one(
            {"$or": [{"id": other_user_id}, {"username": other_user_id}]},
            {"_id": 0, "username": 1, "avatarUrl": 1}
        )
        
        conversations.append({
            "user_id": other_user_id,
            "username": user_info.get("username", other_user_id) if user_info else other_user_id,
            "avatar_url": user_info.get("avatarUrl") if user_info else None,
            "last_message": r.get("last_message", "")[:50],
            "last_timestamp": r.get("last_timestamp"),
            "unread_count": r.get("unread_count", 0)
        })
    
    return {"conversations": conversations}


# ============ Mentorship Request Management ============

from pydantic import BaseModel


class MentorshipRequestAction(BaseModel):
    request_id: str
    message: Optional[str] = None


@router.get("/mentorship/requests")
async def get_mentorship_requests(current_user: dict = Depends(get_current_user)):
    """Get pending mentorship requests for the current user (as mentor)."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    username = current_user.get("username", "")
    
    # Find requests where this user is the mentor
    cursor = db.mentorship_requests.find({
        "$or": [
            {"mentor_id": current_user_id},
            {"mentor_username": username}
        ],
        "status": "pending"
    }, {"_id": 0})
    
    requests = await cursor.to_list(length=50)
    
    # Enrich with mentee info
    enriched = []
    for req in requests:
        mentee_id = req.get("mentee_id")
        mentee_info = await db.users.find_one(
            {"$or": [{"id": mentee_id}, {"username": mentee_id}]},
            {"_id": 0, "username": 1, "avatarUrl": 1}
        )
        
        enriched.append({
            **req,
            "mentee_username": mentee_info.get("username") if mentee_info else mentee_id,
            "mentee_avatar": mentee_info.get("avatarUrl") if mentee_info else None
        })
    
    return {"requests": enriched, "count": len(enriched)}


@router.post("/mentorship/accept")
async def accept_mentorship_request(action: MentorshipRequestAction, current_user: dict = Depends(get_current_user)):
    """Accept a mentorship request."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    username = current_user.get("username", "")
    
    # Find and update the request
    request = await db.mentorship_requests.find_one({"id": action.request_id})
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Verify this user is the mentor
    if request.get("mentor_id") != current_user_id and request.get("mentor_username") != username:
        raise HTTPException(status_code=403, detail="Not authorized to accept this request")
    
    # Update request status
    await db.mentorship_requests.update_one(
        {"id": action.request_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create mentorship relationship
    mentorship = {
        "id": str(uuid.uuid4()),
        "mentor_id": current_user_id,
        "mentor_username": username,
        "mentee_id": request.get("mentee_id"),
        "mentee_username": request.get("mentee_username"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    await db.mentorships.insert_one(mentorship)
    
    # Send welcome message if provided
    if action.message:
        welcome_msg = Message(
            sender_id=current_user_id,
            receiver_id=request.get("mentee_id"),
            content=action.message
        )
        await db.messages.insert_one(welcome_msg.model_dump())
    
    return {"success": True, "message": "Mentorship request accepted"}


@router.post("/mentorship/decline")
async def decline_mentorship_request(action: MentorshipRequestAction, current_user: dict = Depends(get_current_user)):
    """Decline a mentorship request."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    username = current_user.get("username", "")
    
    # Find the request
    request = await db.mentorship_requests.find_one({"id": action.request_id})
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Verify this user is the mentor
    if request.get("mentor_id") != current_user_id and request.get("mentor_username") != username:
        raise HTTPException(status_code=403, detail="Not authorized to decline this request")
    
    # Update request status
    await db.mentorship_requests.update_one(
        {"id": action.request_id},
        {"$set": {"status": "declined", "declined_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Mentorship request declined"}


@router.get("/mentees")
async def get_mentees(current_user: dict = Depends(get_current_user)):
    """Get list of active mentees for the current user (as mentor)."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    username = current_user.get("username", "")
    
    cursor = db.mentorships.find({
        "$or": [
            {"mentor_id": current_user_id},
            {"mentor_username": username}
        ],
        "status": "active"
    }, {"_id": 0})
    
    mentorships = await cursor.to_list(length=50)
    
    # Enrich with user info
    mentees = []
    for m in mentorships:
        mentee_id = m.get("mentee_id")
        mentee_info = await db.users.find_one(
            {"$or": [{"id": mentee_id}, {"username": mentee_id}]},
            {"_id": 0, "username": 1, "avatarUrl": 1}
        )
        
        mentees.append({
            "mentorship_id": m.get("id"),
            "user_id": mentee_id,
            "username": mentee_info.get("username") if mentee_info else m.get("mentee_username", mentee_id),
            "avatar_url": mentee_info.get("avatarUrl") if mentee_info else None,
            "since": m.get("created_at")
        })
    
    return {"mentees": mentees, "count": len(mentees)}


@router.delete("/mentees/{mentee_id}")
async def remove_mentee(mentee_id: str, current_user: dict = Depends(get_current_user)):
    """End mentorship relationship with a mentee."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    username = current_user.get("username", "")
    
    result = await db.mentorships.update_one(
        {
            "$or": [
                {"mentor_id": current_user_id},
                {"mentor_username": username}
            ],
            "mentee_id": mentee_id,
            "status": "active"
        },
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mentorship not found")
    
    return {"success": True, "message": "Mentorship ended"}
