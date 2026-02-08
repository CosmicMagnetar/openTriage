"""
Sentiment Analysis Service for OpenTriage

Uses local Hugging Face DistilBERT model for fast, offline sentiment analysis
of PR comments. Detects sentiment scores and prominent language patterns.

Features:
- DistilBERT sentiment classification (local, no API calls)
- Keyword-based prominent language detection
- In-memory result caching (10-minute TTL)
- Stage 3 RAG prompt integration-ready
"""

import logging
import time
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Lazy-load transformers (only when needed)
_sentiment_pipeline = None
_cache = {}  # {comment_id: {"sentiment": {...}, "timestamp": float}}
CACHE_TTL = 600  # 10 minutes

# Keyword patterns for prominent language detection
LANGUAGE_PATTERNS = {
    "technical": ["bug", "error", "crash", "fix", "optimize", "refactor", "api", "database", "performance", "memory", "cpu"],
    "positive": ["great", "excellent", "amazing", "love", "perfect", "awesome", "wonderful", "fantastic", "brilliant"],
    "negative": ["bad", "horrible", "terrible", "hate", "useless", "broken", "awful", "pathetic", "worst"],
    "urgent": ["critical", "urgent", "asap", "immediately", "emergency", "blocker", "must", "breaking"],
    "discussion": ["thought", "idea", "suggestion", "question", "wondering", "propose", "consider", "discuss"],
    "documentation": ["doc", "readme", "guide", "tutorial", "example", "comment", "explain"],
    "testing": ["test", "coverage", "regression", "edge case", "unit test", "integration test", "quality"]
}


def _get_sentiment_pipeline():
    """Lazy-load the sentiment analysis pipeline on first use."""
    global _sentiment_pipeline
    
    if _sentiment_pipeline is None:
        try:
            from transformers import pipeline
            logger.info("[Sentiment] Loading DistilBERT sentiment-analysis model...")
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                device=-1  # CPU mode (set to 0 for GPU if available)
            )
            logger.info("[Sentiment] ✅ DistilBERT model loaded successfully")
        except Exception as e:
            logger.error(f"[Sentiment] Failed to load DistilBERT: {e}")
            raise
    
    return _sentiment_pipeline


def _detect_prominent_language(text: str) -> str:
    """
    Detect prominent language patterns from comment text.
    Returns the most relevant category.
    """
    if not text:
        return "neutral"
    
    text_lower = text.lower()
    pattern_scores = {}
    
    for pattern, keywords in LANGUAGE_PATTERNS.items():
        # Count keyword matches
        matches = sum(1 for keyword in keywords if keyword in text_lower)
        if matches > 0:
            pattern_scores[pattern] = matches
    
    # Return the category with most matches, or "neutral" if none found
    if not pattern_scores:
        return "neutral"
    
    return max(pattern_scores.items(), key=lambda x: x[1])[0]


def _is_cache_valid(timestamp: float) -> bool:
    """Check if cached entry is still valid (not expired)."""
    return (time.time() - timestamp) < CACHE_TTL


def analyze_comment_sentiment(
    comment_id: str,
    comment_text: str,
    author: str = "unknown",
    force_recalc: bool = False
) -> Dict[str, Any]:
    """
    Analyze the sentiment of a PR comment using DistilBERT.
    
    Args:
        comment_id: Unique comment identifier
        comment_text: The comment body text
        author: Comment author (for logging)
        force_recalc: Force recalculation even if cached
        
    Returns:
        Dict with:
        - sentiment_label: "POSITIVE" or "NEGATIVE"
        - sentiment_score: Confidence score (0.0-1.0)
        - prominent_language: Detected language category
        - raw_scores: Full model output (all labels with scores)
        - cached: Whether result came from cache
        - analyzed_at: ISO timestamp
    """
    # Check cache first
    if not force_recalc and comment_id in _cache:
        cache_entry = _cache[comment_id]
        if _is_cache_valid(cache_entry["timestamp"]):
            logger.info(f"[Sentiment] Cache HIT for comment {comment_id} by {author}")
            result = cache_entry["result"].copy()
            result["cached"] = True
            return result
        else:
            # Cache expired, remove it
            del _cache[comment_id]
            logger.info(f"[Sentiment] Cache expired for comment {comment_id}")
    
    logger.info(f"[Sentiment] Analyzing comment {comment_id} by {author}")
    
    try:
        # Get sentiment pipeline
        pipeline = _get_sentiment_pipeline()
        
        # Truncate very long comments (keep first 512 tokens for DistilBERT)
        truncated_text = comment_text[:512] if len(comment_text) > 512 else comment_text
        
        # Run sentiment analysis
        results = pipeline(truncated_text)
        
        if not results:
            logger.warning(f"[Sentiment] No results from model for comment {comment_id}")
            return {
                "sentiment_label": "NEUTRAL",
                "sentiment_score": 0.5,
                "prominent_language": "neutral",
                "raw_scores": [],
                "cached": False,
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
                "error": "Model returned no results"
            }
        
        # Extract sentiment info
        primary_result = results[0]
        sentiment_label = primary_result["label"]  # "POSITIVE" or "NEGATIVE"
        sentiment_score = primary_result["score"]  # Confidence (0.0-1.0)
        
        # Detect prominent language patterns
        prominent_language = _detect_prominent_language(comment_text)
        
        # Build response
        response = {
            "sentiment_label": sentiment_label,
            "sentiment_score": round(sentiment_score, 3),
            "prominent_language": prominent_language,
            "raw_scores": [
                {
                    "label": r["label"],
                    "score": round(r["score"], 3)
                } for r in results
            ],
            "cached": False,
            "analyzed_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Cache the result
        _cache[comment_id] = {
            "result": response.copy(),
            "timestamp": time.time()
        }
        
        logger.info(
            f"[Sentiment] ✅ Comment {comment_id}: {sentiment_label} "
            f"(score: {sentiment_score:.3f}, language: {prominent_language})"
        )
        
        return response
        
    except Exception as e:
        logger.error(f"[Sentiment] Error analyzing comment {comment_id}: {e}")
        return {
            "sentiment_label": "NEUTRAL",
            "sentiment_score": 0.5,
            "prominent_language": "neutral",
            "raw_scores": [],
            "cached": False,
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }


def analyze_batch_comments(comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyze sentiment for multiple comments at once.
    
    Args:
        comments: List of dicts with keys: id, body, author (optional)
        
    Returns:
        List of sentiment analysis results
    """
    results = []
    
    for comment in comments:
        comment_id = comment.get("id", f"comment_{len(results)}")
        comment_text = comment.get("body", "")
        author = comment.get("author", "unknown")
        
        if not comment_text:
            logger.warning(f"Skipping comment {comment_id} with empty body")
            continue
        
        result = analyze_comment_sentiment(
            comment_id=comment_id,
            comment_text=comment_text,
            author=author
        )
        
        result["comment_id"] = comment_id
        result["author"] = author
        results.append(result)
    
    return results


def get_sentiment_summary(comments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Get aggregate sentiment summary from multiple comments.
    
    Useful for Stage 3 prompt: "What's the overall mood of reviewers?"
    
    Args:
        comments: List of sentiment analysis results
        
    Returns:
        Summary dict with:
        - overall_sentiment: Dominant sentiment
        - average_score: Mean sentiment score
        - positive_count: Number of positive comments
        - negative_count: Number of negative comments
        - prominent_languages: Top language categories
        - mood_description: Human-readable description
    """
    if not comments:
        return {
            "overall_sentiment": "NEUTRAL",
            "average_score": 0.5,
            "positive_count": 0,
            "negative_count": 0,
            "prominent_languages": [],
            "mood_description": "No comments to analyze"
        }
    
    positive_count = sum(1 for c in comments if c.get("sentiment_label") == "POSITIVE")
    negative_count = sum(1 for c in comments if c.get("sentiment_label") == "NEGATIVE")
    
    # Calculate average sentiment score
    scores = [c.get("sentiment_score", 0.5) for c in comments]
    average_score = sum(scores) / len(scores) if scores else 0.5
    
    # Count prominent languages
    language_counts = {}
    for comment in comments:
        lang = comment.get("prominent_language", "neutral")
        language_counts[lang] = language_counts.get(lang, 0) + 1
    
    top_languages = sorted(language_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    
    # Determine overall sentiment
    if positive_count > negative_count * 1.5:
        overall = "POSITIVE"
        mood = "Reviewers are enthusiastic and supportive"
    elif negative_count > positive_count * 1.5:
        overall = "NEGATIVE"
        mood = "Reviewers have concerns or objections"
    else:
        overall = "MIXED"
        mood = "Reviewers have mixed feedback with discussion"
    
    return {
        "overall_sentiment": overall,
        "average_score": round(average_score, 3),
        "positive_count": positive_count,
        "negative_count": negative_count,
        "neutral_count": len(comments) - positive_count - negative_count,
        "prominent_languages": [lang for lang, _ in top_languages],
        "mood_description": mood,
        "total_comments": len(comments)
    }


def clear_cache():
    """Clear the sentiment analysis cache."""
    global _cache
    _cache.clear()
    logger.info("[Sentiment] Cache cleared")


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    valid_entries = sum(1 for e in _cache.values() if _is_cache_valid(e["timestamp"]))
    
    return {
        "total_entries": len(_cache),
        "valid_entries": valid_entries,
        "expired_entries": len(_cache) - valid_entries,
        "cache_ttl_seconds": CACHE_TTL,
        "model_loaded": _sentiment_pipeline is not None
    }


# Service instance (singleton)
sentiment_analysis_service = type('SentimentAnalysisService', (), {
    'analyze_comment': analyze_comment_sentiment,
    'analyze_batch': analyze_batch_comments,
    'get_summary': get_sentiment_summary,
    'clear_cache': clear_cache,
    'get_cache_stats': get_cache_stats
})()
