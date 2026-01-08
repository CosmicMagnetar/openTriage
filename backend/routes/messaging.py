from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from config.database import db
from models.messaging import Message, SendMessageRequest
from utils.dependencies import get_current_user
import uuid

router = APIRouter(prefix="/messaging", tags=["Messaging"])

@router.get("/history/{other_user_id}", response_model=List[Message])
async def get_chat_history(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """Fetch chat history between current user and other user."""
    # Get all identifiers for current user
    current_ids = [
        current_user.get("id"),  # UUID
        current_user.get("username"),
        str(current_user.get("_id", "")), # ObjectId
        str(current_user.get("githubId", "")) # GitHub ID
    ]
    current_ids = [i for i in current_ids if i]
    
    # Get all identifiers for other user
    search_criteria = [
        {"id": other_user_id}, 
        {"username": other_user_id},
        {"_id": other_user_id}
    ]
    if other_user_id.isdigit():
        search_criteria.append({"githubId": int(other_user_id)})
        
    other_user = await db.users.find_one(
        {"$or": search_criteria},
        {"_id": 1, "id": 1, "username": 1, "githubId": 1}
    )
    
    other_ids = [other_user_id]
    if other_user:
        other_ids.extend([
            other_user.get("id"),
            other_user.get("username"),
            str(other_user.get("_id", "")),
            str(other_user.get("githubId", ""))
        ])
    other_ids = [i for i in set(other_ids) if i]
    
    # Find messages where (sender=me AND receiver=other) OR (sender=other AND receiver=me)
    cursor = db.messages.find({
        "$or": [
            {"sender_id": {"$in": current_ids}, "receiver_id": {"$in": other_ids}},
            {"sender_id": {"$in": other_ids}, "receiver_id": {"$in": current_ids}}
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
    # Get all identifiers for current user
    current_ids = [
        current_user.get("id"),  # UUID
        current_user.get("username"),
        str(current_user.get("_id", "")), # ObjectId
        str(current_user.get("githubId", "")) # GitHub ID
    ]
    current_ids = [i for i in current_ids if i]
    
    # Get all identifiers for other user
    search_criteria = [
        {"id": other_user_id}, 
        {"username": other_user_id},
        {"_id": other_user_id}
    ]
    if other_user_id.isdigit():
        search_criteria.append({"githubId": int(other_user_id)})
        
    other_user = await db.users.find_one(
        {"$or": search_criteria},
        {"_id": 1, "id": 1, "username": 1, "githubId": 1}
    )
    
    other_ids = [other_user_id]
    if other_user:
        other_ids.extend([
            other_user.get("id"),
            other_user.get("username"),
            str(other_user.get("_id", "")),
            str(other_user.get("githubId", ""))
        ])
    other_ids = [i for i in set(other_ids) if i]
    
    query = {
        "$or": [
            {"sender_id": {"$in": current_ids}, "receiver_id": {"$in": other_ids}},
            {"sender_id": {"$in": other_ids}, "receiver_id": {"$in": current_ids}}
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
    # Get all identifiers for current user
    current_ids = [
        current_user.get("id"),  # UUID
        current_user.get("username"),
        str(current_user.get("_id", "")), # ObjectId
        str(current_user.get("githubId", "")) # GitHub ID
    ]
    current_ids = [i for i in current_ids if i]
    
    # Count unread messages where current user is the receiver (match any of aliases)
    count = await db.messages.count_documents({
        "receiver_id": {"$in": current_ids},
        "read": False
    })
    
    return {"count": count}


@router.post("/mark-read/{other_user_id}")
async def mark_messages_read(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """Mark all messages from a specific user as read."""
    # Get all identifiers for current user
    current_ids = [
        current_user.get("id"),  # UUID
        current_user.get("username"),
        str(current_user.get("_id", "")), # ObjectId
        str(current_user.get("githubId", "")) # GitHub ID
    ]
    current_ids = [i for i in current_ids if i]
    
    # Get all identifiers for other user
    search_criteria = [
        {"id": other_user_id}, 
        {"username": other_user_id},
        {"_id": other_user_id}
    ]
    if other_user_id.isdigit():
        search_criteria.append({"githubId": int(other_user_id)})
        
    other_user = await db.users.find_one(
        {"$or": search_criteria},
        {"_id": 1, "id": 1, "username": 1, "githubId": 1}
    )
    
    other_ids = [other_user_id]
    if other_user:
        other_ids.extend([
            other_user.get("id"),
            other_user.get("username"),
            str(other_user.get("_id", "")),
            str(other_user.get("githubId", ""))
        ])
    other_ids = [i for i in set(other_ids) if i]
    
    result = await db.messages.update_many(
        {
            "sender_id": {"$in": other_ids},
            "receiver_id": {"$in": current_ids},
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    return {"marked_read": result.modified_count}


@router.post("/seed-test-messages")
async def seed_test_messages(current_user: dict = Depends(get_current_user)):
    """Seed test messages for current user to demo chat functionality."""
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    current_username = current_user.get("username", "")
    
    now = datetime.now(timezone.utc)
    
    # Create test conversation with a mock mentor
    test_messages = [
        {
            "id": str(uuid.uuid4()),
            "sender_id": "test_mentor_123",
            "receiver_id": current_user_id,
            "content": "Hey! Welcome to OpenTriage. I'm here to help you get started with open source contributions.",
            "timestamp": (now - timedelta(hours=2)).isoformat(),
            "read": False
        },
        {
            "id": str(uuid.uuid4()),
            "sender_id": current_user_id,
            "receiver_id": "test_mentor_123",
            "content": "Thanks! I'm excited to start contributing.",
            "timestamp": (now - timedelta(hours=1, minutes=55)).isoformat(),
            "read": True
        },
        {
            "id": str(uuid.uuid4()),
            "sender_id": "test_mentor_123",
            "receiver_id": current_user_id,
            "content": "Great! Have you checked out the 'good first issue' labels? Those are perfect for beginners.",
            "timestamp": (now - timedelta(hours=1, minutes=50)).isoformat(),
            "read": False
        },
        {
            "id": str(uuid.uuid4()),
            "sender_id": current_user_id,
            "receiver_id": "test_mentor_123",
            "content": "Yes! I found one that looks interesting. Should I just comment that I want to work on it?",
            "timestamp": (now - timedelta(minutes=30)).isoformat(),
            "read": True
        },
        {
            "id": str(uuid.uuid4()),
            "sender_id": "test_mentor_123",
            "receiver_id": current_user_id,
            "content": "Exactly! Just comment 'I'd like to work on this' and wait for the maintainer to assign it to you. Let me know if you need any help!",
            "timestamp": (now - timedelta(minutes=25)).isoformat(),
            "read": False
        }
    ]
    
    # Create a test user entry for the mock mentor
    await db.users.update_one(
        {"id": "test_mentor_123"},
        {"$set": {
            "id": "test_mentor_123",
            "username": "test_mentor",
            "avatarUrl": "https://github.com/github.png"
        }},
        upsert=True
    )
    
    # Insert test messages
    await db.messages.insert_many(test_messages)
    
    return {
        "success": True,
        "message": f"Created {len(test_messages)} test messages with test_mentor",
        "messages_count": len(test_messages)
    }


@router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Get list of all conversation contacts with last message preview."""
    # Get all identifiers for current user
    current_ids = [
        current_user.get("id"),  # UUID
        current_user.get("username"),
        str(current_user.get("_id", "")), # ObjectId
        str(current_user.get("githubId", "")) # GitHub ID
    ]
    current_ids = [i for i in current_ids if i]
    
    # Get all unique users we've messaged with
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"sender_id": {"$in": current_ids}},
                    {"receiver_id": {"$in": current_ids}}
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
                        {"$in": ["$sender_id", current_ids]},
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
                                {"$in": ["$receiver_id", current_ids]},
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
    
    # Enrich and deduplicate by username
    conversations_map = {}
    
    for r in results:
        other_user_id = r["_id"]
        # Try to resolve user info with robust lookup
        search_criteria = [
            {"id": other_user_id}, 
            {"username": other_user_id},
            {"_id": other_user_id}
        ]
        if str(other_user_id).isdigit():
            search_criteria.append({"githubId": int(other_user_id)})
        
        # Add proper ObjectId lookup if valid
        if ObjectId.is_valid(other_user_id):
            search_criteria.append({"_id": ObjectId(other_user_id)})
            
        user_info = await db.users.find_one(
            {"$or": search_criteria},
            {"_id": 0, "id": 1, "username": 1, "avatarUrl": 1}
        )
        
        username = user_info.get("username", other_user_id) if user_info else str(other_user_id)
        
        if username not in conversations_map:
            conversations_map[username] = {
                "user_id": user_info.get("id") if user_info else other_user_id, # Prefer UUID if available
                "username": username,
                "avatar_url": user_info.get("avatarUrl") if user_info else None,
                "last_message": r.get("last_message", "")[:50],
                "last_timestamp": r.get("last_timestamp"),
                "unread_count": r.get("unread_count", 0)
            }
        else:
            # Merge with existing entry
            existing = conversations_map[username]
            # Update last message if this one is newer
            if r.get("last_timestamp") > existing["last_timestamp"]:
                existing["last_message"] = r.get("last_message", "")[:50]
                existing["last_timestamp"] = r.get("last_timestamp")
            
            # Sum unread counts
            existing["unread_count"] += r.get("unread_count", 0)
    
    # Convert map to list and sort
    conversations = list(conversations_map.values())
    conversations.sort(key=lambda x: x["last_timestamp"], reverse=True)
    
    return {"conversations": conversations}


# ============ Mentorship Request Management ============

from pydantic import BaseModel


class MentorshipRequestAction(BaseModel):
    request_id: str
    message: Optional[str] = None


@router.get("/mentorship/requests")
async def get_mentorship_requests(current_user: dict = Depends(get_current_user)):
    """Get pending mentorship requests for the current user (as mentor)."""
    # Get all identifiers for current user
    current_ids = [
        current_user.get("id"),  # UUID
        current_user.get("username"),
        str(current_user.get("_id", "")), # ObjectId
        str(current_user.get("githubId", "")) # GitHub ID
    ]
    current_ids = [i for i in current_ids if i]
    
    # Find requests where mentor_id matches ANY of the current user's IDs
    # OR mentor_username matches
    cursor = db.mentorship_requests.find({
        "$or": [
            {"mentor_id": {"$in": current_ids}},
            {"mentor_username": current_user.get("username", "")}
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

    # Check that mentee hasn't reached the limit (5)
    active_count = await db.mentorships.count_documents({
        "mentee_id": request.get("mentee_id"),
        "status": "active"
    })
    
    if active_count >= 5:
        # Optional: Cancel this request since they are full?
        # For now, just error out so the mentor knows
        raise HTTPException(status_code=400, detail="This mentee has reached the maximum number of mentors (5).")

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
    
    # Auto-cancel other pending requests if limit reached (active_count + 1 >= 5)
    if active_count + 1 >= 5:
        mentee_id = request.get("mentee_id")
        # Find other pending requests for this mentee
        await db.mentorship_requests.update_many(
            {
                "mentee_id": mentee_id,
                "status": "pending",
                "id": {"$ne": action.request_id} # Don't touch the one we just accepted (though status changed already)
            },
            {
                "$set": {
                    "status": "cancelled", 
                    "cancelled_reason": "Mentee reached maximum mentor limit",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
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
