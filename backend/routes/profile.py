"""
Profile API routes for user profile management.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime
import httpx

from models.profile import (
    UserProfile, ProfileUpdate, RepoConnection, 
    GitHubStats, ProfileSummary
)
from config.database import db
from config.settings import settings

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("/{username}", response_model=UserProfile)
async def get_profile(username: str):
    """Get user profile by username or user_id."""
    # Search by username OR user_id to handle different save scenarios
    profile = await db.profiles.find_one({
        "$or": [{"username": username}, {"user_id": username}]
    })
    
    if not profile:
        # Create default profile if doesn't exist
        user = await db.users.find_one({
            "$or": [{"username": username}, {"githubId": username}]
        })
        if not user:
            # Return an empty profile rather than 404
            profile = {
                "user_id": username,
                "username": username,
                "avatar_url": None,
                "bio": None,
                "skills": [],
                "connected_repos": [],
                "available_for_mentoring": False,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await db.profiles.insert_one(profile)
        else:
            profile = {
                "user_id": str(user.get("githubId", user.get("_id"))),
                "username": user.get("username", username),
                "avatar_url": user.get("avatarUrl"),
                "bio": None,
                "skills": [],
                "connected_repos": [],
                "available_for_mentoring": False,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await db.profiles.insert_one(profile)
    
    profile["_id"] = str(profile.get("_id", ""))
    return UserProfile(**profile)


@router.put("/{user_id}")
async def update_profile(user_id: str, update: ProfileUpdate):
    """Update user profile."""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Try to find profile by user_id or username
    result = await db.profiles.update_one(
        {"$or": [{"user_id": user_id}, {"username": user_id}]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        # Try to find user by githubId or username
        user = await db.users.find_one({
            "$or": [{"githubId": user_id}, {"username": user_id}, {"_id": user_id}]
        })
        
        if not user:
            # Create profile anyway with the ID provided
            profile_data = {
                "user_id": user_id,
                "username": user_id,  # Use ID as username placeholder
                **update_data,
                "created_at": datetime.utcnow()
            }
            await db.profiles.insert_one(profile_data)
            return {"success": True, "message": "Profile created"}
        
        profile_data = {
            "user_id": str(user.get("githubId", user.get("_id", user_id))),
            "username": user.get("username"),
            "avatar_url": user.get("avatarUrl"),
            **update_data,
            "created_at": datetime.utcnow()
        }
        await db.profiles.insert_one(profile_data)
    
    # Sync with mentor_profiles if available_for_mentoring is enabled
    if update.available_for_mentoring is not None:
        # Get current profile to access all data
        profile = await db.profiles.find_one({
            "$or": [{"user_id": user_id}, {"username": user_id}]
        })
        
        if profile:
            skills = update.skills if update.skills else profile.get("skills", [])
            bio = update.bio if update.bio else profile.get("bio", "")
            
            if update.available_for_mentoring:
                # Create/update mentor profile
                mentor_data = {
                    "user_id": profile.get("user_id", user_id),
                    "username": profile.get("username", user_id),
                    "tech_stack": skills,
                    "bio": bio,
                    "is_active": True,
                    "updated_at": datetime.utcnow().isoformat()
                }
                await db.mentor_profiles.update_one(
                    {"username": profile.get("username", user_id)},
                    {"$set": mentor_data},
                    upsert=True
                )
            else:
                # Deactivate mentor profile
                await db.mentor_profiles.update_one(
                    {"username": profile.get("username", user_id)},
                    {"$set": {"is_active": False, "updated_at": datetime.utcnow().isoformat()}}
                )
    
    return {"success": True, "message": "Profile updated"}


@router.get("/{username}/github-stats", response_model=GitHubStats)
async def get_github_stats(username: str, refresh: bool = False):
    """Fetch GitHub contribution statistics for a user."""
    
    # Check cache first
    if not refresh:
        cached = await db.github_stats.find_one({"username": username})
        if cached:
            cache_age = (datetime.utcnow() - cached.get("fetched_at", datetime.min)).total_seconds()
            if cache_age < 3600:  # 1 hour cache
                cached["_id"] = str(cached["_id"])
                return GitHubStats(**cached)
    
    # Fetch from GitHub API
    try:
        async with httpx.AsyncClient() as client:
            # Get user info
            headers = {"Authorization": f"token {settings.GITHUB_TOKEN}"} if settings.GITHUB_TOKEN else {}
            
            user_resp = await client.get(
                f"https://api.github.com/users/{username}",
                headers=headers
            )
            user_data = user_resp.json() if user_resp.status_code == 200 else {}
            
            # Get recent events for contribution data
            events_resp = await client.get(
                f"https://api.github.com/users/{username}/events",
                headers=headers,
                params={"per_page": 100}
            )
            events = events_resp.json() if events_resp.status_code == 200 else []
            
            # Calculate stats from events
            commits = 0
            prs = 0
            issues = 0
            reviews = 0
            repos = set()
            contribution_days = {}
            
            for event in events:
                event_type = event.get("type", "")
                created_at = event.get("created_at", "")[:10]
                repo_name = event.get("repo", {}).get("name", "")
                
                if repo_name:
                    repos.add(repo_name)
                
                if created_at:
                    if created_at not in contribution_days:
                        contribution_days[created_at] = {"date": created_at, "count": 0, "types": []}
                    contribution_days[created_at]["count"] += 1
                    contribution_days[created_at]["types"].append(event_type)
                
                if event_type == "PushEvent":
                    commits += len(event.get("payload", {}).get("commits", []))
                elif event_type == "PullRequestEvent":
                    prs += 1
                elif event_type == "IssuesEvent":
                    issues += 1
                elif event_type == "PullRequestReviewEvent":
                    reviews += 1
            
            # Calculate streak
            sorted_days = sorted(contribution_days.keys(), reverse=True)
            current_streak = 0
            today = datetime.utcnow().strftime("%Y-%m-%d")
            
            for i, day in enumerate(sorted_days):
                expected_day = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
                if day == expected_day or (i == 0 and day == sorted_days[0]):
                    current_streak += 1
                else:
                    break
            
            stats = GitHubStats(
                username=username,
                total_contributions=sum(d["count"] for d in contribution_days.values()),
                current_streak=current_streak,
                longest_streak=current_streak,  # Would need historical data for accurate longest
                total_commits=commits,
                total_prs=prs,
                total_issues=issues,
                total_reviews=reviews,
                contribution_days=list(contribution_days.values())[:30],
                repositories=list(repos)[:20],
                languages=[],  # Would need additional API call
                fetched_at=datetime.utcnow()
            )
            
            # Cache the result
            await db.github_stats.update_one(
                {"username": username},
                {"$set": stats.dict()},
                upsert=True
            )
            
            return stats
            
    except Exception as e:
        print(f"Error fetching GitHub stats: {e}")
        # Return empty stats on error
        return GitHubStats(username=username)


@router.get("/{username}/repos")
async def get_user_repos(username: str):
    """Get list of user's GitHub repositories."""
    try:
        # Try to get user's GitHub token for better access
        user = await db.users.find_one(
            {"$or": [{"username": username}, {"githubId": username}]},
            {"_id": 0, "githubAccessToken": 1}
        )
        
        user_token = user.get("githubAccessToken") if user else None
        
        async with httpx.AsyncClient() as client:
            # Prefer user's token, fall back to app token
            token = user_token or settings.GITHUB_TOKEN
            headers = {"Authorization": f"token {token}"} if token else {}
            
            resp = await client.get(
                f"https://api.github.com/users/{username}/repos",
                headers=headers,
                params={"per_page": 50, "sort": "updated", "type": "owner"}
            )
            
            if resp.status_code != 200:
                print(f"GitHub API returned {resp.status_code} for {username}/repos")
                return {"repos": [], "error": f"GitHub returned {resp.status_code}"}
            
            repos = resp.json()
            return {
                "repos": [
                    {
                        "name": repo["full_name"],
                        "description": repo.get("description"),
                        "stars": repo.get("stargazers_count", 0),
                        "language": repo.get("language"),
                        "updated_at": repo.get("updated_at"),
                        "private": repo.get("private", False)
                    }
                    for repo in repos
                ],
                "count": len(repos)
            }
    except Exception as e:
        print(f"Error fetching repos: {e}")
        return {"repos": [], "error": str(e)}


@router.post("/{user_id}/connect-repo")
async def connect_repo(user_id: str, connection: RepoConnection):
    """Connect a repository for monitoring."""
    result = await db.profiles.update_one(
        {"user_id": user_id},
        {
            "$addToSet": {"connected_repos": connection.repo_name},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {"success": True, "message": f"Connected {connection.repo_name}"}


@router.delete("/{user_id}/disconnect-repo")
async def disconnect_repo(user_id: str, repo_name: str):
    """Disconnect a repository from monitoring."""
    result = await db.profiles.update_one(
        {"user_id": user_id},
        {
            "$pull": {"connected_repos": repo_name},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {"success": True, "message": f"Disconnected {repo_name}"}


@router.get("/{user_id}/connected-repos")
async def get_connected_repos(user_id: str):
    """Get list of connected repositories for a user."""
    profile = await db.profiles.find_one({"user_id": user_id})
    
    if not profile:
        return {"repos": []}
    
    return {"repos": profile.get("connected_repos", [])}


# Import for timedelta
from datetime import timedelta
