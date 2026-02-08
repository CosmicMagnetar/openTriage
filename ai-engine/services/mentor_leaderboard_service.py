"""
Mentor Leaderboard Service - AI-powered ranking system with sentiment analysis.

Generates mentor rankings based on:
- Sentiment analysis of conversations
- Programming language expertise detection  
- Engagement metrics (session count, mentee count)
- Manual edits by maintainer

Saves rankings to MongoDB for persistence.
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter
import re

from config.database import db
from models.mentor_leaderboard import (
    MentorLeaderboardEntry,
    LeaderboardConfig,
    LeaderboardEdit,
    LeaderboardResponse
)
from services.sentiment_analysis_service import sentiment_analysis_service

logger = logging.getLogger(__name__)


class MentorLeaderboardService:
    """Service for generating and managing mentor leaderboards."""
    
    def __init__(self):
        self.db = db
        self.sentiment_service = sentiment_analysis_service
        self.config: Optional[LeaderboardConfig] = None
        self._config_cache_time = None
        
    async def _get_config(self) -> LeaderboardConfig:
        """Get or create leaderboard configuration."""
        if self.config and self._config_cache_time:
            # Cache for 1 hour
            if (datetime.now(timezone.utc) - self._config_cache_time).total_seconds() < 3600:
                return self.config
        
        config_doc = await self.db.leaderboard_config.find_one({})
        if config_doc:
            config_doc.pop('_id', None)
            self.config = LeaderboardConfig(**config_doc)
        else:
            self.config = LeaderboardConfig()
            await self.db.leaderboard_config.insert_one(self.config.dict())
        
        self._config_cache_time = datetime.now(timezone.utc)
        return self.config
    
    async def analyze_mentor_conversations(self, mentor_id: str, mentor_username: str) -> Dict:
        """
        Analyze all conversations for a single mentor.
        
        Fetches all chat sessions, extracts sentiment data, detects languages.
        """
        config = await self._get_config()
        
        # Fetch all chat sessions for this mentor
        sessions = await self.db.chat_sessions.find({
            "mentor_id": mentor_id,
            "status": "completed"
        }).to_list(None)
        
        if not sessions:
            logger.info(f"No completed sessions for mentor {mentor_username}")
            return {
                "mentor_id": mentor_id,
                "mentor_username": mentor_username,
                "total_sessions": 0,
                "conversations_analyzed": 0,
                "avg_sentiment_score": 0.0,
                "positive_sentiment_ratio": 0.0,
                "language_proficiency": {},
                "best_language": None,
                "total_mentees": 0,
                "avg_session_duration_minutes": 0.0
            }
        
        # Collect all messages from these sessions
        sentiment_scores = []
        language_mentions = defaultdict(int)
        total_mentees = set()
        total_duration = 0
        all_messages = []
        
        for session in sessions:
            session_id = session.get('_id') or session.get('id')
            total_mentees.update(session.get('mentee_ids', []))
            total_duration += session.get('duration_minutes', 0)
            
            # Fetch all messages in this session
            messages = await self.db.chat_messages.find({
                "session_id": str(session_id)
            }).to_list(None)
            
            all_messages.extend(messages)
        
        # Analyze sentiment of all mentor messages
        mentor_messages = [m for m in all_messages if m.get('is_mentor', False)]
        
        if mentor_messages:
            message_texts = [m.get('content', '') for m in mentor_messages]
            
            # Batch sentiment analysis
            comments = [
                {"id": f"msg_{i}", "body": text, "author": mentor_username}
                for i, text in enumerate(message_texts)
            ]
            
            sentiment_results = self.sentiment_service.analyze_batch(comments)
            
            for result in sentiment_results:
                score = result.get('sentiment_score', 0.5)
                sentiment_scores.append(score)
            
            # Extract programming languages from all messages
            for message in mentor_messages:
                content = message.get('content', '').lower()
                language = message.get('language', '').lower()
                
                # Check for language mentions in message content
                for lang in config.programming_languages:
                    pattern = r'\b' + re.escape(lang) + r'\b'
                    matches = len(re.findall(pattern, content))
                    if matches > 0:
                        language_mentions[lang] += matches
                
                # Also check explicit language tags
                if language and language in config.programming_languages:
                    language_mentions[language] += 5  # Higher weight for explicit tags
        
        # Compute aggregates
        avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0.5
        
        positive_count = sum(1 for s in sentiment_scores if s >= config.positive_sentiment_threshold)
        positive_ratio = positive_count / len(sentiment_scores) if sentiment_scores else 0.0
        
        # Normalize language proficiency (0-100 scale)
        best_language = None
        language_proficiency = {}
        
        if language_mentions:
            max_mentions = max(language_mentions.values())
            for lang, mentions in sorted(language_mentions.items(), key=lambda x: x[1], reverse=True)[:10]:
                score = (mentions / max_mentions) * 100
                language_proficiency[lang] = score
                if not best_language:
                    best_language = lang
        
        avg_duration = total_duration / len(sessions) if sessions else 0
        
        return {
            "mentor_id": mentor_id,
            "mentor_username": mentor_username,
            "total_sessions": len(sessions),
            "conversations_analyzed": len(sentiment_scores),
            "avg_sentiment_score": round(avg_sentiment, 2),
            "positive_sentiment_ratio": round(positive_ratio, 2),
            "language_proficiency": language_proficiency,
            "best_language": best_language,
            "total_mentees": len(total_mentees),
            "avg_session_duration_minutes": round(avg_duration, 1),
            "sentiment_scores": sentiment_scores  # For internal calculation
        }
    
    async def generate_leaderboard(self, exclude_maintainer_id: Optional[str] = None) -> LeaderboardResponse:
        """
        Generate complete mentor leaderboard.
        
        Analyzes all mentors' conversations and ranks them.
        Excludes the maintainer if specified.
        """
        config = await self._get_config()
        logger.info("Generating mentor leaderboard...")
        
        # Fetch all active mentor profiles
        mentors = await self.db.mentor_profiles.find({
            "is_active": True
        }).to_list(None)
        
        if exclude_maintainer_id:
            mentors = [m for m in mentors if m.get('user_id') != exclude_maintainer_id]
        
        entries = []
        mentor_scores = {}
        
        # Analyze each mentor
        for mentor in mentors:
            mentor_id = mentor.get('user_id') or mentor.get('id')
            mentor_username = mentor.get('username', 'Unknown')
            
            analysis = await self.analyze_mentor_conversations(mentor_id, mentor_username)
            
            # Only include mentors with minimum session requirement
            if analysis['total_sessions'] < config.min_sessions_for_ranking:
                logger.debug(f"Mentor {mentor_username} has fewer than {config.min_sessions_for_ranking} sessions")
                continue
            
            # Compute component scores (0-100)
            sentiment_score = (analysis['avg_sentiment_score'] * 100) if analysis['conversations_analyzed'] > 0 else 50
            
            engagement_score = min(100, (analysis['total_sessions'] / 10) * 100)  # Scale by 10
            expertise_score = max(analysis['language_proficiency'].values()) if analysis['language_proficiency'] else 50
            
            # Compute weighted overall score
            overall_score = (
                (sentiment_score * config.sentiment_weight) +
                (expertise_score * config.expertise_weight) +
                (engagement_score * config.engagement_weight)
            )
            
            mentor_scores[mentor_id] = overall_score
            
            # Check for existing entry (for edit history)
            existing_entry = await self.db.leaderboard_entries.find_one({"mentor_id": mentor_id})
            old_overall_score = existing_entry.get('overall_score', 0) if existing_entry else 0
            
            # Create leaderboard entry
            entry = MentorLeaderboardEntry(
                mentor_id=mentor_id,
                mentor_username=mentor_username,
                overall_score=round(overall_score, 2),
                sentiment_score=round(sentiment_score, 2),
                expertise_score=round(expertise_score, 2),
                engagement_score=round(engagement_score, 2),
                best_language=analysis['best_language'],
                language_proficiency=analysis['language_proficiency'],
                avg_sentiment_score=round(analysis['avg_sentiment_score'], 2),
                positive_sentiment_ratio=round(analysis['positive_sentiment_ratio'], 2),
                conversations_analyzed=analysis['conversations_analyzed'],
                total_sessions=analysis['total_sessions'],
                total_mentees=analysis['total_mentees'],
                avg_session_duration_minutes=analysis['avg_session_duration_minutes'],
                is_custom_edited=existing_entry.get('is_custom_edited', False) if existing_entry else False,
                custom_notes=existing_entry.get('custom_notes', '') if existing_entry else None,
                manual_adjustments=existing_entry.get('manual_adjustments', {}) if existing_entry else {},
                last_edited_by=existing_entry.get('last_edited_by') if existing_entry else None,
                edit_history=existing_entry.get('edit_history', []) if existing_entry else []
            )
            
            entries.append(entry)
        
        # Sort by overall score and assign ranks
        entries.sort(key=lambda e: e.overall_score, reverse=True)
        
        for i, entry in enumerate(entries):
            entry.rank = i + 1
            
            # Calculate rank change from previous ranking
            if mentor_scores:
                prev_rank = 0
                for j, other_id in enumerate(sorted(mentor_scores.keys(), key=lambda x: mentor_scores[x], reverse=True)):
                    if other_id == entry.mentor_id:
                        prev_rank = j + 1
                        break
                if prev_rank > 0:
                    entry.rank_change = prev_rank - entry.rank
        
        # Save entries to database
        for entry in entries:
            await self.db.leaderboard_entries.update_one(
                {"mentor_id": entry.mentor_id},
                {"$set": entry.dict()},
                upsert=True
            )
        
        logger.info(f"Generated leaderboard with {len(entries)} mentors")
        
        return LeaderboardResponse(
            entries=entries,
            total_mentors=len(entries),
            config=config
        )
    
    async def get_leaderboard(self, limit: int = 50, skip: int = 0) -> LeaderboardResponse:
        """Fetch cached leaderboard from database."""
        entries_data = await self.db.leaderboard_entries.find({}).sort(
            "rank", 1
        ).skip(skip).limit(limit).to_list(None)
        
        entries = []
        for data in entries_data:
            data.pop('_id', None)
            entries.append(MentorLeaderboardEntry(**data))
        
        total = await self.db.leaderboard_entries.count_documents({})
        config = await self._get_config()
        
        return LeaderboardResponse(
            entries=entries,
            total_mentors=total,
            config=config
        )
    
    async def edit_entry(self, mentor_id: str, **updates) -> MentorLeaderboardEntry:
        """
        Allow maintainer to edit a leaderboard entry.
        
        Tracks all edits in edit_history.
        """
        maintainer_id = updates.pop('edited_by', 'admin')
        reason = updates.pop('reason', 'Manual adjustment')
        
        # Fetch existing entry
        entry_data = await self.db.leaderboard_entries.find_one({"mentor_id": mentor_id})
        if not entry_data:
            raise ValueError(f"Leaderboard entry not found for mentor {mentor_id}")
        
        entry_data.pop('_id', None)
        entry = MentorLeaderboardEntry(**entry_data)
        
        # Record edits
        edit_history = entry.edit_history or []
        
        for field, new_value in updates.items():
            if field in ['custom_notes', 'manual_adjustments']:
                # Direct field updates
                old_value = getattr(entry, field, None)
                setattr(entry, field, new_value)
                entry.is_custom_edited = True
            elif field.startswith('score_'):
                # Score adjustments (sentiment_score, expertise_score, etc.)
                actual_field = field.replace('score_', '') + '_score'
                old_value = getattr(entry, actual_field, 0)
                setattr(entry, actual_field, new_value)
                entry.manual_adjustments[actual_field] = new_value - old_value
                entry.is_custom_edited = True
            
            # Log the edit
            edit_history.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "edited_by": maintainer_id,
                "field": field,
                "old_value": old_value,
                "new_value": new_value,
                "reason": reason
            })
        
        # Recalculate overall score if component scores changed
        config = await self._get_config()
        entry.overall_score = (
            (entry.sentiment_score * config.sentiment_weight) +
            (entry.expertise_score * config.expertise_weight) +
            (entry.engagement_score * config.engagement_weight)
        )
        
        entry.edit_history = edit_history[-100:]  # Keep last 100 edits
        entry.last_edited_by = maintainer_id
        entry.last_updated = datetime.now(timezone.utc)
        
        # Save back to database
        await self.db.leaderboard_entries.update_one(
            {"mentor_id": mentor_id},
            {"$set": entry.dict()},
            upsert=False
        )
        
        logger.info(f"Updated leaderboard entry for {mentor_id}: {updates}")
        
        return entry
    
    async def get_entry(self, mentor_id: str) -> Optional[MentorLeaderboardEntry]:
        """Get a single leaderboard entry."""
        data = await self.db.leaderboard_entries.find_one({"mentor_id": mentor_id})
        if data:
            data.pop('_id', None)
            return MentorLeaderboardEntry(**data)
        return None
    
    async def export_leaderboard(self, format: str = "json") -> str:
        """Export leaderboard in various formats."""
        response = await self.get_leaderboard(limit=1000)
        
        if format == "json":
            import json
            return json.dumps(
                [e.dict() for e in response.entries],
                default=str
            )
        elif format == "csv":
            import csv
            from io import StringIO
            
            output = StringIO()
            writer = csv.DictWriter(output, fieldnames=[
                "rank", "mentor_username", "overall_score", "sentiment_score",
                "expertise_score", "engagement_score", "best_language",
                "total_sessions", "avg_sentiment_score"
            ])
            writer.writeheader()
            
            for entry in response.entries:
                writer.writerow({
                    "rank": entry.rank,
                    "mentor_username": entry.mentor_username,
                    "overall_score": entry.overall_score,
                    "sentiment_score": entry.sentiment_score,
                    "expertise_score": entry.expertise_score,
                    "engagement_score": entry.engagement_score,
                    "best_language": entry.best_language,
                    "total_sessions": entry.total_sessions,
                    "avg_sentiment_score": entry.avg_sentiment_score
                })
            
            return output.getvalue()
        
        return ""


# Singleton instance
mentor_leaderboard_service = MentorLeaderboardService()
