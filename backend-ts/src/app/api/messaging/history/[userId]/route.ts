/**
 * Messaging History Route
 * 
 * GET /api/messaging/history/[userId]
 * Get chat history with a specific user
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getChatHistory, markMessagesAsRead } from "@/lib/db/queries/messages";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { userId: otherUserId } = await params;

        // Get chat history
        const history = await getChatHistory(user.id, otherUserId);

        // Mark messages as read
        await markMessagesAsRead(user.id, otherUserId);

        return NextResponse.json(history);
    } catch (error) {
        console.error("Chat history error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
