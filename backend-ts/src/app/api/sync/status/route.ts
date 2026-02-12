/**
 * Sync Status API Route
 * 
 * GET /api/sync/status - Check current sync status for the authenticated user
 * Used by frontend to poll sync progress without triggering new syncs
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user's sync status
        const userRecord = await db.select({
            syncStatus: users.syncStatus,
            lastSyncAt: users.lastSyncAt,
            syncError: users.syncError,
        })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

        if (!userRecord || userRecord.length === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const { syncStatus, lastSyncAt, syncError } = userRecord[0];

        return NextResponse.json({
            status: syncStatus || 'IDLE',
            lastSyncAt: lastSyncAt || null,
            error: syncError || null,
            isIdl: syncStatus === 'IDLE' || syncStatus === 'COMPLETED',
            isSyncing: syncStatus === 'SYNCING',
            isPending: syncStatus === 'PENDING',
            hasFailed: syncStatus === 'FAILED',
        });

    } catch (error) {
        console.error("GET /api/sync/status error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
