#!/usr/bin/env python3
"""
MongoDB to Turso Migration Script

Migrates messages, mentorships, and mentorship_requests from MongoDB to Turso.
Run this script once to copy existing data.

Usage:
    cd /Users/krishna./Desktop/Projects/opentriage/ai-engine
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

import os
import libsql_experimental as libsql

# MongoDB imports
from config.database import db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def get_turso_connection():
    """Get a direct Turso connection with FK checks disabled."""
    url = os.environ.get('TURSO_DATABASE_URL', '')
    auth_token = os.environ.get('TURSO_AUTH_TOKEN', '')
    
    conn = libsql.connect(
        "migration_opentriage.db",
        sync_url=url,
        auth_token=auth_token
    )
    conn.sync()
    
    # Disable foreign key checks for migration
    conn.execute("PRAGMA foreign_keys = OFF")
    
    return conn


async def migrate_messages(conn):
    """Migrate all messages from MongoDB to Turso."""
    logger.info("Migrating messages...")
    
    cursor = db.messages.find({}, {"_id": 0})
    messages = await cursor.to_list(length=None)
    
    success_count = 0
    for msg in messages:
        try:
            timestamp = msg.get('timestamp')
            if timestamp and not isinstance(timestamp, str):
                timestamp = timestamp.isoformat()
            
            conn.execute(
                """
                INSERT OR REPLACE INTO messages (id, sender_id, receiver_id, content, read, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    msg.get('id'),
                    msg.get('sender_id'),
                    msg.get('receiver_id'),
                    msg.get('content'),
                    1 if msg.get('read') else 0,
                    timestamp
                )
            )
            conn.commit()
            success_count += 1
        except Exception as e:
            logger.error(f"Failed to insert message {msg.get('id')}: {e}")
    
    logger.info(f"Migrated {success_count}/{len(messages)} messages")
    return success_count


async def migrate_mentorships(conn):
    """Migrate all mentorships from MongoDB to Turso."""
    logger.info("Migrating mentorships...")
    
    cursor = db.mentorships.find({}, {"_id": 0})
    mentorships = await cursor.to_list(length=None)
    
    success_count = 0
    for m in mentorships:
        try:
            created_at = m.get('created_at')
            if created_at and not isinstance(created_at, str):
                created_at = created_at.isoformat()
            
            conn.execute(
                """
                INSERT OR REPLACE INTO mentorships 
                (id, mentor_id, mentor_username, mentee_id, mentee_username, status, created_at, disconnected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    m.get('id'),
                    m.get('mentor_id'),
                    m.get('mentor_username'),
                    m.get('mentee_id'),
                    m.get('mentee_username'),
                    m.get('status', 'active'),
                    created_at,
                    m.get('disconnected_at')
                )
            )
            conn.commit()
            success_count += 1
        except Exception as e:
            logger.error(f"Failed to insert mentorship {m.get('id')}: {e}")
    
    logger.info(f"Migrated {success_count}/{len(mentorships)} mentorships")
    return success_count


async def migrate_mentorship_requests(conn):
    """Migrate all mentorship requests from MongoDB to Turso."""
    logger.info("Migrating mentorship requests...")
    
    cursor = db.mentorship_requests.find({}, {"_id": 0})
    requests = await cursor.to_list(length=None)
    
    success_count = 0
    for req in requests:
        try:
            created_at = req.get('created_at')
            if created_at and not isinstance(created_at, str):
                created_at = created_at.isoformat()
            
            conn.execute(
                """
                INSERT OR REPLACE INTO mentorship_requests 
                (id, mentee_id, mentee_username, mentor_id, mentor_username, issue_id, message, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    req.get('id'),
                    req.get('mentee_id'),
                    req.get('mentee_username'),
                    req.get('mentor_id'),
                    req.get('mentor_username'),
                    req.get('issue_id'),
                    req.get('message'),
                    req.get('status', 'pending'),
                    created_at
                )
            )
            conn.commit()
            success_count += 1
        except Exception as e:
            logger.error(f"Failed to insert mentorship request {req.get('id')}: {e}")
    
    logger.info(f"Migrated {success_count}/{len(requests)} mentorship requests")
    return success_count


async def main():
    """Run the migration."""
    logger.info("=" * 50)
    logger.info("MongoDB to Turso Migration")
    logger.info("=" * 50)
    
    # Get connection with FK checks disabled
    logger.info("Connecting to Turso (with FK checks disabled)...")
    conn = get_turso_connection()
    
    # Run migrations
    msg_count = await migrate_messages(conn)
    mentorship_count = await migrate_mentorships(conn)
    request_count = await migrate_mentorship_requests(conn)
    
    # Re-enable foreign key checks
    conn.execute("PRAGMA foreign_keys = ON")
    
    # Sync all changes to remote
    logger.info("Syncing changes to remote Turso...")
    conn.sync()
    
    logger.info("=" * 50)
    logger.info("Migration Complete!")
    logger.info(f"  Messages: {msg_count}")
    logger.info(f"  Mentorships: {mentorship_count}")
    logger.info(f"  Mentorship Requests: {request_count}")
    logger.info("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
