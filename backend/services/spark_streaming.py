"""
Spark Structured Streaming Service for OpenTriage.
Processes GitHub webhook events in real-time with sub-second latency.
"""
import logging
import json
import asyncio
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timezone
from queue import Queue
from threading import Thread
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.types import (
    StructType, StructField, StringType, TimestampType, IntegerType
)
from pyspark.sql.functions import from_json, col, current_timestamp

from spark_manager import get_or_create_spark_session

logger = logging.getLogger(__name__)


# Schema for GitHub webhook events
WEBHOOK_SCHEMA = StructType([
    StructField("event_type", StringType(), False),      # issue, pull_request, comment
    StructField("action", StringType(), False),          # opened, closed, created, etc.
    StructField("repo_owner", StringType(), False),
    StructField("repo_name", StringType(), False),
    StructField("repo_full_name", StringType(), False),
    StructField("item_number", IntegerType(), True),
    StructField("item_id", IntegerType(), True),
    StructField("title", StringType(), True),
    StructField("body", StringType(), True),
    StructField("author", StringType(), True),
    StructField("html_url", StringType(), True),
    StructField("state", StringType(), True),
    StructField("payload_json", StringType(), True),     # Full JSON payload
    StructField("received_at", TimestampType(), False)
])


class SparkStreamingService:
    """
    Service for processing GitHub webhooks via Spark Structured Streaming.
    Uses an in-memory queue for event ingestion and Spark for processing.
    """
    
    def __init__(self):
        self._event_queue: Queue = Queue(maxsize=10000)
        self._streaming_thread: Optional[Thread] = None
        self._is_running: bool = False
        self._event_handlers: Dict[str, Callable] = {}
        self._batch_processor: Optional[Callable] = None
        
    def register_handler(self, event_type: str, handler: Callable):
        """
        Register a handler for a specific event type.
        
        Args:
            event_type: Type of event (issue, pull_request, comment)
            handler: Async function to handle processed events
        """
        self._event_handlers[event_type] = handler
        logger.info(f"Registered handler for event type: {event_type}")
    
    def set_batch_processor(self, processor: Callable):
        """
        Set a custom batch processor for micro-batch results.
        
        Args:
            processor: Function that receives a list of processed events
        """
        self._batch_processor = processor
    
    async def ingest_event(self, webhook_payload: Dict[str, Any]) -> bool:
        """
        Ingest a GitHub webhook event for streaming processing.
        
        Args:
            webhook_payload: Raw webhook payload from GitHub
            
        Returns:
            bool: True if event was queued successfully
        """
        try:
            # Parse webhook event
            event_data = self._parse_webhook(webhook_payload)
            
            if event_data is None:
                logger.warning("Failed to parse webhook payload")
                return False
            
            # Add to queue (non-blocking)
            if not self._event_queue.full():
                self._event_queue.put_nowait(event_data)
                logger.debug(f"Queued event: {event_data['event_type']}/{event_data['action']}")
                return True
            else:
                logger.warning("Event queue is full, dropping event")
                return False
                
        except Exception as e:
            logger.error(f"Error ingesting webhook event: {e}")
            return False
    
    def _parse_webhook(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Parse raw GitHub webhook payload into structured event.
        """
        try:
            # Determine event type from payload structure
            event_type = None
            action = payload.get("action", "unknown")
            
            if "issue" in payload and "pull_request" not in payload.get("issue", {}):
                event_type = "issue"
                item = payload["issue"]
            elif "pull_request" in payload:
                event_type = "pull_request"
                item = payload["pull_request"]
            elif "comment" in payload:
                event_type = "comment"
                item = payload["comment"]
            else:
                logger.warning(f"Unknown webhook event type, keys: {payload.keys()}")
                return None
            
            # Extract repository info
            repo = payload.get("repository", {})
            repo_full_name = repo.get("full_name", "unknown/unknown")
            owner, name = repo_full_name.split("/") if "/" in repo_full_name else ("unknown", "unknown")
            
            return {
                "event_type": event_type,
                "action": action,
                "repo_owner": owner,
                "repo_name": name,
                "repo_full_name": repo_full_name,
                "item_number": item.get("number"),
                "item_id": item.get("id"),
                "title": item.get("title", ""),
                "body": item.get("body", "") or "",
                "author": item.get("user", {}).get("login", "unknown"),
                "html_url": item.get("html_url", ""),
                "state": item.get("state", ""),
                "payload_json": json.dumps(payload),
                "received_at": datetime.now(timezone.utc)
            }
            
        except Exception as e:
            logger.error(f"Error parsing webhook: {e}")
            return None
    
    def start_streaming(self):
        """
        Start the streaming processing thread.
        Uses micro-batch processing with 500ms trigger interval.
        """
        if self._is_running:
            logger.warning("Streaming is already running")
            return
        
        self._is_running = True
        self._streaming_thread = Thread(target=self._run_streaming_loop, daemon=True)
        self._streaming_thread.start()
        logger.info("Started Spark streaming processor")
    
    def stop_streaming(self):
        """Stop the streaming processor."""
        self._is_running = False
        if self._streaming_thread:
            self._streaming_thread.join(timeout=5.0)
        logger.info("Stopped Spark streaming processor")
    
    def _run_streaming_loop(self):
        """
        Main streaming loop - processes events in micro-batches.
        """
        spark = get_or_create_spark_session()
        batch_interval_ms = 500  # Sub-second latency
        
        while self._is_running:
            try:
                # Collect batch of events
                batch = []
                batch_start = datetime.now()
                
                while len(batch) < 100:  # Max batch size
                    try:
                        event = self._event_queue.get_nowait()
                        batch.append(event)
                    except:
                        break
                    
                    # Check if we've exceeded batch interval
                    elapsed = (datetime.now() - batch_start).total_seconds() * 1000
                    if elapsed >= batch_interval_ms:
                        break
                
                if batch:
                    self._process_batch(spark, batch)
                else:
                    # No events, sleep briefly
                    import time
                    time.sleep(0.1)
                    
            except Exception as e:
                logger.error(f"Error in streaming loop: {e}")
                import time
                time.sleep(1)
    
    def _process_batch(self, spark: SparkSession, batch: list):
        """
        Process a micro-batch of events using Spark.
        """
        try:
            # Convert to Spark DataFrame
            df = spark.createDataFrame(batch, schema=WEBHOOK_SCHEMA)
            
            # Add processing timestamp
            df = df.withColumn("processed_at", current_timestamp())
            
            # Cache for multiple operations
            df.cache()
            
            # Log batch stats
            count = df.count()
            logger.info(f"Processing batch of {count} events")
            
            # Group by event type and process
            event_types = df.select("event_type").distinct().collect()
            
            for row in event_types:
                event_type = row["event_type"]
                type_df = df.filter(col("event_type") == event_type)
                
                # Call registered handler if exists
                if event_type in self._event_handlers:
                    events = [r.asDict() for r in type_df.collect()]
                    handler = self._event_handlers[event_type]
                    
                    # Run handler in asyncio loop
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    loop.run_until_complete(handler(events))
            
            # Call batch processor if set
            if self._batch_processor:
                all_events = [r.asDict() for r in df.collect()]
                self._batch_processor(all_events)
            
            # Uncache
            df.unpersist()
            
        except Exception as e:
            logger.error(f"Error processing batch: {e}")
    
    def get_queue_stats(self) -> Dict[str, Any]:
        """Get current queue statistics."""
        return {
            "queue_size": self._event_queue.qsize(),
            "max_size": self._event_queue.maxsize,
            "is_running": self._is_running
        }


# Singleton instance
spark_streaming_service = SparkStreamingService()


# Default handlers for common event types

async def handle_issue_events(events: list):
    """Default handler for issue events - stores in MongoDB."""
    from config.database import db
    from models.issue import Issue
    
    for event in events:
        if event["action"] in ["opened", "reopened"]:
            # Check if issue already exists
            existing = await db.issues.find_one(
                {"githubIssueId": event["item_id"]},
                {"_id": 0}
            )
            
            if not existing:
                issue = Issue(
                    githubIssueId=event["item_id"],
                    number=event["item_number"],
                    title=event["title"],
                    body=event["body"],
                    authorName=event["author"],
                    repoId="webhook",
                    repoName=event["repo_full_name"],
                    owner=event["repo_owner"],
                    repo=event["repo_name"],
                    htmlUrl=event["html_url"],
                    state=event["state"],
                    isPR=False
                )
                issue_dict = issue.model_dump()
                issue_dict['createdAt'] = issue_dict['createdAt'].isoformat()
                await db.issues.insert_one(issue_dict)
                logger.info(f"Created issue from webhook: #{event['item_number']}")
        
        elif event["action"] == "closed":
            await db.issues.update_one(
                {"githubIssueId": event["item_id"]},
                {"$set": {"state": "closed"}}
            )
            logger.info(f"Closed issue from webhook: #{event['item_number']}")


async def handle_pr_events(events: list):
    """Default handler for PR events - stores in MongoDB."""
    from config.database import db
    from models.issue import Issue
    
    for event in events:
        if event["action"] in ["opened", "reopened"]:
            existing = await db.issues.find_one(
                {"githubIssueId": event["item_id"]},
                {"_id": 0}
            )
            
            if not existing:
                pr = Issue(
                    githubIssueId=event["item_id"],
                    number=event["item_number"],
                    title=event["title"],
                    body=event["body"],
                    authorName=event["author"],
                    repoId="webhook",
                    repoName=event["repo_full_name"],
                    owner=event["repo_owner"],
                    repo=event["repo_name"],
                    htmlUrl=event["html_url"],
                    state=event["state"],
                    isPR=True
                )
                pr_dict = pr.model_dump()
                pr_dict['createdAt'] = pr_dict['createdAt'].isoformat()
                await db.issues.insert_one(pr_dict)
                logger.info(f"Created PR from webhook: #{event['item_number']}")
        
        elif event["action"] in ["closed", "merged"]:
            await db.issues.update_one(
                {"githubIssueId": event["item_id"]},
                {"$set": {"state": event["action"]}}
            )
            logger.info(f"Updated PR from webhook: #{event['item_number']} -> {event['action']}")


async def handle_comment_events(events: list):
    """Default handler for comment events - triggers sentiment analysis."""
    from config.database import db
    
    for event in events:
        if event["action"] == "created":
            # Store comment for sentiment analysis
            comment_data = {
                "issueId": event["item_id"],
                "repoName": event["repo_full_name"],
                "author": event["author"],
                "body": event["body"],
                "createdAt": event["received_at"].isoformat() if event["received_at"] else None,
                "htmlUrl": event["html_url"],
                "sentiment": None  # To be filled by sentiment pipeline
            }
            await db.comments.insert_one(comment_data)
            logger.info(f"Stored comment for sentiment analysis from {event['author']}")


# Register default handlers
spark_streaming_service.register_handler("issue", handle_issue_events)
spark_streaming_service.register_handler("pull_request", handle_pr_events)
spark_streaming_service.register_handler("comment", handle_comment_events)
