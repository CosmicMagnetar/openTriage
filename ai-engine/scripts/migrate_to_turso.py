#!/usr/bin/env python3
"""
MongoDB to Turso Migration Script

Migrates messages, mentorships, and mentorship_requests from MongoDB to Turso.
Run this script once to copy existing data.

Usage:
    cd /Users/krishna./Desktop/Projects/OpenTriage_AI
    python scripts/migrate_to_turso.py
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from config.database import db
from config.turso import turso_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def migrate_messages():
    """Migrate all messages from MongoDB to Turso."""
    logger.info("Migrating messages...")
    
    cursor = db.messages.find({}, {"_id": 0})
    messages = await cursor.to_list(length=None)
    
    success_count = 0
    for msg in messages:
        if turso_db.insert_message(msg):
            success_count += 1
    
    logger.info(f"Migrated {success_count}/{len(messages)} messages")
    return success_count


async def migrate_mentorships():
    """Migrate all mentorships from MongoDB to Turso."""
    logger.info("Migrating mentorships...")
    
    cursor = db.mentorships.find({}, {"_id": 0})
    mentorships = await cursor.to_list(length=None)
    
    success_count = 0
    for m in mentorships:
        if turso_db.insert_mentorship(m):
            success_count += 1
    
    logger.info(f"Migrated {success_count}/{len(mentorships)} mentorships")
    return success_count


async def migrate_mentorship_requests():
    """Migrate all mentorship requests from MongoDB to Turso."""
    logger.info("Migrating mentorship requests...")
    
    cursor = db.mentorship_requests.find({}, {"_id": 0})
    requests = await cursor.to_list(length=None)
    
    success_count = 0
    for req in requests:
        if turso_db.insert_mentorship_request(req):
            success_count += 1
    
    logger.info(f"Migrated {success_count}/{len(requests)} mentorship requests")
    return success_count


async def main():
    """Run the migration."""
    logger.info("=" * 50)
    logger.info("MongoDB to Turso Migration")
    logger.info("=" * 50)
    
    # Initialize Turso tables
    logger.info("Initializing Turso tables...")
    turso_db.init_tables()
    
    # Run migrations
    msg_count = await migrate_messages()
    mentorship_count = await migrate_mentorships()
    request_count = await migrate_mentorship_requests()
    
    logger.info("=" * 50)
    logger.info("Migration Complete!")
    logger.info(f"  Messages: {msg_count}")
    logger.info(f"  Mentorships: {mentorship_count}")
    logger.info(f"  Mentorship Requests: {request_count}")
    logger.info("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
