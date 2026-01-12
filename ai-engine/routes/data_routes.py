"""
Data Routes for AI Engine

These routes handle data operations (contributor dashboard, messaging, auth)
that require MongoDB access. They are added here since the ai-engine is
what's deployed on Hugging Face Spaces.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
import jwt
import os

from config.database import db
from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# =============================================================================
# Auth Helpers
# =============================================================================

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Extract and verify JWT token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization[7:]  # Remove "Bearer "
    
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Fetch user from database
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def create_jwt_token(user_id: str, role: str = None) -> str:
    """Create a JWT token for a user."""
    import time
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": int(time.time()) + 30 * 24 * 60 * 60  # 30 days
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


# =============================================================================
# Request Models
# =============================================================================

class SelectRoleRequest(BaseModel):
    role: str


class SendMessageRequest(BaseModel):
    receiver_id: str
    content: str


# =============================================================================
# Auth Routes
# =============================================================================

@router.get("/api/auth/me")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """Get current authenticated user information."""
    return {
        "id": user.get("id"),
        "username": user.get("username"),
        "avatarUrl": user.get("avatarUrl"),
        "role": user.get("role"),
        "githubId": user.get("githubId"),
    }


@router.post("/api/auth/select-role")
async def select_role(request: SelectRoleRequest, user: dict = Depends(get_current_user)):
    """Select user role (MAINTAINER or CONTRIBUTOR)."""
    role = request.role.upper()
    if role not in ["MAINTAINER", "CONTRIBUTOR"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be MAINTAINER or CONTRIBUTOR")
    
    # Update user role in database
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"role": role, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Generate new token with updated role
    new_token = create_jwt_token(user["id"], role)
    
    return {
        "success": True,
        "role": role,
        "token": new_token,
    }


# =============================================================================
# Contributor Routes
# =============================================================================

@router.get("/api/contributor/my-issues")
async def get_my_issues(
    page: int = 1,
    limit: int = 10,
    user: dict = Depends(get_current_user)
):
    """Get paginated issues and PRs created by the contributor."""
    page = max(1, page)
    limit = min(max(1, limit), 50)
    skip = (page - 1) * limit
    
    # Get total count
    total = await db.issues.count_documents({"authorName": user["username"]})
    
    # Get paginated issues
    issues = await db.issues.find(
        {"authorName": user["username"]},
        {"_id": 0}
    ).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with triage data
    for issue in issues:
        triage = await db.triage_data.find_one({"issueId": issue.get("id")}, {"_id": 0})
        issue["triage"] = triage
    
    total_pages = (total + limit - 1) // limit
    
    return {
        "items": issues,
        "total": total,
        "page": page,
        "pages": total_pages,
        "limit": limit
    }


@router.get("/api/contributor/dashboard-summary")
async def get_contributor_dashboard_summary(user: dict = Depends(get_current_user)):
    """Get dashboard summary statistics for contributor."""
    all_items = await db.issues.find(
        {"authorName": user["username"]},
        {"_id": 0}
    ).to_list(1000)
    
    total_contributions = len(all_items)
    prs = [item for item in all_items if item.get("isPR")]
    issues = [item for item in all_items if not item.get("isPR")]
    
    open_prs = len([pr for pr in prs if pr.get("state") == "open"])
    merged_prs = len([pr for pr in prs if pr.get("state") == "closed"])
    
    open_issues = len([issue for issue in issues if issue.get("state") == "open"])
    closed_issues = len([issue for issue in issues if issue.get("state") == "closed"])
    
    unique_repos = len(set(item.get("repoName", "") for item in all_items if item.get("repoName")))
    
    return {
        "totalContributions": total_contributions,
        "totalPRs": len(prs),
        "openPRs": open_prs,
        "mergedPRs": merged_prs,
        "totalIssues": len(issues),
        "openIssues": open_issues,
        "closedIssues": closed_issues,
        "repositoriesContributed": unique_repos
    }


@router.get("/api/contributor/issues/{issue_id}/comments")
async def get_issue_comments(issue_id: str, user: dict = Depends(get_current_user)):
    """Get comments for a specific issue from GitHub."""
    from services.github_service import github_service
    
    # Find the issue
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    if not issue.get("owner") or not issue.get("repo") or not issue.get("number"):
        raise HTTPException(status_code=400, detail="Issue missing GitHub metadata")
    
    # Get user's GitHub token
    user_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    github_token = user_doc.get("githubAccessToken") if user_doc else None
    
    if not github_token:
        # Return empty comments if no token
        return {"issueId": issue_id, "comments": []}
    
    try:
        comments = await github_service.fetch_issue_comments(
            github_access_token=github_token,
            owner=issue["owner"],
            repo=issue["repo"],
            issue_number=issue["number"]
        )
        return {"issueId": issue_id, "comments": comments}
    except Exception as e:
        logger.error(f"Error fetching comments: {e}")
        return {"issueId": issue_id, "comments": [], "error": str(e)}


@router.post("/api/contributor/claim-issue")
async def claim_issue(issueId: str = None, user: dict = Depends(get_current_user)):
    """Claim an issue to work on."""
    # Stub implementation
    return {
        "message": "Issue claim registered",
        "issueId": issueId,
        "claimedAt": datetime.now(timezone.utc).isoformat()
    }


@router.get("/api/contributor/my-claimed-issues")
async def get_my_claimed_issues(user: dict = Depends(get_current_user)):
    """Get all issues claimed by the current user."""
    return {"claims": [], "count": 0}


# =============================================================================
# Messaging Routes
# =============================================================================

@router.get("/api/messaging/unread-count")
async def get_unread_count(user: dict = Depends(get_current_user)):
    """Get count of unread messages for the current user."""
    user_ids = [user.get("id"), user.get("username")]
    user_ids = [i for i in user_ids if i]
    
    count = await db.messages.count_documents({
        "receiver_id": {"$in": user_ids},
        "read": False
    })
    
    return {"count": count}


@router.get("/api/messaging/conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    """Get list of all conversation contacts with last message preview."""
    user_ids = [user.get("id"), user.get("username")]
    user_ids = [i for i in user_ids if i]
    
    # Get all unique users we've messaged with
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"sender_id": {"$in": user_ids}},
                    {"receiver_id": {"$in": user_ids}}
                ]
            }
        },
        {"$sort": {"timestamp": -1}},
        {
            "$group": {
                "_id": {
                    "$cond": [
                        {"$in": ["$sender_id", user_ids]},
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
                                {"$in": ["$receiver_id", user_ids]},
                                {"$eq": ["$read", False]}
                            ]},
                            1, 0
                        ]
                    }
                }
            }
        },
        {"$sort": {"last_timestamp": -1}}
    ]
    
    results = await db.messages.aggregate(pipeline).to_list(length=50)
    
    conversations = []
    for r in results:
        other_user_id = r["_id"]
        user_info = await db.users.find_one(
            {"$or": [{"id": other_user_id}, {"username": other_user_id}]},
            {"_id": 0, "id": 1, "username": 1, "avatarUrl": 1}
        )
        
        conversations.append({
            "user_id": user_info.get("id") if user_info else other_user_id,
            "username": user_info.get("username") if user_info else str(other_user_id),
            "avatar_url": user_info.get("avatarUrl") if user_info else None,
            "last_message": (r.get("last_message", "") or "")[:50],
            "last_timestamp": r.get("last_timestamp"),
            "unread_count": r.get("unread_count", 0)
        })
    
    return {"conversations": conversations}


@router.get("/api/messaging/history/{other_user_id}")
async def get_chat_history(other_user_id: str, user: dict = Depends(get_current_user)):
    """Get chat history with a specific user."""
    user_ids = [user.get("id"), user.get("username")]
    user_ids = [i for i in user_ids if i]
    
    other_ids = [other_user_id]
    other_user = await db.users.find_one(
        {"$or": [{"id": other_user_id}, {"username": other_user_id}]},
        {"_id": 0, "id": 1, "username": 1}
    )
    if other_user:
        other_ids.extend([other_user.get("id"), other_user.get("username")])
    other_ids = [i for i in set(other_ids) if i]
    
    messages = await db.messages.find({
        "$or": [
            {"sender_id": {"$in": user_ids}, "receiver_id": {"$in": other_ids}},
            {"sender_id": {"$in": other_ids}, "receiver_id": {"$in": user_ids}}
        ]
    }, {"_id": 0}).sort("timestamp", 1).to_list(length=1000)
    
    return messages


@router.post("/api/messaging/send")
async def send_message(request: SendMessageRequest, user: dict = Depends(get_current_user)):
    """Send a message to another user."""
    import uuid
    
    message = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "receiver_id": request.receiver_id,
        "content": request.content,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    
    await db.messages.insert_one(message)
    del message["_id"] if "_id" in message else None
    
    return message


@router.post("/api/messaging/mark-read/{other_user_id}")
async def mark_messages_read(other_user_id: str, user: dict = Depends(get_current_user)):
    """Mark all messages from a specific user as read."""
    user_ids = [user.get("id"), user.get("username")]
    user_ids = [i for i in user_ids if i]
    
    other_ids = [other_user_id]
    other_user = await db.users.find_one(
        {"$or": [{"id": other_user_id}, {"username": other_user_id}]}
    )
    if other_user:
        other_ids.extend([other_user.get("id"), other_user.get("username")])
    other_ids = [i for i in set(other_ids) if i]
    
    result = await db.messages.update_many(
        {
            "sender_id": {"$in": other_ids},
            "receiver_id": {"$in": user_ids},
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    return {"marked_read": result.modified_count}


# =============================================================================
# Maintainer Routes
# =============================================================================

@router.get("/api/maintainer/dashboard-summary")
async def get_maintainer_dashboard_summary(user: dict = Depends(get_current_user)):
    """Get dashboard summary for maintainers."""
    if user.get("role", "").upper() not in ["MAINTAINER"]:
        raise HTTPException(status_code=403, detail="Maintainer access required")
    
    # Get user's repositories
    repos = await db.repositories.find({"userId": user["id"]}, {"_id": 0}).to_list(100)
    repo_ids = [r.get("id") for r in repos]
    
    if not repo_ids:
        return {
            "openIssues": 0,
            "openPRs": 0,
            "triaged": 0,
            "untriaged": 0,
            "repositoriesCount": 0,
            "repositories": []
        }
    
    # Count issues
    open_issues = await db.issues.count_documents({
        "repoId": {"$in": repo_ids},
        "state": "open",
        "isPR": False
    })
    
    open_prs = await db.issues.count_documents({
        "repoId": {"$in": repo_ids},
        "state": "open",
        "isPR": True
    })
    
    # Count triaged
    all_open_issues = await db.issues.find({
        "repoId": {"$in": repo_ids},
        "state": "open"
    }, {"id": 1}).to_list(1000)
    
    triaged = 0
    for issue in all_open_issues:
        has_triage = await db.triage_data.find_one({"issueId": issue["id"]})
        if has_triage:
            triaged += 1
    
    return {
        "openIssues": open_issues,
        "openPRs": open_prs,
        "triaged": triaged,
        "untriaged": open_issues - triaged,
        "repositoriesCount": len(repos),
        "repositories": repos
    }
