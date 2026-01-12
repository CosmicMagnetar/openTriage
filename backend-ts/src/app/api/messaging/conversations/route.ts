/**
 * Messaging Conversations Route
 * 
 * GET /api/messaging/conversations
 * Get list of all conversations for the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getConversations } from "@/lib/db/queries/messages";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const conversations = await getConversations(user.id);

        // Format to match frontend expectations
        return NextResponse.json({
            conversations: conversations.map(c => ({
                user_id: c.partnerId,
                username: c.partnerUsername,
                avatar_url: c.partnerAvatar,
                last_message: c.lastMessage?.content?.substring(0, 50) || "",
                last_timestamp: c.lastMessage?.timestamp || null,
                unread_count: c.unreadCount
            }))
        });
    } catch (error) {
        console.error("Conversations error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
