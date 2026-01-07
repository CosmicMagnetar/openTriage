"""
Trophy/Badge API Routes for OpenTriage.
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from services.trophy_service import trophy_service
from models.trophy import TrophyType

logger = logging.getLogger(__name__)
router = APIRouter()


# Routes

@router.get("/user/{user_id}")
async def get_user_trophies(user_id: str, username: str):
    """
    Get all trophies earned by a user.
    """
    try:
        trophies = await trophy_service.get_user_trophies(user_id)
        stats = await trophy_service.get_user_trophy_stats(user_id, username)
        
        return {
            "user_id": user_id,
            "username": username,
            "stats": stats.model_dump(),
            "trophies": [t.model_dump() for t in trophies]
        }
    except Exception as e:
        logger.error(f"Get user trophies error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{trophy_id}")
async def get_trophy(trophy_id: str):
    """
    Get trophy details by ID.
    """
    try:
        from config.database import db
        
        trophy = await db.trophies.find_one(
            {"id": trophy_id},
            {"_id": 0}
        )
        
        if not trophy:
            raise HTTPException(status_code=404, detail="Trophy not found")
        
        return trophy
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get trophy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{trophy_id}/svg")
async def get_trophy_svg(trophy_id: str):
    """
    Get trophy SVG badge image.
    """
    try:
        svg = await trophy_service.get_trophy_svg(trophy_id)
        
        if not svg:
            raise HTTPException(status_code=404, detail="Trophy not found")
        
        return Response(
            content=svg,
            media_type="image/svg+xml",
            headers={
                "Cache-Control": "public, max-age=86400"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get trophy SVG error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check")
async def check_achievements(user_id: str, username: str):
    """
    Check and award any earned trophies for a user.
    """
    try:
        awarded = await trophy_service.check_and_award_trophies(
            user_id=user_id,
            username=username
        )
        
        return {
            "checked": True,
            "new_trophies_count": len(awarded),
            "new_trophies": [t.model_dump() for t in awarded]
        }
    except Exception as e:
        logger.error(f"Check achievements error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leaderboard")
async def get_trophy_leaderboard(limit: int = 10):
    """
    Get trophy leaderboard.
    """
    try:
        leaderboard = await trophy_service.get_leaderboard(limit=limit)
        
        return {
            "count": len(leaderboard),
            "leaderboard": leaderboard
        }
    except Exception as e:
        logger.error(f"Leaderboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/types")
async def get_trophy_types():
    """
    Get all available trophy types with metadata.
    """
    from models.trophy import TROPHY_METADATA
    
    return {
        "count": len(TROPHY_METADATA),
        "types": [
            {
                "type": t.value,
                **TROPHY_METADATA.get(t, {})
            }
            for t in TrophyType
        ]
    }
