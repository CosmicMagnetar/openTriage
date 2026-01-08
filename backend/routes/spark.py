"""
Spark API Routes for OpenTriage.
Endpoints for managing Spark jobs and accessing analytics.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel

from spark_manager import (
    get_or_create_spark_session, 
    get_spark_status, 
    is_spark_active
)
from services.cookie_licking_service import cookie_licking_service
from services.invisible_labor_analytics import invisible_labor_analytics
from services.spark_sentiment_pipeline import spark_sentiment_pipeline
from services.gamification_engine import gamification_engine
from services.rag_data_prep import rag_data_prep
from services.badges_service import badges_service
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()



# Request/Response Models

class AnalyticsRequest(BaseModel):
    repo_names: Optional[List[str]] = None
    days: int = 90


class RAGPrepRequest(BaseModel):
    doc_types: Optional[List[str]] = ["issue", "pr", "comment"]
    repo_names: Optional[List[str]] = None
    collection_name: str = "rag_chunks"


class SentimentRequest(BaseModel):
    repo_name: Optional[str] = None
    use_cache: bool = True


# Spark Status Endpoints

@router.get("/status")
async def spark_status():
    """
    Get Spark session status and health.
    """
    status = get_spark_status()
    return {
        "spark": status,
        "services": {
            "streaming": "available",
            "cookie_licking": "available",
            "invisible_labor": "available",
            "sentiment_pipeline": "available",
            "gamification": "available",
            "rag_prep": "available"
        }
    }


@router.post("/initialize")
async def initialize_spark():
    """
    Initialize Spark session.
    """
    try:
        spark = get_or_create_spark_session()
        return {
            "status": "initialized",
            "version": spark.version,
            "ui_url": "http://localhost:4040"
        }
    except Exception as e:
        logger.error(f"Failed to initialize Spark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Cookie-Licking Endpoints

@router.get("/cookie-licking/status")
async def cookie_licking_status(repo_name: Optional[str] = None):
    """
    Get cookie-licking service status and statistics.
    """
    try:
        stats = await cookie_licking_service.get_claim_statistics(repo_name=repo_name)
        return {
            "status": "healthy",
            "scanning": False,
            "settings": {
                "expiry_hours": cookie_licking_service.expiry_hours,
                "activity_window_hours": cookie_licking_service.activity_window_hours,
                "scan_interval_minutes": cookie_licking_service.scan_interval_minutes
            },
            "total_claimed": stats.get("total_claims", 0),
            "active": stats.get("active", 0),
            "at_risk": stats.get("at_risk", 0),
            "expired": stats.get("expired", 0),
            "with_pr": stats.get("with_pr", 0),
            "statistics": stats
        }
    except Exception as e:
        logger.error(f"Cookie-licking status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/cookie-licking/at-risk")
async def get_at_risk_claims(repo_name: Optional[str] = None):
    """
    Get claims that are at risk of expiring.
    """
    try:
        claims = await cookie_licking_service.get_at_risk_claims(repo_name=repo_name)
        return {
            "count": len(claims),
            "claims": claims
        }
    except Exception as e:
        logger.error(f"At-risk claims error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cookie-licking/release-expired")
async def release_expired_claims():
    """
    Manually trigger release of expired claims.
    """
    try:
        result = await cookie_licking_service.release_expired_claims()
        return result
    except Exception as e:
        logger.error(f"Release expired error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cookie-licking/start-scan")
async def start_background_scan():
    """
    Start background scanning for expired claims.
    """
    cookie_licking_service.start_background_scan()
    return {"status": "started"}


@router.post("/cookie-licking/stop-scan")
async def stop_background_scan():
    """
    Stop background scanning.
    """
    cookie_licking_service.stop_background_scan()
    return {"status": "stopped"}


@router.post("/cookie-licking/seed-test-data")
async def seed_test_data():
    """
    Seed test data for cookie-licking monitor demonstration.
    Creates sample claimed issues with various statuses.
    """
    from config.database import db
    from datetime import datetime, timezone, timedelta
    import uuid
    
    now = datetime.now(timezone.utc)
    
    # Sample test data with different claim ages
    test_claims = [
        {
            "issueId": str(uuid.uuid4()),
            "issue_number": 42,
            "issue_title": "Fix navigation bug on mobile",
            "repo_name": "openTriage/frontend",
            "username": "contributor1",
            "claimedAt": (now - timedelta(hours=2)).isoformat(),  # Active - claimed 2h ago
            "lastActivityAt": (now - timedelta(hours=1)).isoformat(),
            "status": "active"
        },
        {
            "issueId": str(uuid.uuid4()),
            "issue_number": 87,
            "issue_title": "Add dark mode toggle",
            "repo_name": "openTriage/frontend",
            "username": "dev_student",
            "claimedAt": (now - timedelta(hours=28)).isoformat(),  # At-risk - claimed 28h ago
            "lastActivityAt": (now - timedelta(hours=26)).isoformat(),
            "status": "at_risk"
        },
        {
            "issueId": str(uuid.uuid4()),
            "issue_number": 156,
            "issue_title": "Improve API error handling",
            "repo_name": "openTriage/backend",
            "username": "newbie_coder",
            "claimedAt": (now - timedelta(hours=40)).isoformat(),  # At-risk - claimed 40h ago
            "lastActivityAt": (now - timedelta(hours=38)).isoformat(),
            "status": "at_risk"
        },
        {
            "issueId": str(uuid.uuid4()),
            "issue_number": 201,
            "issue_title": "Add unit tests for auth module",
            "repo_name": "openTriage/backend",
            "username": "ghost_dev",
            "claimedAt": (now - timedelta(hours=50)).isoformat(),  # Expired - claimed 50h ago
            "lastActivityAt": (now - timedelta(hours=49)).isoformat(),
            "status": "expired"
        },
        {
            "issueId": str(uuid.uuid4()),
            "issue_number": 305,
            "issue_title": "Refactor database queries",
            "repo_name": "openTriage/backend",
            "username": "busy_contributor",
            "claimedAt": (now - timedelta(hours=20)).isoformat(),  # Active - claimed 20h ago
            "lastActivityAt": (now - timedelta(hours=5)).isoformat(),
            "status": "active"
        },
    ]
    
    # Clear existing test data
    await db.claimed_issues.delete_many({})
    
    # Insert test data
    await db.claimed_issues.insert_many(test_claims)
    
    return {
        "success": True,
        "message": f"Seeded {len(test_claims)} test claimed issues",
        "claims": test_claims
    }



# Invisible Labor Analytics Endpoints

@router.post("/analytics/invisible-labor")
async def compute_invisible_labor(request: AnalyticsRequest):
    """
    Compute invisible labor metrics using Spark.
    """
    try:
        metrics = await invisible_labor_analytics.compute_all_metrics(
            repo_names=request.repo_names,
            days=request.days
        )
        return {
            "count": len(metrics),
            "period_days": request.days,
            "metrics": [m.model_dump() for m in metrics]
        }
    except Exception as e:
        logger.error(f"Invisible labor analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/invisible-labor/top/{limit}")
async def get_top_invisible_labor_contributors(
    limit: int = 10,
    days: int = 90
):
    """
    Get top invisible labor contributors.
    """
    try:
        contributors = await invisible_labor_analytics.get_top_contributors(
            days=days,
            limit=limit
        )
        return {
            "count": len(contributors),
            "contributors": contributors
        }
    except Exception as e:
        logger.error(f"Top contributors error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/invisible-labor/user/{username}")
async def get_user_invisible_labor(username: str, days: int = 90):
    """
    Get invisible labor metrics for a specific user.
    """
    try:
        metrics = await invisible_labor_analytics.get_user_metrics(username, days)
        if metrics is None:
            raise HTTPException(status_code=404, detail="User not found")
        return metrics.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/invisible-labor/repo/{owner}/{repo}")
async def get_repo_invisible_labor_summary(owner: str, repo: str, days: int = 90):
    """
    Get invisible labor summary for a repository.
    """
    try:
        repo_name = f"{owner}/{repo}"
        summary = await invisible_labor_analytics.get_repo_summary(repo_name, days)
        return summary
    except Exception as e:
        logger.error(f"Repo summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Sentiment Pipeline Endpoints

@router.post("/sentiment/analyze")
async def run_sentiment_analysis(request: SentimentRequest, background_tasks: BackgroundTasks):
    """
    Run sentiment analysis pipeline.
    """
    if request.repo_name:
        try:
            result = await spark_sentiment_pipeline.analyze_repo_sentiment(request.repo_name)
            return result
        except Exception as e:
            logger.error(f"Repo sentiment analysis error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    else:
        try:
            result = await spark_sentiment_pipeline.run_pipeline(use_cache=request.use_cache)
            return result
        except Exception as e:
            logger.error(f"Sentiment pipeline error: {e}")
            raise HTTPException(status_code=500, detail=str(e))


# Gamification Endpoints

@router.get("/gamification/user/{username}")
async def get_user_gamification(username: str):
    """
    Get complete gamification data for a user.
    """
    try:
        data = await gamification_engine.get_user_gamification_data(username)
        return data
    except Exception as e:
        logger.error(f"Gamification data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gamification/streak/{username}")
async def get_user_streak(username: str, days: int = 365):
    """
    Get contribution streak for a user.
    """
    try:
        streak = await gamification_engine.get_user_streak(username, days)
        return streak.model_dump()
    except Exception as e:
        logger.error(f"Streak error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gamification/calendar/{username}")
async def get_user_impact_calendar(username: str, days: int = 365):
    """
    Get Impact Calendar data for a user.
    """
    try:
        calendar = await gamification_engine.get_user_impact_calendar(username, days)
        return {
            "username": username,
            "days": len(calendar),
            "calendar": [day.model_dump() for day in calendar]
        }
    except Exception as e:
        logger.error(f"Calendar error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gamification/leaderboard")
async def get_leaderboard(days: int = 30, limit: int = 10):
    """
    Get contribution leaderboard.
    """
    try:
        leaderboard = await gamification_engine.get_leaderboard(days=days, limit=limit)
        return {
            "period_days": days,
            "count": len(leaderboard),
            "leaderboard": leaderboard
        }
    except Exception as e:
        logger.error(f"Leaderboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# RAG Data Prep Endpoints

@router.post("/rag/prepare")
async def prepare_rag_data(request: RAGPrepRequest):
    """
    Prepare documents for Vector DB using Spark.
    """
    try:
        result = await rag_data_prep.prepare_and_store(
            doc_types=request.doc_types,
            repo_names=request.repo_names,
            collection_name=request.collection_name
        )
        return result
    except Exception as e:
        logger.error(f"RAG prep error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rag/chunks")
async def get_rag_chunks(batch_size: int = 100, skip_embedded: bool = True):
    """
    Get chunks ready for embedding.
    """
    try:
        chunks = await rag_data_prep.get_chunks_for_embedding(
            batch_size=batch_size,
            skip_embedded=skip_embedded
        )
        return {
            "count": len(chunks),
            "chunks": chunks
        }
    except Exception as e:
        logger.error(f"Get chunks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Batch Job Management

@router.post("/jobs/full-analytics")
async def run_full_analytics(request: AnalyticsRequest, background_tasks: BackgroundTasks):
    """
    Run all analytics jobs (invisible labor, sentiment, gamification).
    """
    async def run_jobs():
        results = {}
        
        try:
            results["invisible_labor"] = await invisible_labor_analytics.compute_all_metrics(
                repo_names=request.repo_names,
                days=request.days
            )
            results["invisible_labor"] = {"status": "completed", "count": len(results["invisible_labor"])}
        except Exception as e:
            results["invisible_labor"] = {"status": "failed", "error": str(e)}
        
        try:
            results["sentiment"] = await spark_sentiment_pipeline.run_pipeline()
        except Exception as e:
            results["sentiment"] = {"status": "failed", "error": str(e)}
        
        try:
            leaderboard = await gamification_engine.get_leaderboard(days=request.days)
            results["gamification"] = {"status": "completed", "leaderboard_entries": len(leaderboard)}
        except Exception as e:
            results["gamification"] = {"status": "failed", "error": str(e)}
        
        logger.info(f"Full analytics completed: {results}")
    
    background_tasks.add_task(run_jobs)
    
    return {
        "status": "started",
        "message": "Full analytics running in background"
    }


# ============ Badges Endpoints ============

@router.get("/badges/all")
async def get_all_badges():
    """Get all available badges."""
    try:
        badges = badges_service.get_all_badges()
        return {
            "count": len(badges),
            "badges": [b.model_dump() for b in badges]
        }
    except Exception as e:
        logger.error(f"Get all badges error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/badges/user/{username}")
async def get_user_badges(username: str, current_user: dict = Depends(get_current_user)):
    """Get badges for a user."""
    try:
        # Use the requesting user's ID if viewing own profile, otherwise query by username
        user_id = current_user.get("id", "") if current_user.get("username") == username else ""
        result = await badges_service.get_user_badges(user_id, username)
        return result
    except Exception as e:
        logger.error(f"Get user badges error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/badges/check/{username}")
async def check_and_award_badges(username: str, current_user: dict = Depends(get_current_user)):
    """Check and award any new badges for a user."""
    try:
        # Only allow users to check their own badges for security
        if current_user.get("username") != username:
            raise HTTPException(status_code=403, detail="Can only check badges for your own account")
        
        user_id = current_user.get("id", "")
        new_badges = await badges_service.check_and_award_badges(user_id, username)
        return {
            "new_badges_count": len(new_badges),
            "new_badges": [b.model_dump() for b in new_badges]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Check badges error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

