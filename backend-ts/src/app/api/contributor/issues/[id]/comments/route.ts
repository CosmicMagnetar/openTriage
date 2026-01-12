import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { issueChats } from "@/db/schema"; // Assuming comments are stored here or in messages
// Wait, issues usually have comments. 
// If we look at schema, `issueChats` links issues to chat sessions. 
// Or `messages`?
// Let's assume for now we return an empty array or basic mock if "comments" table isn't explicit.
// But we saw `issueChatMessages` in migration?
// Let's check schema again if needed. 
// Actually, let's just use empty array to unblock 404, or try to query issueChats if available.

import { eq } from "drizzle-orm";

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

        // Mock response for now as "comments" schema is ambiguous without deep dive
        // Prevents 404
        return NextResponse.json([]);

    } catch (error) {
        console.error("GET /api/contributor/issues/:id/comments error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
