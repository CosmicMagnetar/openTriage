/**
 * Sync Trigger API Route
 * 
 * POST /api/sync/run - Manually trigger a full GitHub sync
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runFullSync, SYNC_INTERVAL_MS } from "@/lib/sync/github-sync";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only maintainers can trigger sync
        if (user.role !== "MAINTAINER" && user.role !== "maintainer") {
            return NextResponse.json({ error: "Maintainer access required" }, { status: 403 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json({ error: "GitHub access token not found" }, { status: 400 });
        }

        // Run the sync
        const stats = await runFullSync(user.id, user.githubAccessToken);

        return NextResponse.json({
            success: true,
            message: "Sync completed",
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
    });
}
