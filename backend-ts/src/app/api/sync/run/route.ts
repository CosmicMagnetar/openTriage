/**
 * Sync Trigger API Route
 * 
 * POST /api/sync/run - Manually trigger a full GitHub sync
 * Supports role-based sync with ETag caching for efficient API usage
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runMaintainerSync, runContributorSync, syncContributorPRsDirect, reconcileOpenTriageIssue1 } from "@/lib/sync/github-sync";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Layer 2 Defense: In-memory set to prevent race conditions
// This provides instant protection before database queries
const activeSyncs = new Set<string>();

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json({ error: "GitHub access token not found" }, { status: 400 });
        }

        // Layer 2 Defense: In-memory check (FAST - prevents race conditions)
        if (activeSyncs.has(user.id)) {
            console.log(`[SyncRun] User ${user.id} sync blocked by in-memory guard`);
            return NextResponse.json({
                error: "Sync already in progress",
                status: "SYNCING",
                message: "Please wait for the current sync to complete"
            }, { status: 429 });
        }

        // Layer 1 Defense: Database check (PERSISTENT - survives restarts)
        const userRecord = await db.select({
            id: users.id,
            syncStatus: users.syncStatus,
            lastSyncAt: users.lastSyncAt,
        })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

        if (!userRecord || userRecord.length === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const currentSyncStatus = userRecord[0].syncStatus;

        // Circuit breaker: Check if sync already in progress
        if (currentSyncStatus === 'SYNCING') {
            console.log(`[SyncRun] User ${user.id} sync already in progress (DB status)`);
            return NextResponse.json({
                error: "Sync already in progress",
                status: "SYNCING",
                message: "Please wait for the current sync to complete"
            }, { status: 429 });
        }

        if (currentSyncStatus === 'PENDING') {
            console.log(`[SyncRun] User ${user.id} sync is pending`);
            return NextResponse.json({
                error: "Sync is queued",
                status: "PENDING",
                message: "Sync request is queued and will start shortly"
            }, { status: 202 });
        }

        // Add to in-memory set FIRST (before DB update)
        activeSyncs.add(user.id);
        console.log(`[SyncRun] Added user ${user.id} to activeSyncs. Size: ${activeSyncs.size}`);

        // Set database status to SYNCING
        await db.update(users)
            .set({
                syncStatus: 'SYNCING',
                syncError: null
            })
            .where(eq(users.id, user.id));

        console.log(`[SyncRun] Starting sync for user ${user.id}`);

        try {
            // Determine sync type based on user role
            const userRole = user.role?.toUpperCase();
            let stats;
            let directSync = null;

            if (userRole === "MAINTAINER") {
                // Maintainers sync all open issues/PRs
                stats = await runMaintainerSync(user.id, user.githubAccessToken);
            } else {
                // Contributors sync only their authored PRs
                // First: Run search-based sync (may have indexing delay)
                stats = await runContributorSync(user.id, user.username, user.githubAccessToken);

                // Second: Direct fetch from repos where user has existing PRs (bypasses search delay)
                directSync = await syncContributorPRsDirect(user.id, user.username, user.githubAccessToken);
            }

            // Always reconcile the critical openTriage#1 issue to ensure immediate state sync
            const reconcileResult = await reconcileOpenTriageIssue1(user.githubAccessToken);

            // Mark sync as COMPLETED
            await db.update(users).set({
                syncStatus: 'COMPLETED',
                lastSyncAt: new Date().toISOString(),
                syncError: null
            }).where(eq(users.id, user.id));

            console.log(`[SyncRun] Sync completed for user ${user.id}`);

            return NextResponse.json({
                success: true,
                message: "Sync completed",
                role: userRole,
                stats,
                directSync,  // Include direct sync results for contributors
                reconcile: {
                    openTriageIssue1: reconcileResult,
                },
                nextSyncIntervalMs: SYNC_INTERVAL_MS,
            });

        } catch (syncError: any) {
            console.error(`[SyncRun] Error syncing for user ${user.id}:`, syncError);

            // Mark sync as FAILED with error message
            await db.update(users).set({
                syncStatus: 'FAILED',
                syncError: syncError.message || 'Unknown error'
            }).where(eq(users.id, user.id));

            return NextResponse.json({
                error: "Sync failed",
                message: syncError.message || "Internal server error"
            }, { status: 500 });
        } finally {
            // CRITICAL: Always remove from in-memory set, even on error
            activeSyncs.delete(user.id);
            console.log(`[SyncRun] Removed user ${user.id} from activeSyncs. Size: ${activeSyncs.size}`);
        }
    } catch (error) {
        console.error("POST /api/sync/run error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    // Return sync configuration info
    return NextResponse.json({
        syncIntervalMs: SYNC_INTERVAL_MS,
        syncIntervalMinutes: SYNC_INTERVAL_MS / 60000,
        description: "GitHub sync runs every 5 minutes. POST to trigger manually.",
        features: [
            "ETag caching - skips sync if no changes (304 Not Modified)",
            "State reconciliation - marks issues as closed if not in open list",
            "Role-based filtering - Contributors see only their authored PRs",
        ],
    });
}
