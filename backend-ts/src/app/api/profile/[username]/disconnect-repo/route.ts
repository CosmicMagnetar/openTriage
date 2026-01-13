/**
 * Disconnect Repository Route
 * 
 * DELETE /api/profile/{userId}/disconnect-repo
 * Disconnect a repository
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { username: userId } = await context.params;
        const { searchParams } = new URL(request.url);
        const repoName = searchParams.get("repo_name");

        if (!repoName) {
            return NextResponse.json({ error: "repo_name is required" }, { status: 400 });
        }

        // Verify user owns this profile
        if (user.id !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Delete the repository
        await db.delete(repositories)
            .where(and(
                eq(repositories.name, repoName),
                eq(repositories.userId, userId)
            ));

        return NextResponse.json({
            message: "Repository disconnected successfully"
        });

    } catch (error) {
        console.error("DELETE /api/profile/:id/disconnect-repo error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
