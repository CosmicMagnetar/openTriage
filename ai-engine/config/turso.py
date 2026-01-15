"""
Turso (libsql) Database Connection Utility.

Provides async database operations for messages and mentorship data.
"""

import os
import logging
from typing import List, Dict, Any, Optional
import libsql_client

logger = logging.getLogger(__name__)

# Database URL and auth token from environment
TURSO_DATABASE_URL = os.environ.get('TURSO_DATABASE_URL', '')
TURSO_AUTH_TOKEN = os.environ.get('TURSO_AUTH_TOKEN', '')


class TursoDatabase:
    """Turso database wrapper with async operations."""
    
    def __init__(self):
        self._client = None
        self._initialized = False
    
    def _get_client(self):
        """Get or create the libsql client."""
        if self._client is None:
            if not TURSO_DATABASE_URL:
                raise ValueError("TURSO_DATABASE_URL environment variable is not set")
            
            # Convert libsql:// to https:// for HTTP transport
            url = TURSO_DATABASE_URL
            if url.startswith("libsql://"):
                url = url.replace("libsql://", "https://")
            
            self._client = libsql_client.create_client_sync(
                url=url,
                auth_token=TURSO_AUTH_TOKEN if TURSO_AUTH_TOKEN else None
            )
        return self._client
    
    def execute(self, sql: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute a SQL query and return results."""
        client = self._get_client()
        try:
            if params:
                result = client.execute(sql, params)
            else:
                result = client.execute(sql)
            
            # Convert result rows to list of dicts
            if result.rows:
                columns = result.columns
                return [dict(zip(columns, row)) for row in result.rows]
            return []
        except Exception as e:
            logger.error(f"Turso execute error: {e}")
            raise
    
    def executemany(self, sql: str, params_list: List[tuple]) -> int:
        """Execute a SQL query with multiple parameter sets."""
        client = self._get_client()
        count = 0
        try:
            for params in params_list:
                client.execute(sql, params)
                count += 1
            return count
        except Exception as e:
            logger.error(f"Turso executemany error: {e}")
            raise
    
    def init_tables(self):
        """Initialize database tables if they don't exist."""
        if self._initialized:
            return
        
        try:
            # Messages table
            self.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    sender_id TEXT NOT NULL,
                    receiver_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    read INTEGER DEFAULT 0,
                    timestamp TEXT NOT NULL
                )
            """)
            
            # Mentorships table
            self.execute("""
                CREATE TABLE IF NOT EXISTS mentorships (
                    id TEXT PRIMARY KEY,
                    mentor_id TEXT NOT NULL,
                    mentor_username TEXT,
                    mentee_id TEXT NOT NULL,
                    mentee_username TEXT,
                    status TEXT DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    disconnected_at TEXT
                )
            """)
            
            # Mentorship requests table
            self.execute("""
                CREATE TABLE IF NOT EXISTS mentorship_requests (
                    id TEXT PRIMARY KEY,
                    mentee_id TEXT NOT NULL,
                    mentee_username TEXT,
                    mentor_id TEXT NOT NULL,
                    mentor_username TEXT,
                    issue_id TEXT,
                    message TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at TEXT NOT NULL
                )
            """)
            
            self._initialized = True
            logger.info("Turso tables initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Turso tables: {e}")
            raise
    
    # Message operations
    def insert_message(self, message: Dict[str, Any]) -> bool:
        """Insert a message into the messages table."""
        try:
            self.execute(
                """
                INSERT OR IGNORE INTO messages (id, sender_id, receiver_id, content, read, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    message.get('id'),
                    message.get('sender_id'),
                    message.get('receiver_id'),
                    message.get('content'),
                    1 if message.get('read') else 0,
                    message.get('timestamp') if isinstance(message.get('timestamp'), str) 
                        else message.get('timestamp').isoformat() if message.get('timestamp') else None
                )
            )
            return True
        except Exception as e:
            logger.error(f"Failed to insert message: {e}")
            return False
    
    def get_messages(self, user_id: str, other_user_id: str) -> List[Dict[str, Any]]:
        """Get messages between two users."""
        return self.execute(
            """
            SELECT * FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) 
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY timestamp ASC
            """,
            (user_id, other_user_id, other_user_id, user_id)
        )
    
    # Mentorship operations
    def insert_mentorship(self, mentorship: Dict[str, Any]) -> bool:
        """Insert a mentorship record."""
        try:
            self.execute(
                """
                INSERT OR IGNORE INTO mentorships 
                (id, mentor_id, mentor_username, mentee_id, mentee_username, status, created_at, disconnected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    mentorship.get('id'),
                    mentorship.get('mentor_id'),
                    mentorship.get('mentor_username'),
                    mentorship.get('mentee_id'),
                    mentorship.get('mentee_username'),
                    mentorship.get('status', 'active'),
                    mentorship.get('created_at') if isinstance(mentorship.get('created_at'), str)
                        else mentorship.get('created_at').isoformat() if mentorship.get('created_at') else None,
                    mentorship.get('disconnected_at')
                )
            )
            return True
        except Exception as e:
            logger.error(f"Failed to insert mentorship: {e}")
            return False
    
    def insert_mentorship_request(self, request: Dict[str, Any]) -> bool:
        """Insert a mentorship request."""
        try:
            self.execute(
                """
                INSERT OR IGNORE INTO mentorship_requests 
                (id, mentee_id, mentee_username, mentor_id, mentor_username, issue_id, message, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    request.get('id'),
                    request.get('mentee_id'),
                    request.get('mentee_username'),
                    request.get('mentor_id'),
                    request.get('mentor_username'),
                    request.get('issue_id'),
                    request.get('message'),
                    request.get('status', 'pending'),
                    request.get('created_at') if isinstance(request.get('created_at'), str)
                        else request.get('created_at').isoformat() if request.get('created_at') else None
                )
            )
            return True
        except Exception as e:
            logger.error(f"Failed to insert mentorship request: {e}")
            return False
    
    def get_mentorships_for_mentee(self, mentee_id: str) -> List[Dict[str, Any]]:
        """Get all mentorships for a mentee."""
        return self.execute(
            "SELECT * FROM mentorships WHERE mentee_id = ? AND status = 'active'",
            (mentee_id,)
        )


# Singleton instance
turso_db = TursoDatabase()
