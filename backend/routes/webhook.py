"""
GitHub Webhook Routes for OpenTriage.
Receives webhook events and streams them to Spark for processing.
"""
import logging
import hmac
import hashlib
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Header

from services.spark_streaming import spark_streaming_service

logger = logging.getLogger(__name__)
router = APIRouter()


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verify GitHub webhook signature.
    
    Args:
        payload: Raw request body
        signature: X-Hub-Signature-256 header value
        secret: Webhook secret
        
    Returns:
        bool: True if signature is valid
    """
    if not secret:
        return True  # Skip verification if no secret configured
    
    if not signature:
        return False
    
    expected = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected)


@router.post("/github")
async def github_webhook(
    request: Request,
    x_github_event: Optional[str] = Header(None, alias="X-GitHub-Event"),
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
    x_github_delivery: Optional[str] = Header(None, alias="X-GitHub-Delivery")
):
    """
    Receive GitHub webhook events and stream to Spark.
    
    This endpoint receives real-time events from GitHub and queues them
    for sub-second processing via Spark Structured Streaming.
    
    Supported events:
    - issues: Issue opened, closed, edited, etc.
    - pull_request: PR opened, closed, merged, etc.
    - issue_comment: Comments on issues and PRs
    - pull_request_review: PR review submitted
    - pull_request_review_comment: Comments on PR diffs
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Optional: Verify signature if webhook secret is configured
        # from config.settings import settings
        # if not verify_webhook_signature(body, x_hub_signature_256, settings.GITHUB_WEBHOOK_SECRET):
        #     raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Parse JSON payload
        payload = await request.json()
        
        # Add event metadata
        payload["_github_event"] = x_github_event
        payload["_github_delivery"] = x_github_delivery
        
        # Log event type
        action = payload.get("action", "unknown")
        logger.info(f"Received webhook: {x_github_event}/{action} (delivery: {x_github_delivery})")
        
        # Stream to Spark
        success = await spark_streaming_service.ingest_event(payload)
        
        if success:
            return {
                "status": "queued",
                "event": x_github_event,
                "action": action,
                "delivery_id": x_github_delivery
            }
        else:
            return {
                "status": "dropped",
                "reason": "queue_full",
                "event": x_github_event
            }
            
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/github/status")
async def webhook_status():
    """
    Get webhook processing status.
    
    Returns:
        Queue statistics and streaming status
    """
    stats = spark_streaming_service.get_queue_stats()
    return {
        "status": "healthy" if stats["is_running"] else "idle",
        "queue": stats
    }


@router.post("/github/start")
async def start_streaming():
    """
    Start the webhook streaming processor.
    """
    spark_streaming_service.start_streaming()
    return {"status": "started"}


@router.post("/github/stop")
async def stop_streaming():
    """
    Stop the webhook streaming processor.
    """
    spark_streaming_service.stop_streaming()
    return {"status": "stopped"}
