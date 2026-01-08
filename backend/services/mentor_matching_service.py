"""
AI Mentor Matching Service for OpenTriage.
Matches contributors to mentors based on tech stack, project history, and issue difficulty.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import asyncio

from models.mentor import MentorProfile, MentorMatch, ExpertiseLevel
from config.settings import settings

logger = logging.getLogger(__name__)


class MentorMatchingService:
    """
    Service for AI-powered mentor matching.
    
    Matches based on:
    - Tech stack overlap
    - Expertise level vs issue difficulty
    - Availability
    - Past success rate
    """
    
    def __init__(self):
        self.difficulty_keywords = {
            "easy": ["good first issue", "beginner", "easy", "starter", "simple"],
            "medium": ["intermediate", "medium", "moderate"],
            "hard": ["advanced", "complex", "hard", "expert", "challenging"]
        }
    
    async def get_mentor_profile(self, user_id: str) -> Optional[MentorProfile]:
        """Get mentor profile for a user."""
        from config.database import db
        
        profile = await db.mentor_profiles.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if profile:
            return MentorProfile(**profile)
        return None
    
    async def create_mentor_profile(
        self,
        user_id: str,
        username: str,
        tech_stack: List[str],
        availability_hours: int = 5,
        expertise_level: str = "intermediate",
        bio: str = "",
        avatar_url: Optional[str] = None,
        is_active: bool = True
    ) -> MentorProfile:
        """Create or update a mentor profile."""
        from config.database import db
        
        profile = MentorProfile(
            user_id=user_id,
            username=username,
            tech_stack=[t.lower() for t in tech_stack],
            availability_hours_per_week=availability_hours,
            expertise_level=ExpertiseLevel(expertise_level),
            bio=bio,
            avatar_url=avatar_url,
            is_active=is_active
        )
        
        profile_dict = profile.model_dump()
        profile_dict['created_at'] = profile_dict['created_at'].isoformat()
        profile_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        # Upsert
        await db.mentor_profiles.update_one(
            {"user_id": user_id},
            {"$set": profile_dict},
            upsert=True
        )
        
        logger.info(f"Created mentor profile for {username}")
        return profile
    
    async def get_all_mentors(self, active_only: bool = True) -> List[MentorProfile]:
        """Get all mentor profiles."""
        from config.database import db
        
        query = {"is_active": True} if active_only else {}
        cursor = db.mentor_profiles.find(query, {"_id": 0})
        profiles = await cursor.to_list(length=None)
        
        return [MentorProfile(**p) for p in profiles]
    
    async def extract_tech_stack_from_user(self, username: str) -> List[str]:
        """
        Extract tech stack from user's GitHub activity.
        Analyzes PRs and issues to determine languages/frameworks.
        """
        from config.database import db
        
        tech_stack = set()
        
        # Get user's PRs and issues
        cursor = db.issues.find(
            {"authorName": username},
            {"_id": 0, "title": 1, "body": 1, "repoName": 1}
        )
        items = await cursor.to_list(length=100)
        
        # Common tech keywords to look for
        tech_keywords = [
            "python", "javascript", "typescript", "react", "vue", "angular",
            "node", "nodejs", "django", "flask", "fastapi", "express",
            "java", "kotlin", "swift", "go", "golang", "rust", "ruby",
            "rails", "php", "laravel", "c++", "c#", ".net", "sql",
            "mongodb", "postgresql", "mysql", "redis", "docker", "kubernetes",
            "aws", "gcp", "azure", "terraform", "graphql", "rest"
        ]
        
        for item in items:
            text = f"{item.get('title', '')} {item.get('body', '')}".lower()
            for tech in tech_keywords:
                if tech in text:
                    tech_stack.add(tech)
        
        return list(tech_stack)
    
    def calculate_compatibility_score(
        self,
        mentor: MentorProfile,
        mentee_tech_stack: List[str],
        issue_difficulty: str = "medium"
    ) -> float:
        """
        Calculate compatibility score between mentor and mentee.
        
        Returns:
            Score from 0-100
        """
        score = 0.0
        
        # Tech stack overlap (up to 50 points)
        mentee_stack = set(t.lower() for t in mentee_tech_stack)
        mentor_stack = set(t.lower() for t in mentor.tech_stack)
        
        if mentor_stack and mentee_stack:
            overlap = len(mentor_stack & mentee_stack)
            total = len(mentor_stack | mentee_stack)
            tech_score = (overlap / total) * 50 if total > 0 else 0
            score += tech_score
        
        # Expertise level match (up to 25 points)
        difficulty_map = {"easy": 1, "medium": 2, "hard": 3}
        expertise_map = {
            ExpertiseLevel.BEGINNER: 1,
            ExpertiseLevel.INTERMEDIATE: 2,
            ExpertiseLevel.ADVANCED: 3,
            ExpertiseLevel.EXPERT: 4
        }
        
        diff_level = difficulty_map.get(issue_difficulty, 2)
        mentor_level = expertise_map.get(mentor.expertise_level, 2)
        
        # Mentor should be at or above issue difficulty
        if mentor_level >= diff_level:
            level_diff = mentor_level - diff_level
            expertise_score = 25 - (level_diff * 5)  # Slight penalty for overqualified
            score += max(expertise_score, 10)
        else:
            score += 5  # Minimal score if underqualified
        
        # Availability (up to 15 points)
        if mentor.availability_hours_per_week >= 5:
            score += 15
        elif mentor.availability_hours_per_week >= 2:
            score += 10
        else:
            score += 5
        
        # Rating and experience (up to 10 points)
        if mentor.avg_rating > 0:
            score += min(mentor.avg_rating * 2, 10)
        else:
            score += 5  # Default for new mentors
        
        return min(score, 100)
    
    def get_matched_skills(
        self,
        mentor: MentorProfile,
        mentee_tech_stack: List[str]
    ) -> List[str]:
        """Get overlapping skills between mentor and mentee."""
        mentee_stack = set(t.lower() for t in mentee_tech_stack)
        mentor_stack = set(t.lower() for t in mentor.tech_stack)
        return list(mentor_stack & mentee_stack)
    
    async def find_mentors_for_user(
        self,
        user_id: str,
        username: str,
        limit: int = 5,
        skill_filter: Optional[List[str]] = None
    ) -> List[MentorMatch]:
        """
        Find best mentor matches for a user.
        
        Args:
            user_id: User's ID
            username: User's GitHub username
            limit: Max number of matches to return
            skill_filter: Optional list of specific skills to search for
            
        Returns:
            List of MentorMatch sorted by compatibility
        """
        from config.database import db
        
        # First, try to get user's skills from their profile
        tech_stack = []
        if skill_filter:
            # User specified skills to search for
            tech_stack = [s.lower() for s in skill_filter]
        else:
            # Get skills from user's profile first
            profile = await db.profiles.find_one(
                {"$or": [{"user_id": user_id}, {"username": username}]},
                {"_id": 0}
            )
            if profile and profile.get("skills"):
                tech_stack = [s.lower() for s in profile.get("skills", [])]
            
            # If no profile skills, extract from activity
            if not tech_stack:
                tech_stack = await self.extract_tech_stack_from_user(username)
        
        # Get all active mentors
        mentors = await self.get_all_mentors(active_only=True)
        
        # Filter out the current user (by both user_id and username)
        mentors = [m for m in mentors if m.user_id != user_id and m.username.lower() != username.lower()]
        
        # If searching for specific skills, filter mentors who have those skills
        if skill_filter:
            skill_set = set(s.lower() for s in skill_filter)
            mentors = [m for m in mentors if skill_set & set(t.lower() for t in m.tech_stack)]
        
        # Get all pending requests for this user
        pending_requests = await db.mentorship_requests.find({
            "$or": [
                {"mentee_id": user_id},
                {"mentee_username": username}
            ],
            "status": "pending"
        }).to_list(length=100)
        pending_mentor_ids = set()
        for pr in pending_requests:
            pending_mentor_ids.add(pr.get("mentor_id", ""))
            pending_mentor_ids.add(pr.get("mentor_username", ""))
        
        # Calculate compatibility scores
        matches = []
        for mentor in mentors:
            score = self.calculate_compatibility_score(mentor, tech_stack)
            matched_skills = self.get_matched_skills(mentor, tech_stack)
            
            if score > 20 or (skill_filter and matched_skills):  # Lower threshold if skill filter is used
                match = MentorMatch(
                    mentor_id=mentor.user_id,
                    mentor_username=mentor.username,
                    mentee_id=user_id,
                    mentee_username=username,
                    compatibility_score=score,
                    matched_skills=matched_skills,
                    match_reason=self._generate_match_reason(mentor, matched_skills, score)
                )
                # Add extra fields for frontend
                match_dict = match.model_dump()
                match_dict['bio'] = mentor.bio
                match_dict['expertise_level'] = mentor.expertise_level.value if mentor.expertise_level else None
                match_dict['tech_stack'] = mentor.tech_stack
                match_dict['availability_hours'] = mentor.availability_hours_per_week
                match_dict['avatar_url'] = mentor.avatar_url
                # Check if there's a pending request for this mentor
                match_dict['has_pending_request'] = (
                    mentor.user_id in pending_mentor_ids or 
                    mentor.username in pending_mentor_ids
                )
                matches.append(match_dict)
        
        # Sort by score and return top matches
        matches.sort(key=lambda m: m['compatibility_score'], reverse=True)
        return matches[:limit]
    
    async def find_mentors_for_issue(
        self,
        issue_id: str,
        limit: int = 5
    ) -> List[MentorMatch]:
        """
        Find mentors who can help with a specific issue.
        
        Args:
            issue_id: Issue ID
            limit: Max number of matches
            
        Returns:
            List of MentorMatch sorted by relevance
        """
        from config.database import db
        
        # Get issue details
        issue = await db.issues.find_one(
            {"id": issue_id},
            {"_id": 0}
        )
        
        if not issue:
            return []
        
        # Extract tech stack from issue
        issue_text = f"{issue.get('title', '')} {issue.get('body', '')}"
        issue_tech = self._extract_tech_from_text(issue_text)
        
        # Determine difficulty
        difficulty = self._determine_difficulty(issue_text)
        
        # Get all mentors
        mentors = await self.get_all_mentors(active_only=True)
        
        matches = []
        for mentor in mentors:
            score = self.calculate_compatibility_score(mentor, issue_tech, difficulty)
            matched_skills = self.get_matched_skills(mentor, issue_tech)
            
            if score > 20:
                match = MentorMatch(
                    mentor_id=mentor.user_id,
                    mentor_username=mentor.username,
                    mentee_id="",  # Will be filled when someone claims
                    mentee_username="",
                    compatibility_score=score,
                    matched_skills=matched_skills,
                    match_reason=self._generate_match_reason(mentor, matched_skills, score),
                    issue_id=issue_id,
                    repo_name=issue.get("repoName", "")
                )
                matches.append(match)
        
        matches.sort(key=lambda m: m.compatibility_score, reverse=True)
        return matches[:limit]
    
    def _extract_tech_from_text(self, text: str) -> List[str]:
        """Extract technology keywords from text."""
        text_lower = text.lower()
        
        tech_keywords = [
            "python", "javascript", "typescript", "react", "vue", "angular",
            "node", "nodejs", "django", "flask", "fastapi", "express",
            "java", "kotlin", "swift", "go", "rust", "ruby", "rails",
            "php", "laravel", "c++", "c#", ".net", "sql", "mongodb",
            "postgresql", "mysql", "redis", "docker", "kubernetes",
            "aws", "graphql", "rest", "api", "frontend", "backend"
        ]
        
        found = []
        for tech in tech_keywords:
            if tech in text_lower:
                found.append(tech)
        
        return found
    
    def _determine_difficulty(self, text: str) -> str:
        """Determine issue difficulty from text."""
        text_lower = text.lower()
        
        for difficulty, keywords in self.difficulty_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return difficulty
        
        return "medium"
    
    def _generate_match_reason(
        self,
        mentor: MentorProfile,
        matched_skills: List[str],
        score: float
    ) -> str:
        """Generate human-readable match reason."""
        reasons = []
        
        if matched_skills:
            skills_str = ", ".join(matched_skills[:3])
            reasons.append(f"Shares expertise in {skills_str}")
        
        if mentor.sessions_completed > 5:
            reasons.append(f"Completed {mentor.sessions_completed} mentoring sessions")
        
        if mentor.avg_rating >= 4.5:
            reasons.append("Highly rated mentor")
        
        if mentor.availability_hours_per_week >= 5:
            reasons.append("Good availability")
        
        return ". ".join(reasons) if reasons else "Good overall match"
    
    async def request_mentorship(
        self,
        mentee_id: str,
        mentor_id: str,
        issue_id: Optional[str] = None,
        message: str = ""
    ) -> Dict[str, Any]:
        """Create a mentorship request."""
        from config.database import db
        from models.mentor import MentorshipRequest
        
        # Lookup usernames for both mentee and mentor
        mentee_info = await db.users.find_one(
            {"$or": [{"id": mentee_id}, {"username": mentee_id}]},
            {"_id": 0, "id": 1, "username": 1}
        )
        
        mentor_info = await db.users.find_one(
            {"$or": [{"id": mentor_id}, {"username": mentor_id}]},
            {"_id": 0, "id": 1, "username": 1}
        )
        
        # Also check mentor_profiles for mentor info
        if not mentor_info:
            mentor_profile = await db.mentor_profiles.find_one(
                {"$or": [{"user_id": mentor_id}, {"username": mentor_id}]},
                {"_id": 0, "user_id": 1, "username": 1}
            )
            if mentor_profile:
                mentor_info = {"id": mentor_profile.get("user_id"), "username": mentor_profile.get("username")}
        
        request = MentorshipRequest(
            mentee_id=mentee_id,
            mentee_username=mentee_info.get("username", "") if mentee_info else "",
            mentor_id=mentor_id,
            mentor_username=mentor_info.get("username", "") if mentor_info else "",
            issue_id=issue_id,
            message=message
        )
        
        request_dict = request.model_dump()
        request_dict['created_at'] = request_dict['created_at'].isoformat()
        
        await db.mentorship_requests.insert_one(request_dict)
        
        return {"status": "pending", "request_id": request.id}
    
    async def update_mentor_rating(
        self,
        mentor_id: str,
        rating: int,
        feedback: Optional[str] = None
    ):
        """Update mentor's average rating."""
        from config.database import db
        
        profile = await db.mentor_profiles.find_one({"user_id": mentor_id})
        
        if profile:
            total_ratings = profile.get("total_ratings", 0) + 1
            current_avg = profile.get("avg_rating", 0)
            new_avg = ((current_avg * (total_ratings - 1)) + rating) / total_ratings
            
            await db.mentor_profiles.update_one(
                {"user_id": mentor_id},
                {
                    "$set": {
                        "avg_rating": new_avg,
                        "total_ratings": total_ratings,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )


# Singleton instance
mentor_matching_service = MentorMatchingService()
