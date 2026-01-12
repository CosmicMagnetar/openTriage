import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { eq } from "drizzle-orm";
// Assuming we might have a comments table or use issueChats/messages
// For now, return empty array to unblock 404. 
// If schema has explicit comments table we should use it.
// Checking schema previously showed `issueChats` and `chatMessages`.

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        // Mock response to prevent 404. 
        // In future: Query `issueChatMessages` or GitHub comments via octokit if needed.
        return NextResponse.json([]);

    } catch (error) {
        console.error("GET /api/maintainer/issues/:id/comments error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
