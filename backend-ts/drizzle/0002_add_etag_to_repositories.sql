-- Add ETag and last_synced_at columns to repositories table for conditional GitHub API requests
-- This migration adds caching columns to reduce GitHub API calls

ALTER TABLE repositories ADD COLUMN etag TEXT;

ALTER TABLE repositories ADD COLUMN last_synced_at TEXT;