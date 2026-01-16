"""
Turso (libsql) Database Connection Utility.

Provides sync database operations for messages and mentorship data.
Uses libsql-experimental for reliable Turso connectivity.
"""

import os
import logging
from typing import List, Dict, Any, Optional

# Try multiple libsql package names (different versions use different names)
libsql = None
LIBSQL_AVAILABLE = False
try:
    import libsql_experimental as libsql
    LIBSQL_AVAILABLE = True
except ImportError:
    try:
        import libsql_client as libsql
        LIBSQL_AVAILABLE = True
    except ImportError:
        pass  # Neither package available

logger = logging.getLogger(__name__)

# Database URL and auth token from environment
TURSO_DATABASE_URL = os.environ.get('TURSO_DATABASE_URL', '')
TURSO_AUTH_TOKEN = os.environ.get('TURSO_AUTH_TOKEN', '')


class TursoDatabase:
    """Turso database wrapper with sync operations."""
    
    def __init__(self):
        self._conn = None
        self._initialized = False
    
    def _get_connection(self):
        """Get or create the libsql connection."""
        if self._conn is None:
            if libsql is None:
                raise ImportError("libsql_experimental is not installed. Run: pip install libsql-experimental")
            
            if not TURSO_DATABASE_URL:
                raise ValueError("TURSO_DATABASE_URL environment variable is not set")
            
            # libsql-experimental uses a local file with sync to remote
            self._conn = libsql.connect(
                "local_opentriage.db",
                sync_url=TURSO_DATABASE_URL,
                auth_token=TURSO_AUTH_TOKEN if TURSO_AUTH_TOKEN else None
            )
            # Sync with remote database
            self._conn.sync()
            logger.info("Connected to Turso database")
        return self._conn
    
    def sync(self):
        """Sync local database with remote Turso."""
        conn = self._get_connection()
        conn.sync()
    
    def execute(self, sql: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute a SQL query and return results."""
        conn = self._get_connection()
        try:
            if params:
                cursor = conn.execute(sql, params)
            else:
                cursor = conn.execute(sql)
            
            # For SELECT queries, return results as list of dicts
            if cursor.description:
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            
            # For INSERT/UPDATE/DELETE, commit and return empty
            conn.commit()
            self.sync()  # Sync changes to remote
            return []
        except Exception as e:
            logger.error(f"Turso execute error: {e}")
            raise
    
    def init_tables(self):
        """Initialize database tables if they don't exist."""
        if self._initialized:
            return
        
        conn = self._get_connection()
        try:
            # Messages table
            conn.execute("""
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
            conn.execute("""
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
            conn.execute("""
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
            
            conn.commit()
            self.sync()  # Sync table creation to remote
            
            self._initialized = True
            logger.info("Turso tables initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Turso tables: {e}")
            raise
    
    # Message operations
    def insert_message(self, message: Dict[str, Any]) -> bool:
        """Insert a message into the messages table."""
        conn = self._get_connection()
        try:
            timestamp = message.get('timestamp')
            if timestamp and not isinstance(timestamp, str):
                timestamp = timestamp.isoformat()
            
            conn.execute(
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
                    timestamp
                )
            )
            conn.commit()
            self.sync()
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
        conn = self._get_connection()
        try:
            created_at = mentorship.get('created_at')
            if created_at and not isinstance(created_at, str):
                created_at = created_at.isoformat()
            
            conn.execute(
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
                    created_at,
                    mentorship.get('disconnected_at')
                )
            )
            conn.commit()
            self.sync()
            return True
        except Exception as e:
            logger.error(f"Failed to insert mentorship: {e}")
            return False
    
    def insert_mentorship_request(self, request: Dict[str, Any]) -> bool:
        """Insert a mentorship request."""
        conn = self._get_connection()
        try:
            created_at = request.get('created_at')
            if created_at and not isinstance(created_at, str):
                created_at = created_at.isoformat()
            
            conn.execute(
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
                    created_at
                )
            )
            conn.commit()
            self.sync()
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
