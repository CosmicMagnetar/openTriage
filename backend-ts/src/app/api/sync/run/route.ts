/**
 * Sync Trigger API Route
 * 
 * POST /api/sync/run - Manually trigger a full GitHub sync
 * Supports role-based sync with ETag caching for efficient API usage
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runFullSync, runMaintainerSync, runContributorSync, SYNC_INTERVAL_MS } from "@/lib/sync/github-sync";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json({ error: "GitHub access token not found" }, { status: 400 });
        }

        // Determine sync type based on user role
        const userRole = user.role?.toUpperCase();
        let stats;

        if (userRole === "MAINTAINER") {
            // Maintainers sync all open issues/PRs
            stats = await runMaintainerSync(user.id, user.githubAccessToken);
        } else {
            // Contributors sync only their authored PRs
            stats = await runContributorSync(user.id, user.username, user.githubAccessToken);
        }

        return NextResponse.json({
            success: true,
            message: "Sync completed",
            role: userRole,
            stats,
            nextSyncIntervalMs: SYNC_INTERVAL_MS,
        });
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
