/**
 * Messaging Poll Route
 * 
 * GET /api/messaging/poll/[userId]
 * Poll for new messages from a specific user
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pollNewMessages } from "@/lib/db/queries/messages";

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
        const { searchParams } = new URL(request.url);
        const lastMessageId = searchParams.get("last_message_id") || undefined;

        const newMessages = await pollNewMessages(user.id, otherUserId, lastMessageId);

        return NextResponse.json(newMessages);
    } catch (error) {
        console.error("Poll messages error:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json({ 
            error: "Internal server error",
            detail: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
