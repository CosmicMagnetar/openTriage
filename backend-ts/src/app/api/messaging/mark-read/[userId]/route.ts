/**
 * Messaging Mark Read Route
 * 
 * POST /api/messaging/mark-read/[userId]
 * Mark all messages from a user as read
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markMessagesAsRead } from "@/lib/db/queries/messages";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { userId: otherUserId } = await params;

        await markMessagesAsRead(user.id, otherUserId);

        return NextResponse.json({ success: true, message: "Messages marked as read" });
    } catch (error) {
        console.error("Mark read error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
