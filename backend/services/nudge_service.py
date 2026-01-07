"""
Supportive Nudge Service for OpenTriage.
AI agent that helps stuck contributors before auto-unassigning issues.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from config.settings import settings

logger = logging.getLogger(__name__)


class StuckContributor(BaseModel):
    """A contributor who may need help."""
    user_id: str
    username: str
    issue_id: str
    issue_number: int
    issue_title: str
    repo_name: str
    claimed_at: datetime
    hours_since_claim: float
    hours_until_expiry: float
    last_activity: Optional[datetime] = None
    needs_nudge: bool = True


class NudgeMessage(BaseModel):
    """A supportive nudge message."""
    recipient_id: str
    recipient_username: str
    issue_id: str
    message: str
    resources: List[Dict[str, str]] = []
    suggested_mentors: List[str] = []
    nudge_type: str = "check_in"  # check_in, offer_help, final_warning


class NudgeService:
    """
    Service for sending supportive nudges to stuck contributors.
    
    Features:
    - Proactive check-ins before expiry
    - AI-generated helpful messages
    - Resource and mentor suggestions
    - Integrates with cookie-licking service
    """
    
    def __init__(
        self,
        first_nudge_hours: int = 24,
        second_nudge_hours: int = 36,
        final_warning_hours: int = 44
    ):
        """
        Initialize nudge service.
        
        Args:
            first_nudge_hours: Hours after claim for first check-in
            second_nudge_hours: Hours after claim for second nudge
            final_warning_hours: Hours before auto-release warning
        """
        self.first_nudge_hours = first_nudge_hours
        self.second_nudge_hours = second_nudge_hours
        self.final_warning_hours = final_warning_hours
    
    async def check_for_stuck_contributors(self) -> List[StuckContributor]:
        """
        Find contributors who may be stuck on claimed issues.
        
        Returns:
            List of contributors who need a nudge
        """
        from config.database import db
        
        stuck = []
        now = datetime.now(timezone.utc)
        
        # Get all claimed issues
        cursor = db.claimed_issues.find({}, {"_id": 0})
        claims = await cursor.to_list(length=None)
        
        for claim in claims:
            claimed_at = claim.get("claimedAt") or claim.get("claimed_at")
            if isinstance(claimed_at, str):
                claimed_at = datetime.fromisoformat(claimed_at.replace("Z", "+00:00"))
            
            if not claimed_at:
                continue
            
            hours_since_claim = (now - claimed_at).total_seconds() / 3600
            
            # Check if needs nudge based on time thresholds
            needs_nudge = False
            if self.first_nudge_hours <= hours_since_claim < self.second_nudge_hours:
                needs_nudge = True
            elif self.second_nudge_hours <= hours_since_claim < self.final_warning_hours:
                needs_nudge = True
            elif hours_since_claim >= self.final_warning_hours:
                needs_nudge = True
            
            if needs_nudge:
                # Check if we already sent a nudge recently
                recent_nudge = await db.nudges_sent.find_one({
                    "issue_id": claim.get("issueId"),
                    "sent_at": {"$gte": (now - timedelta(hours=12)).isoformat()}
                })
                
                if recent_nudge:
                    continue
                
                # Get issue details
                issue = await db.issues.find_one(
                    {"id": claim.get("issueId")},
                    {"_id": 0}
                )
                
                if issue:
                    expiry_hours = 48  # Default from cookie-licking
                    hours_until_expiry = expiry_hours - hours_since_claim
                    
                    stuck.append(StuckContributor(
                        user_id=claim.get("claimedBy") or claim.get("claimed_by", ""),
                        username=claim.get("claimedByUsername") or claim.get("username", ""),
                        issue_id=claim.get("issueId"),
                        issue_number=issue.get("number", 0),
                        issue_title=issue.get("title", ""),
                        repo_name=issue.get("repoName", ""),
                        claimed_at=claimed_at,
                        hours_since_claim=hours_since_claim,
                        hours_until_expiry=max(hours_until_expiry, 0)
                    ))
        
        return stuck
    
    async def generate_helpful_nudge(
        self,
        stuck: StuckContributor
    ) -> NudgeMessage:
        """
        Generate a helpful, supportive nudge message.
        
        Args:
            stuck: Information about the stuck contributor
            
        Returns:
            NudgeMessage with personalized content
        """
        # Determine nudge type based on timing
        if stuck.hours_until_expiry <= 4:
            nudge_type = "final_warning"
        elif stuck.hours_since_claim >= self.second_nudge_hours:
            nudge_type = "offer_help"
        else:
            nudge_type = "check_in"
        
        # Generate message using AI
        message = await self._generate_ai_message(stuck, nudge_type)
        
        # Find relevant resources
        resources = await self._find_relevant_resources(stuck.issue_id, stuck.repo_name)
        
        # Find potential mentors
        mentors = await self._find_potential_mentors(stuck)
        
        return NudgeMessage(
            recipient_id=stuck.user_id,
            recipient_username=stuck.username,
            issue_id=stuck.issue_id,
            message=message,
            resources=resources,
            suggested_mentors=mentors,
            nudge_type=nudge_type
        )
    
    async def _generate_ai_message(
        self,
        stuck: StuckContributor,
        nudge_type: str
    ) -> str:
        """Generate AI-personalized nudge message."""
        from openai import OpenAI
        
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.OPENROUTER_API_KEY
        )
        
        prompts = {
            "check_in": f"""You are a friendly open source community helper. Write a brief, supportive check-in message for a contributor who claimed an issue 
{int(stuck.hours_since_claim)} hours ago.

Issue: #{stuck.issue_number} - {stuck.issue_title}
Repository: {stuck.repo_name}

The tone should be:
- Warm and non-judgmental
- Genuinely helpful
- Offering assistance, not pressuring
- Brief (2-3 sentences)

Don't mention time limits or unassignment. Just check in.""",

            "offer_help": f"""You are a supportive open source mentor. Write a helpful message for a contributor who may be stuck on an issue.

Issue: #{stuck.issue_number} - {stuck.issue_title}
Repository: {stuck.repo_name}
Time since claim: {int(stuck.hours_since_claim)} hours

The message should:
- Acknowledge that getting stuck is normal
- Offer specific help options
- Mention that mentors are available
- Be encouraging (3-4 sentences)""",

            "final_warning": f"""Write a gentle, supportive message informing a contributor that their issue claim will expire soon, but offering help.

Issue: #{stuck.issue_number} - {stuck.issue_title}
Time remaining: ~{int(stuck.hours_until_expiry)} hours

The message should:
- Be kind and understanding
- Explain the claim will be released so others can try
- Emphasize they can reclaim it later
- Offer last-minute help options
- Not be guilt-inducing (3-4 sentences)"""
        }
        
        try:
            response = client.chat.completions.create(
                model="google/gemini-2.0-flash-001",
                messages=[
                    {"role": "system", "content": "You are a supportive open source community helper."},
                    {"role": "user", "content": prompts.get(nudge_type, prompts["check_in"])}
                ],
                max_tokens=200,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"AI nudge generation failed: {e}")
            return self._get_fallback_message(nudge_type, stuck)
    
    def _get_fallback_message(self, nudge_type: str, stuck: StuckContributor) -> str:
        """Fallback messages if AI fails."""
        messages = {
            "check_in": f"Hi @{stuck.username}! 👋 Just checking in on issue #{stuck.issue_number}. How's it going? Let us know if you need any help!",
            
            "offer_help": f"Hey @{stuck.username}! Working on issue #{stuck.issue_number}? No worries if you're stuck - that's totally normal! Would you like us to connect you with a mentor, or share some helpful resources?",
            
            "final_warning": f"Hi @{stuck.username}! Quick heads up - your claim on issue #{stuck.issue_number} will be released in a few hours so others can try. If you're still working on it and need more time, just let us know! You can always reclaim it later. 💪"
        }
        
        return messages.get(nudge_type, messages["check_in"])
    
    async def _find_relevant_resources(
        self,
        issue_id: str,
        repo_name: str
    ) -> List[Dict[str, str]]:
        """Find resources that might help with this issue."""
        from config.database import db
        
        resources = []
        
        # Get issue details for context
        issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
        if not issue:
            return resources
        
        # Search resource vault
        cursor = db.resources.find(
            {"repo_name": repo_name},
            {"_id": 0}
        ).limit(3)
        
        vault_resources = await cursor.to_list(length=3)
        
        for r in vault_resources:
            resources.append({
                "title": r.get("title", "Resource"),
                "url": r.get("content", ""),
                "type": r.get("resource_type", "link")
            })
        
        return resources
    
    async def _find_potential_mentors(
        self,
        stuck: StuckContributor
    ) -> List[str]:
        """Find mentors who could help."""
        try:
            from services.mentor_matching_service import mentor_matching_service
            
            matches = await mentor_matching_service.find_mentors_for_issue(
                stuck.issue_id,
                limit=2
            )
            
            return [m.mentor_username for m in matches]
            
        except Exception as e:
            logger.error(f"Could not find mentors: {e}")
            return []
    
    async def send_nudge(self, nudge: NudgeMessage) -> bool:
        """
        Send a nudge to a contributor.
        Currently stores in database; could be extended to send emails/notifications.
        
        Args:
            nudge: The nudge message to send
            
        Returns:
            Success status
        """
        from config.database import db
        
        try:
            nudge_record = {
                "recipient_id": nudge.recipient_id,
                "recipient_username": nudge.recipient_username,
                "issue_id": nudge.issue_id,
                "message": nudge.message,
                "resources": nudge.resources,
                "suggested_mentors": nudge.suggested_mentors,
                "nudge_type": nudge.nudge_type,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "delivered": True
            }
            
            await db.nudges_sent.insert_one(nudge_record)
            
            logger.info(f"Sent {nudge.nudge_type} nudge to {nudge.recipient_username}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send nudge: {e}")
            return False
    
    async def process_all_nudges(self) -> Dict[str, Any]:
        """
        Process and send nudges to all stuck contributors.
        
        Returns:
            Summary of nudges sent
        """
        stuck_contributors = await self.check_for_stuck_contributors()
        
        results = {
            "total_stuck": len(stuck_contributors),
            "nudges_sent": 0,
            "nudge_types": {"check_in": 0, "offer_help": 0, "final_warning": 0}
        }
        
        for stuck in stuck_contributors:
            nudge = await self.generate_helpful_nudge(stuck)
            if await self.send_nudge(nudge):
                results["nudges_sent"] += 1
                results["nudge_types"][nudge.nudge_type] += 1
        
        return results
    
    async def get_nudge_history(
        self,
        user_id: str = None,
        issue_id: str = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get history of nudges sent."""
        from config.database import db
        
        query = {}
        if user_id:
            query["recipient_id"] = user_id
        if issue_id:
            query["issue_id"] = issue_id
        
        cursor = db.nudges_sent.find(query, {"_id": 0}).sort("sent_at", -1).limit(limit)
        return await cursor.to_list(length=limit)


# Singleton instance
nudge_service = NudgeService(
    first_nudge_hours=24,
    second_nudge_hours=36,
    final_warning_hours=44
)
