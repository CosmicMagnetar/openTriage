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
    message.pop("_id", None)  # Remove MongoDB's _id if present
    
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


# =============================================================================
# Profile Routes
# =============================================================================

class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    available_for_mentoring: Optional[bool] = None
    location: Optional[str] = None
    website: Optional[str] = None
    twitter: Optional[str] = None


@router.get("/api/profile/{username}")
async def get_profile(username: str):
    """Get user profile by username."""
    # Search by username OR user_id
    profile = await db.profiles.find_one({
        "$or": [{"username": username}, {"user_id": username}]
    }, {"_id": 0})
    
    if not profile:
        # Create default profile if doesn't exist
        user = await db.users.find_one({
            "$or": [{"username": username}, {"id": username}]
        }, {"_id": 0})
        
        if not user:
            # Return empty profile rather than 404
            return {
                "user_id": username,
                "username": username,
                "avatar_url": None,
                "bio": None,
                "skills": [],
                "connected_repos": [],
                "available_for_mentoring": False
            }
        
        profile = {
            "user_id": user.get("id", username),
            "username": user.get("username", username),
            "avatar_url": user.get("avatarUrl"),
            "bio": None,
            "skills": [],
            "connected_repos": [],
            "available_for_mentoring": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.profiles.insert_one(profile)
        profile.pop("_id", None)
    
    return profile


@router.put("/api/profile/{user_id}")
async def update_profile(user_id: str, update: ProfileUpdate, user: dict = Depends(get_current_user)):
    """Update user profile."""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.profiles.update_one(
        {"$or": [{"user_id": user_id}, {"username": user_id}]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        # Create new profile
        profile_data = {
            "user_id": user_id,
            "username": user.get("username", user_id),
            **update_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.profiles.insert_one(profile_data)
    
    return {"success": True, "message": "Profile updated"}


@router.get("/api/profile/{username}/github-stats")
async def get_github_stats(username: str, refresh: bool = False):
    """Get GitHub contribution statistics for a user."""
    import httpx
    
    # Check cache first
    if not refresh:
        cached = await db.github_stats.find_one({"username": username}, {"_id": 0})
        if cached:
            return cached
    
    # Fetch from GitHub API
    try:
        async with httpx.AsyncClient() as client:
            events_resp = await client.get(
                f"https://api.github.com/users/{username}/events",
                params={"per_page": 100},
                timeout=30.0
            )
            events = events_resp.json() if events_resp.status_code == 200 else []
            
            commits = 0
            prs = 0
            issues_count = 0
            repos = set()
            
            for event in events:
                event_type = event.get("type", "")
                repo_name = event.get("repo", {}).get("name", "")
                
                if repo_name:
                    repos.add(repo_name)
                
                if event_type == "PushEvent":
                    commits += len(event.get("payload", {}).get("commits", []))
                elif event_type == "PullRequestEvent":
                    prs += 1
                elif event_type == "IssuesEvent":
                    issues_count += 1
            
            stats = {
                "username": username,
                "total_contributions": commits + prs + issues_count,
                "total_commits": commits,
                "total_prs": prs,
                "total_issues": issues_count,
                "repositories": list(repos)[:20],
                "fetched_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Cache the result
            await db.github_stats.update_one(
                {"username": username},
                {"$set": stats},
                upsert=True
            )
            
            return stats
    except Exception as e:
        logger.error(f"Error fetching GitHub stats: {e}")
        return {"username": username, "total_contributions": 0, "error": str(e)}


@router.get("/api/profile/{user_id}/connected-repos")
async def get_connected_repos(user_id: str):
    """Get list of connected repositories for a user."""
    profile = await db.profiles.find_one({
        "$or": [{"user_id": user_id}, {"username": user_id}]
    }, {"_id": 0})
    
    if not profile:
        # Get repos from issues
        unique_repos = set()
        cursor = db.issues.find({"authorName": user_id}, {"repoName": 1, "_id": 0})
        async for issue in cursor:
            if issue.get("repoName"):
                unique_repos.add(issue["repoName"])
        return {"repos": list(unique_repos)[:20]}
    
    return {"repos": profile.get("connected_repos", [])}


@router.get("/api/profile/{username}/featured-badges")
async def get_featured_badges(username: str):
    """Get user's featured badges for profile display."""
    profile = await db.profiles.find_one({
        "$or": [{"username": username}, {"user_id": username}]
    }, {"_id": 0})
    
    if not profile:
        return {"badges": []}
    
    featured_ids = profile.get("featured_badge_ids", [])
    if not featured_ids:
        return {"badges": []}
    
    # Get badge details
    user_badges = await db.user_badges.find({
        "username": username,
        "badge_id": {"$in": featured_ids}
    }, {"_id": 0}).to_list(3)
    
    return {"badges": user_badges}


# =============================================================================
# Spark/Gamification Routes
# =============================================================================

@router.get("/api/spark/status")
async def spark_status():
    """Get Spark session status."""
    return {
        "spark": {"active": False, "status": "disabled_on_hf_spaces"},
        "services": {
            "gamification": "available",
            "badges": "available"
        }
    }


@router.get("/api/spark/gamification/user/{username}")
async def get_user_gamification(username: str):
    """Get complete gamification data for a user."""
    # Calculate stats from issues/PRs
    all_items = await db.issues.find(
        {"authorName": username},
        {"_id": 0}
    ).to_list(1000)
    
    prs = [item for item in all_items if item.get("isPR")]
    issues = [item for item in all_items if not item.get("isPR")]
    
    # Get user badges
    badges = await db.user_badges.find({"username": username}, {"_id": 0}).to_list(50)
    
    return {
        "username": username,
        "total_contributions": len(all_items),
        "total_prs": len(prs),
        "total_issues": len(issues),
        "badges_earned": len(badges),
        "badges": badges,
        "level": 1 + len(all_items) // 10,
        "xp": len(all_items) * 10
    }


@router.get("/api/spark/gamification/streak/{username}")
async def get_user_streak(username: str, days: int = 365):
    """Get contribution streak for a user."""
    # Get contribution dates from issues
    items = await db.issues.find(
        {"authorName": username},
        {"createdAt": 1, "_id": 0}
    ).sort("createdAt", -1).to_list(1000)
    
    if not items:
        return {"username": username, "current_streak": 0, "longest_streak": 0}
    
    # Calculate streak (simplified)
    dates = set()
    for item in items:
        if item.get("createdAt"):
            dates.add(item["createdAt"][:10])
    
    current_streak = len(dates) if dates else 0
    
    return {
        "username": username,
        "current_streak": min(current_streak, 30),
        "longest_streak": current_streak,
        "active_days": len(dates)
    }


@router.get("/api/spark/gamification/calendar/{username}")
async def get_user_impact_calendar(username: str, days: int = 365):
    """Get Impact Calendar data for a user."""
    from datetime import timedelta
    
    # Get contributions
    items = await db.issues.find(
        {"authorName": username},
        {"createdAt": 1, "isPR": 1, "_id": 0}
    ).to_list(1000)
    
    # Group by date
    calendar = {}
    for item in items:
        if item.get("createdAt"):
            date = item["createdAt"][:10]
            if date not in calendar:
                calendar[date] = {"date": date, "count": 0, "prs": 0, "issues": 0}
            calendar[date]["count"] += 1
            if item.get("isPR"):
                calendar[date]["prs"] += 1
            else:
                calendar[date]["issues"] += 1
    
    return {
        "username": username,
        "days": len(calendar),
        "calendar": list(calendar.values())
    }


@router.get("/api/spark/badges/all")
async def get_all_badges():
    """Get all available badges."""
    badges = [
        {"id": "first_pr", "name": "First PR", "description": "Opened your first pull request", "rarity": "common"},
        {"id": "pr_master", "name": "PR Master", "description": "Opened 10 pull requests", "rarity": "uncommon"},
        {"id": "pr_legend", "name": "PR Legend", "description": "Opened 50 pull requests", "rarity": "rare"},
        {"id": "bug_hunter", "name": "Bug Hunter", "description": "Reported 5 bugs", "rarity": "common"},
        {"id": "bug_slayer", "name": "Bug Slayer", "description": "Reported 25 bugs", "rarity": "uncommon"},
        {"id": "streak_starter", "name": "Streak Starter", "description": "7-day contribution streak", "rarity": "common"},
        {"id": "streak_warrior", "name": "Streak Warrior", "description": "30-day contribution streak", "rarity": "rare"},
        {"id": "first_mentor", "name": "First Mentor", "description": "Helped your first mentee", "rarity": "uncommon"},
        {"id": "triage_helper", "name": "Triage Helper", "description": "Helped triage 10 issues", "rarity": "uncommon"},
        {"id": "early_adopter", "name": "Early Adopter", "description": "One of the first users", "rarity": "legendary"}
    ]
    return {"count": len(badges), "badges": badges}


@router.get("/api/spark/badges/user/{username}")
async def get_user_badges(username: str):
    """Get badges for a user."""
    # Get user's earned badges
    earned = await db.user_badges.find({"username": username}, {"_id": 0}).to_list(50)
    
    # If no badges, check if they earned any based on contributions
    if not earned:
        all_items = await db.issues.find({"authorName": username}, {"isPR": 1}).to_list(1000)
        prs = [i for i in all_items if i.get("isPR")]
        
        new_badges = []
        if len(prs) >= 1:
            new_badges.append({"badge_id": "first_pr", "username": username, "earned_at": datetime.now(timezone.utc).isoformat()})
        if len(prs) >= 10:
            new_badges.append({"badge_id": "pr_master", "username": username, "earned_at": datetime.now(timezone.utc).isoformat()})
        
        if new_badges:
            await db.user_badges.insert_many(new_badges)
            earned = new_badges
    
    return {
        "username": username,
        "earned_count": len(earned),
        "badges": earned
    }


# =============================================================================
# Mentor Routes
# =============================================================================

class CreateMentorProfileRequest(BaseModel):
    tech_stack: List[str]
    availability_hours: int = 5
    expertise_level: str = "intermediate"


class MentorshipRequestBody(BaseModel):
    mentor_id: str
    message: str = ""


@router.get("/api/mentor/match/{user_id}")
async def find_mentors_for_user(
    user_id: str,
    username: str = "",
    limit: int = 5,
    skills: Optional[str] = None
):
    """Find mentor matches for a user."""
    skill_filter = None
    if skills:
        skill_filter = [s.strip() for s in skills.split(',') if s.strip()]
    
    # Find active mentors
    query = {"is_active": True}
    if skill_filter:
        query["tech_stack"] = {"$in": skill_filter}
    
    mentors = await db.mentor_profiles.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    return {
        "count": len(mentors),
        "matches": mentors,
        "search_skills": skill_filter
    }


@router.get("/api/mentor/profiles")
async def list_mentors(active_only: bool = True, limit: int = 20):
    """List all available mentors."""
    query = {"is_active": True} if active_only else {}
    mentors = await db.mentor_profiles.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    return {
        "count": len(mentors),
        "mentors": mentors
    }


@router.post("/api/mentor/profile")
async def create_mentor_profile(
    request: CreateMentorProfileRequest,
    user: dict = Depends(get_current_user)
):
    """Create or update a mentor profile."""
    import uuid
    
    profile = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": user["username"],
        "tech_stack": request.tech_stack,
        "availability_hours_per_week": request.availability_hours,
        "expertise_level": request.expertise_level,
        "is_active": True,
        "mentee_count": 0,
        "avg_rating": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.mentor_profiles.update_one(
        {"username": user["username"]},
        {"$set": profile},
        upsert=True
    )
    
    return {"status": "created", "profile": profile}


@router.get("/api/mentor/profile/{user_id}")
async def get_mentor_profile(user_id: str):
    """Get a mentor's profile."""
    profile = await db.mentor_profiles.find_one({
        "$or": [{"user_id": user_id}, {"username": user_id}]
    }, {"_id": 0})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Mentor profile not found")
    
    return profile


@router.post("/api/mentor/request")
async def request_mentorship(
    request: MentorshipRequestBody,
    user: dict = Depends(get_current_user)
):
    """Request mentorship from a mentor."""
    import uuid
    
    mentorship = {
        "id": str(uuid.uuid4()),
        "mentee_id": user["id"],
        "mentee_username": user["username"],
        "mentor_id": request.mentor_id,
        "message": request.message,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.mentorship_requests.insert_one(mentorship)
    mentorship.pop("_id", None)
    
    return {"success": True, "request": mentorship}


@router.get("/api/mentor/my-mentors")
async def get_my_mentors(user: dict = Depends(get_current_user)):
    """Get list of active mentors for the current user."""
    requests = await db.mentorship_requests.find({
        "mentee_id": user["id"],
        "status": {"$in": ["pending", "accepted"]}
    }, {"_id": 0}).to_list(20)
    
    return {"mentors": requests, "count": len(requests)}


# =============================================================================
# Repository Routes
# =============================================================================

class AddRepoRequest(BaseModel):
    repoFullName: str


@router.get("/api/repositories")
async def get_repositories(user: dict = Depends(get_current_user)):
    """Get all repositories for the current user."""
    repos = await db.repositories.find({"userId": user["id"]}, {"_id": 0}).to_list(100)
    return repos


@router.post("/api/repositories")
async def add_repository(request: AddRepoRequest, user: dict = Depends(get_current_user)):
    """Add a new repository to track."""
    import uuid
    import httpx
    
    parts = request.repoFullName.split('/')
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'owner/repo'")
    owner, repo_name = parts
    
    # Get user's GitHub token
    user_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    github_token = user_doc.get("githubAccessToken") if user_doc else None
    
    if not github_token:
        raise HTTPException(status_code=400, detail="GitHub access token not found")
    
    # Verify repo exists on GitHub
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{request.repoFullName}",
                headers={
                    "Authorization": f"Bearer {github_token}",
                    "Accept": "application/vnd.github+json"
                },
                timeout=30.0
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Repository not found or no access")
            repo_data = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="GitHub API timeout")
    
    # Check if already added
    existing = await db.repositories.find_one({
        "githubRepoId": repo_data["id"],
        "userId": user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Repository already added")
    
    # Create repository record
    repository = {
        "id": str(uuid.uuid4()),
        "githubRepoId": repo_data["id"],
        "name": request.repoFullName,
        "owner": owner,
        "userId": user["id"],
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.repositories.insert_one(repository)
    repository.pop("_id", None)
    
    return {"message": "Repository added!", "repository": repository}


@router.get("/api/repositories/maintainer")
async def get_maintainer_repositories(user: dict = Depends(get_current_user)):
    """Get repositories where the user is the maintainer."""
    repos = await db.repositories.find({"userId": user["id"]}, {"_id": 0}).to_list(100)
    
    for repo in repos:
        repo["role"] = "maintainer"
    
    return {"repos": repos, "count": len(repos)}


@router.get("/api/repositories/contributor")
async def get_contributor_repositories(user: dict = Depends(get_current_user)):
    """Get repositories where the user has contributed."""
    username = user.get("username", "")
    user_id = user.get("id", "")
    
    # Get user's own repos to exclude
    own_repos = await db.repositories.find({"userId": user_id}, {"id": 1, "_id": 0}).to_list(100)
    own_repo_ids = {r["id"] for r in own_repos}
    
    # Find unique repos from user's PRs
    pipeline = [
        {"$match": {"authorName": username, "isPR": True}},
        {"$group": {
            "_id": {"repoId": "$repoId", "repoName": "$repoName"},
            "pr_count": {"$sum": 1}
        }},
        {"$project": {
            "_id": 0,
            "repoId": "$_id.repoId",
            "repoName": "$_id.repoName",
            "pr_count": 1
        }},
        {"$sort": {"pr_count": -1}}
    ]
    
    contributed = await db.issues.aggregate(pipeline).to_list(100)
    
    # Filter out own repos
    result = []
    for repo in contributed:
        if repo.get("repoId") not in own_repo_ids:
            repo["role"] = "contributor"
            repo["name"] = repo.get("repoName", "")
            result.append(repo)
    
    return {"repos": result, "count": len(result)}

