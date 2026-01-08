"""
Mentor API Routes for OpenTriage.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services.mentor_matching_service import mentor_matching_service
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# Request/Response Models

class CreateMentorProfileRequest(BaseModel):
    tech_stack: List[str]
    availability_hours: int = 5
    expertise_level: str = "intermediate"
    preferred_topics: List[str] = []


class MentorshipRequestBody(BaseModel):
    mentor_id: str
    issue_id: Optional[str] = None
    message: str = ""


class RateMentorRequest(BaseModel):
    mentor_id: str
    rating: int  # 1-5
    feedback: Optional[str] = None


# Routes

@router.get("/match/{user_id}")
async def find_mentors_for_user(
    user_id: str,
    username: str,
    limit: int = 5,
    skills: Optional[str] = None
):
    """
    Find mentor matches for a specific user.
    Optional skills parameter: comma-separated list of skills to filter by.
    """
    try:
        # Parse skills filter if provided
        skill_filter = None
        if skills:
            skill_filter = [s.strip() for s in skills.split(',') if s.strip()]
        
        matches = await mentor_matching_service.find_mentors_for_user(
            user_id=user_id,
            username=username,
            limit=limit,
            skill_filter=skill_filter
        )
        
        # Build helpful message when no matches
        message = None
        if len(matches) == 0:
            if skill_filter:
                message = f"No mentors found with skills: {', '.join(skill_filter)}. Try different skills or become a mentor yourself!"
            else:
                message = "No mentors available yet. Be the first to become a mentor!"
        
        return {
            "count": len(matches),
            "matches": matches,
            "message": message,
            "search_skills": skill_filter
        }
    except Exception as e:
        logger.error(f"Mentor matching error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/match/issue/{issue_id}")
async def find_mentors_for_issue(issue_id: str, limit: int = 5):
    """
    Find mentors who can help with a specific issue.
    """
    try:
        matches = await mentor_matching_service.find_mentors_for_issue(
            issue_id=issue_id,
            limit=limit
        )
        
        return {
            "count": len(matches),
            "issue_id": issue_id,
            "matches": [m.model_dump() for m in matches]
        }
    except Exception as e:
        logger.error(f"Issue mentor matching error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profile")
async def create_mentor_profile(
    request: CreateMentorProfileRequest,
    user_id: str,
    username: str
):
    """
    Create or update a mentor profile.
    """
    try:
        profile = await mentor_matching_service.create_mentor_profile(
            user_id=user_id,
            username=username,
            tech_stack=request.tech_stack,
            availability_hours=request.availability_hours,
            expertise_level=request.expertise_level
        )
        
        return {
            "status": "created",
            "profile": profile.model_dump()
        }
    except Exception as e:
        logger.error(f"Create mentor profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile/{user_id}")
async def get_mentor_profile(user_id: str):
    """
    Get a mentor's profile.
    """
    try:
        profile = await mentor_matching_service.get_mentor_profile(user_id)
        
        if not profile:
            raise HTTPException(status_code=404, detail="Mentor profile not found")
        
        return profile.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get mentor profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profiles")
async def list_mentors(active_only: bool = True, limit: int = 20):
    """
    List all available mentors.
    """
    try:
        mentors = await mentor_matching_service.get_all_mentors(active_only=active_only)
        
        return {
            "count": len(mentors[:limit]),
            "mentors": [m.model_dump() for m in mentors[:limit]]
        }
    except Exception as e:
        logger.error(f"List mentors error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/request")
async def request_mentorship(
    request: MentorshipRequestBody,
    mentee_id: str
):
    """
    Request mentorship from a mentor.
    """
    try:
        logger.info(f"Mentorship request: mentee_id={mentee_id}, mentor_id={request.mentor_id}")
        result = await mentor_matching_service.request_mentorship(
            mentee_id=mentee_id,
            mentor_id=request.mentor_id,
            issue_id=request.issue_id,
            message=request.message
        )
        logger.info(f"Mentorship request created: {result}")
        return result
    except Exception as e:
        logger.error(f"Mentorship request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed-test-mentor")
async def seed_test_mentor(current_user: dict = Depends(get_current_user)):
    """
    Seed a test mentor profile and pending request for testing.
    """
    from config.database import db
    from datetime import datetime, timezone
    import uuid
    
    current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
    current_username = current_user.get("username", "")
    
    # Create a test mentor profile
    test_mentor = {
        "id": str(uuid.uuid4()),
        "user_id": current_user_id,
        "username": current_username,
        "tech_stack": ["python", "javascript", "react"],
        "languages": ["python", "javascript"],
        "frameworks": ["fastapi", "react"],
        "expertise_level": "intermediate",
        "availability_hours_per_week": 5,
        "is_active": True,
        "bio": f"Test mentor profile for {current_username}",
        "mentee_count": 0,
        "sessions_completed": 0,
        "avg_rating": 4.5,
        "total_ratings": 2,
        "max_mentees": 3,
        "preferred_topics": ["web dev", "open source"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.mentor_profiles.update_one(
        {"username": current_username},
        {"$set": test_mentor},
        upsert=True
    )
    
    # Create a pending mentorship request FROM a test user TO the current user
    test_request = {
        "id": str(uuid.uuid4()),
        "mentee_id": "test_mentee_123",
        "mentee_username": "eager_learner",
        "mentor_id": current_user_id,
        "mentor_username": current_username,
        "message": "Hi! I'd love to learn from you about open source contributions.",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.mentorship_requests.insert_one(test_request)
    
    # Also create the test mentee user
    await db.users.update_one(
        {"id": "test_mentee_123"},
        {"$set": {
            "id": "test_mentee_123",
            "username": "eager_learner",
            "avatarUrl": "https://github.com/github.png"
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Created test mentor profile and pending request",
        "mentor_profile": test_mentor["id"],
        "pending_request": test_request["id"]
    }


@router.post("/rate")
async def rate_mentor(request: RateMentorRequest):
    """
    Rate a mentor after a session.
    """
    try:
        if request.rating < 1 or request.rating > 5:
            raise HTTPException(
                status_code=400, 
                detail="Rating must be between 1 and 5"
            )
        
        await mentor_matching_service.update_mentor_rating(
            mentor_id=request.mentor_id,
            rating=request.rating,
            feedback=request.feedback
        )
        
        return {"status": "rated", "rating": request.rating}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rate mentor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tech-stack/{username}")
async def analyze_tech_stack(username: str):
    """
    Analyze a user's tech stack from their GitHub activity.
    """
    try:
        tech_stack = await mentor_matching_service.extract_tech_stack_from_user(username)
        
        return {
            "username": username,
            "tech_stack": tech_stack
        }
    except Exception as e:
        logger.error(f"Tech stack analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-mentors")
async def get_my_mentors(current_user: dict = Depends(get_current_user)):
    """Get list of active mentors for the current user."""
    try:
        current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
        mentors = await mentor_matching_service.get_active_mentorships(current_user_id)
        return mentors
    except Exception as e:
        logger.error(f"Get my mentors error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/disconnect/{mentor_id}")
async def disconnect_mentor_endpoint(mentor_id: str, current_user: dict = Depends(get_current_user)):
    """Disconnect from a mentor."""
    try:
        current_user_id = current_user.get("id") or str(current_user.get("_id", ""))
        success = await mentor_matching_service.disconnect_mentor(current_user_id, mentor_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Active mentorship not found")
            
        return {"success": True, "message": "Disconnected from mentor"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Disconnect mentor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
