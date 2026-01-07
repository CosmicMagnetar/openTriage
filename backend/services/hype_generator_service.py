"""
Hype Generator Service for OpenTriage.
Generates shareable social media posts for milestones and achievements.
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel

from config.settings import settings

logger = logging.getLogger(__name__)


class Milestone(BaseModel):
    """A milestone or achievement to celebrate."""
    milestone_type: str  # pr_merged, first_contribution, streak, trophy, etc.
    user_id: str
    username: str
    repo_name: Optional[str] = None
    value: Optional[int] = None  # e.g., number of PRs
    description: str = ""
    trophy_name: Optional[str] = None
    achieved_at: datetime = None


class HypePost(BaseModel):
    """A generated social media post."""
    platform: str  # linkedin, twitter/x
    content: str
    hashtags: List[str] = []
    mentioned_users: List[str] = []
    stats_included: Dict[str, Any] = {}
    generated_at: datetime = None


class HypeGeneratorService:
    """
    Service for generating celebratory social media posts.
    
    Features:
    - LinkedIn post generation
    - Twitter/X post generation
    - Stats-based content
    - Hashtag suggestions
    """
    
    def __init__(self):
        self.linkedin_char_limit = 3000
        self.twitter_char_limit = 280
        
        self.default_hashtags = {
            "linkedin": ["#OpenSource", "#Developer", "#GitHub", "#Coding", "#TechCommunity"],
            "twitter": ["#OpenSource", "#100DaysOfCode", "#GitHub", "#DevCommunity"]
        }
    
    async def generate_linkedin_post(self, milestone: Milestone) -> HypePost:
        """
        Generate a LinkedIn-style celebratory post.
        
        Args:
            milestone: The milestone to celebrate
            
        Returns:
            HypePost for LinkedIn
        """
        content = await self._generate_linkedin_content(milestone)
        hashtags = self._get_hashtags_for_milestone(milestone, "linkedin")
        
        return HypePost(
            platform="linkedin",
            content=content,
            hashtags=hashtags,
            mentioned_users=[milestone.username],
            stats_included=await self._get_user_stats(milestone.username),
            generated_at=datetime.now(timezone.utc)
        )
    
    async def generate_twitter_post(self, milestone: Milestone) -> HypePost:
        """
        Generate a Twitter/X celebration post.
        
        Args:
            milestone: The milestone to celebrate
            
        Returns:
            HypePost for Twitter
        """
        content = await self._generate_twitter_content(milestone)
        hashtags = self._get_hashtags_for_milestone(milestone, "twitter")
        
        return HypePost(
            platform="twitter",
            content=content,
            hashtags=hashtags,
            mentioned_users=[milestone.username],
            stats_included={},
            generated_at=datetime.now(timezone.utc)
        )
    
    async def _generate_linkedin_content(self, milestone: Milestone) -> str:
        """Generate LinkedIn post content."""
        try:
            from openai import OpenAI
            
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY
            )
            
            stats = await self._get_user_stats(milestone.username)
            
            prompt = f"""Generate a celebratory LinkedIn post for an open source contribution milestone. 
Make it professional yet engaging.

Milestone Type: {milestone.milestone_type}
Username: @{milestone.username}
Repository: {milestone.repo_name or 'Various projects'}
Description: {milestone.description}
Value: {milestone.value}

User Stats:
- Total PRs: {stats.get('total_prs', 0)}
- Total Contributions: {stats.get('total_contributions', 0)}
- Current Streak: {stats.get('current_streak', 0)} days

Guidelines:
- Start with an emoji and celebratory opener
- Mention the specific achievement
- Include 2-3 sentences about the journey/growth
- End with encouragement for others
- Keep under 300 words
- Don't include hashtags in the text

Do NOT use placeholder brackets like [username] - use the actual values provided."""

            response = client.chat.completions.create(
                model="google/gemini-2.0-flash-001",
                messages=[
                    {"role": "system", "content": "You are a social media content creator specializing in tech and open source."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.8
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"AI generation failed: {e}")
            return self._get_fallback_linkedin(milestone)
    
    async def _generate_twitter_content(self, milestone: Milestone) -> str:
        """Generate Twitter/X post content."""
        try:
            from openai import OpenAI
            
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY
            )
            
            prompt = f"""Generate a celebratory tweet for an open source achievement.

Milestone: {milestone.milestone_type}
Username: @{milestone.username}
Repo: {milestone.repo_name or 'open source'}
Achievement: {milestone.description}

Requirements:
- Must be under 200 characters (leave room for hashtags)
- Start with emoji
- Be genuine and exciting
- No hashtags in the text
- Use actual values, not placeholders"""

            response = client.chat.completions.create(
                model="google/gemini-2.0-flash-001",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                max_tokens=100,
                temperature=0.9
            )
            
            content = response.choices[0].message.content.strip()
            
            # Ensure it fits Twitter limit
            if len(content) > 200:
                content = content[:197] + "..."
            
            return content
            
        except Exception as e:
            logger.error(f"AI generation failed: {e}")
            return self._get_fallback_twitter(milestone)
    
    def _get_fallback_linkedin(self, milestone: Milestone) -> str:
        """Fallback LinkedIn content."""
        templates = {
            "first_pr": f"""🎉 Celebrating a special milestone!

I just merged my first Pull Request on {milestone.repo_name or 'an open source project'}! 

It may seem like a small step, but every contribution to open source starts somewhere. The journey of a thousand commits begins with a single PR!

To anyone thinking about contributing to open source: take that leap! The community is welcoming, and every bit counts.

Special thanks to the maintainers for their guidance and patience. 🙏

Here's to many more contributions! 💪""",

            "streak": f"""🔥 {milestone.value}-Day Contribution Streak! 

Consistency is key, and I'm proud to share that I've maintained a {milestone.value}-day contribution streak on GitHub!

Whether it's code, documentation, or reviews - showing up every day has been transformative. Small daily actions lead to big results.

What habits are you building? Drop them below! 👇""",

            "default": f"""🎊 Milestone Unlocked!

Excited to share: {milestone.description}

Open source has been an incredible journey of learning, collaboration, and growth. Every contribution, no matter how small, makes a difference.

Grateful for this amazing community! 🌟"""
        }
        
        return templates.get(milestone.milestone_type, templates["default"])
    
    def _get_fallback_twitter(self, milestone: Milestone) -> str:
        """Fallback Twitter content."""
        templates = {
            "first_pr": f"🎉 Just merged my first PR to {milestone.repo_name or 'open source'}! The journey begins!",
            "streak": f"🔥 {milestone.value}-day contribution streak! Consistency pays off!",
            "trophy": f"🏆 Unlocked: {milestone.trophy_name}! {milestone.description}",
            "default": f"✨ {milestone.description}"
        }
        
        return templates.get(milestone.milestone_type, templates["default"])
    
    def _get_hashtags_for_milestone(self, milestone: Milestone, platform: str) -> List[str]:
        """Get relevant hashtags for the milestone."""
        hashtags = self.default_hashtags.get(platform, []).copy()
        
        # Add milestone-specific hashtags
        if milestone.milestone_type == "streak":
            hashtags.append("#ConsistencyIsKey")
        elif milestone.milestone_type == "first_pr":
            hashtags.append("#FirstPR")
            hashtags.append("#FirstContribution")
        elif milestone.milestone_type == "trophy":
            hashtags.append("#Achievement")
        
        # Add repo-specific if available
        if milestone.repo_name:
            repo_tag = milestone.repo_name.split('/')[-1].replace('-', '')
            if len(repo_tag) <= 15:
                hashtags.append(f"#{repo_tag}")
        
        return hashtags[:5]  # Limit to 5 hashtags
    
    async def _get_user_stats(self, username: str) -> Dict[str, Any]:
        """Get user statistics for content."""
        from config.database import db
        
        stats = {
            "total_prs": 0,
            "total_issues": 0,
            "total_contributions": 0,
            "current_streak": 0,
            "repos_contributed_to": 0
        }
        
        try:
            # Count PRs
            stats["total_prs"] = await db.issues.count_documents({
                "authorName": username,
                "isPR": True
            })
            
            # Count issues
            stats["total_issues"] = await db.issues.count_documents({
                "authorName": username,
                "isPR": False
            })
            
            stats["total_contributions"] = stats["total_prs"] + stats["total_issues"]
            
            # Get unique repos
            pipeline = [
                {"$match": {"authorName": username}},
                {"$group": {"_id": "$repoName"}},
                {"$count": "count"}
            ]
            result = await db.issues.aggregate(pipeline).to_list(1)
            stats["repos_contributed_to"] = result[0]["count"] if result else 0
            
            # Get streak
            try:
                from services.gamification_engine import gamification_engine
                streak = await gamification_engine.get_user_streak(username)
                stats["current_streak"] = streak.current_streak
            except Exception:
                pass
            
        except Exception as e:
            logger.error(f"Error getting user stats: {e}")
        
        return stats
    
    async def generate_stats_image(self, username: str) -> Optional[bytes]:
        """
        Generate a stats image for sharing.
        Returns PNG bytes of a stats card.
        
        Note: Full implementation would use PIL or similar.
        This returns a placeholder SVG for now.
        """
        stats = await self._get_user_stats(username)
        
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="400" height="200" fill="url(#bgGradient)" rx="10"/>
  
  <text x="20" y="40" font-family="Arial" font-size="20" fill="white" font-weight="bold">
    @{username}'s Open Source Journey
  </text>
  
  <text x="20" y="80" font-family="Arial" font-size="14" fill="#888">
    Pull Requests: <tspan fill="#4CAF50">{stats['total_prs']}</tspan>
  </text>
  
  <text x="20" y="105" font-family="Arial" font-size="14" fill="#888">
    Issues: <tspan fill="#2196F3">{stats['total_issues']}</tspan>
  </text>
  
  <text x="20" y="130" font-family="Arial" font-size="14" fill="#888">
    Current Streak: <tspan fill="#FF9800">{stats['current_streak']} days 🔥</tspan>
  </text>
  
  <text x="20" y="155" font-family="Arial" font-size="14" fill="#888">
    Repos: <tspan fill="#9C27B0">{stats['repos_contributed_to']}</tspan>
  </text>
  
  <text x="20" y="185" font-family="Arial" font-size="10" fill="#555">
    Generated by OpenTriage
  </text>
</svg>'''
        
        return svg.encode('utf-8')


# Singleton instance
hype_generator_service = HypeGeneratorService()
