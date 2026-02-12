-- Migration: Add sync status tracking to users table
-- Date: 2026-02-12
-- Purpose: Prevent concurrent sync requests and track sync history

-- Add sync status columns to users table
ALTER TABLE users ADD COLUMN sync_status TEXT DEFAULT 'IDLE';
ALTER TABLE users ADD COLUMN last_sync_at TEXT;
ALTER TABLE users ADD COLUMN sync_error TEXT;

-- Create index for faster sync status queries
CREATE INDEX IF NOT EXISTS idx_users_sync_status ON users(sync_status);

-- Comments
-- sync_status: IDLE | PENDING | SYNCING | COMPLETED | FAILED
-- last_sync_at: ISO 8601 timestamp of last successful sync
-- sync_error: Error message if last sync failed
