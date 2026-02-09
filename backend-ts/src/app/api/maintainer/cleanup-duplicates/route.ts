/**
 * Cleanup Duplicate Issues API Route
 * 
 * POST /api/maintainer/cleanup-duplicates
 * 
 * One-time cleanup endpoint to remove duplicate issue/PR rows from the DB.
 * Keeps the oldest entry per number+repoId and deletes the rest.
 */

import { NextResponse } from "next/server";
import { cleanupDuplicateIssues } from "@/lib/db/queries/issues";

export async function POST() {
    try {
        const deleted = await cleanupDuplicateIssues();
        return NextResponse.json({
            success: true,
            duplicatesRemoved: deleted,
            message: deleted > 0
                ? `Cleaned up ${deleted} duplicate issue/PR entries`
                : "No duplicates found",
        });
    } catch (error) {
        console.error("Cleanup error:", error);
        return NextResponse.json({ error: "Failed to cleanup duplicates" }, { status: 500 });
    }
}
