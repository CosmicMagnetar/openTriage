/**
 * Sync Status API Route
 * 
 * GET /api/sync/status - Check current sync status for the authenticated user
 * DISABLED: sync_status columns not yet migrated in Turso database
 * Re-enable after running: turso db shell <db-name> < src/db/migrations/add_sync_status.sql
 */

import { NextResponse } from "next/server";

export async function GET() {
    // Temporarily return IDLE since sync_status columns don't exist in DB yet
    return NextResponse.json({
        status: 'IDLE',
        lastSyncAt: null,
        error: null,
        isIdle: true,
        isSyncing: false,
        isPending: false,
        hasFailed: false,
        message: 'Sync status tracking will be available after database migration'
    });
}
