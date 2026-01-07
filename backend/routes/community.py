"""
Community Features API Routes for OpenTriage.
Includes nudges, resource vault, and hype generator.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel

from services.nudge_service import nudge_service
from services.resource_vault_service import resource_vault_service
from services.hype_generator_service import hype_generator_service, Milestone
from models.resource import ResourceType
from models.user import User
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ============ Nudge Routes ============

@router.get("/nudges/stuck")
async def get_stuck_contributors():
    """
    Get list of contributors who may be stuck.
    """
    try:
        stuck = await nudge_service.check_for_stuck_contributors()
        
        return {
            "count": len(stuck),
            "contributors": [s.model_dump() for s in stuck]
        }
    except Exception as e:
        logger.error(f"Get stuck contributors error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nudges/send-all")
async def process_all_nudges():
    """
    Process and send nudges to all stuck contributors.
    """
    try:
        results = await nudge_service.process_all_nudges()
        return results
    except Exception as e:
        logger.error(f"Process nudges error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nudges/history")
async def get_nudge_history(
    user_id: Optional[str] = None,
    issue_id: Optional[str] = None,
    limit: int = 20
):
    """
    Get history of nudges sent.
    """
    try:
        history = await nudge_service.get_nudge_history(
            user_id=user_id,
            issue_id=issue_id,
            limit=limit
        )
        
        return {
            "count": len(history),
            "nudges": history
        }
    except Exception as e:
        logger.error(f"Get nudge history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Resource Vault Routes ============

class ExtractResourcesRequest(BaseModel):
    message: str
    author: str
    author_id: str
    repo_name: str
    source_type: str = "chat"
    source_id: Optional[str] = None


class SearchResourcesRequest(BaseModel):
    query: str
    repo_name: Optional[str] = None
    resource_type: Optional[str] = None
    tags: Optional[List[str]] = None
    limit: int = 20


@router.post("/resources/extract")
async def extract_resources(request: ExtractResourcesRequest):
    """
    Extract resources from a message.
    """
    try:
        extraction = await resource_vault_service.extract_resources_from_message(
            message=request.message,
            author=request.author,
            author_id=request.author_id,
            repo_name=request.repo_name,
            source_type=request.source_type,
            source_id=request.source_id
        )
        
        # Save extracted resources
        saved_ids = await resource_vault_service.save_extracted_resources(extraction)
        
        return {
            "extracted_count": len(extraction.extracted_resources),
            "saved_count": len(saved_ids),
            "resources": [r.model_dump() for r in extraction.extracted_resources],
            "confidence": extraction.extraction_confidence
        }
    except Exception as e:
        logger.error(f"Extract resources error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resources")
async def create_resource(
    resource: dict,
    current_user_dict: dict = Depends(get_current_user)
):
    """
    Manually create a new resource.
    """
    try:
        # Convert dict to User object for service compatibility
        current_user = User(**current_user_dict)
        
        new_resource = await resource_vault_service.create_resource(
            title=resource.get('title'),
            description=resource.get('description', ''),
            url=resource.get('url'),
            resource_type=resource.get('type', 'link'),
            tags=resource.get('tags', []),
            user=current_user
        )
        return {
            "message": "Resource created successfully",
            "resource_id": new_resource.id
        }
    except Exception as e:
        logger.error(f"Create resource error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resources/search")
async def search_resources(request: SearchResourcesRequest):
    """
    Search the resource vault.
    """
    try:
        resource_type = None
        if request.resource_type:
            resource_type = ResourceType(request.resource_type)
        
        resources = await resource_vault_service.search_resources(
            query=request.query,
            repo_name=request.repo_name,
            resource_type=resource_type,
            tags=request.tags,
            limit=request.limit
        )
        
        return {
            "count": len(resources),
            "resources": [r.model_dump() for r in resources]
        }
    except Exception as e:
        logger.error(f"Search resources error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resources/topic/{topic}")
async def get_resources_for_topic(topic: str, repo_name: Optional[str] = None):
    """
    Get resources related to a topic.
    """
    try:
        resources = await resource_vault_service.get_resources_for_topic(
            topic=topic,
            repo_name=repo_name
        )
        
        return {
            "topic": topic,
            "count": len(resources),
            "resources": [r.model_dump() for r in resources]
        }
    except Exception as e:
        logger.error(f"Get topic resources error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resources/trending")
async def get_trending_resources(
    repo_name: Optional[str] = None,
    days: int = 7,
    limit: int = 10
):
    """
    Get trending resources.
    """
    try:
        resources = await resource_vault_service.get_trending_resources(
            repo_name=repo_name,
            days=days,
            limit=limit
        )
        
        return {
            "period_days": days,
            "count": len(resources),
            "resources": [r.model_dump() for r in resources]
        }
    except Exception as e:
        logger.error(f"Get trending resources error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resources/{resource_id}/helpful")
async def mark_resource_helpful(resource_id: str, user_id: str):
    """
    Mark a resource as helpful.
    """
    try:
        success = await resource_vault_service.mark_helpful(resource_id, user_id)
        return {"marked": success}
    except Exception as e:
        logger.error(f"Mark helpful error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Hype Generator Routes ============

class GenerateHypeRequest(BaseModel):
    milestone_type: str
    user_id: str
    username: str
    repo_name: Optional[str] = None
    value: Optional[int] = None
    description: str = ""
    trophy_name: Optional[str] = None


@router.post("/hype/linkedin")
async def generate_linkedin_post(request: GenerateHypeRequest):
    """
    Generate a LinkedIn celebration post.
    """
    try:
        milestone = Milestone(
            milestone_type=request.milestone_type,
            user_id=request.user_id,
            username=request.username,
            repo_name=request.repo_name,
            value=request.value,
            description=request.description,
            trophy_name=request.trophy_name
        )
        
        post = await hype_generator_service.generate_linkedin_post(milestone)
        
        return post.model_dump()
    except Exception as e:
        logger.error(f"Generate LinkedIn post error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hype/twitter")
async def generate_twitter_post(request: GenerateHypeRequest):
    """
    Generate a Twitter/X celebration post.
    """
    try:
        milestone = Milestone(
            milestone_type=request.milestone_type,
            user_id=request.user_id,
            username=request.username,
            repo_name=request.repo_name,
            value=request.value,
            description=request.description,
            trophy_name=request.trophy_name
        )
        
        post = await hype_generator_service.generate_twitter_post(milestone)
        
        return post.model_dump()
    except Exception as e:
        logger.error(f"Generate Twitter post error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hype/stats-card/{username}")
async def get_stats_card(username: str):
    """
    Get a shareable stats card image for a user.
    """
    try:
        svg_bytes = await hype_generator_service.generate_stats_image(username)
        
        if not svg_bytes:
            raise HTTPException(status_code=404, detail="Could not generate stats card")
        
        return Response(
            content=svg_bytes,
            media_type="image/svg+xml",
            headers={
                "Cache-Control": "public, max-age=3600"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generate stats card error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
