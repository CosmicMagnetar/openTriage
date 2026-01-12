/**
 * Messaging Routes
 * 
 * Full messaging API for the frontend
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
    getConversations,
    getChatHistory,
    sendMessage,
    markMessagesAsRead,
    getUnreadCount,
    pollNewMessages
} from "@/lib/db/queries/messages";

// GET /api/messaging - Get conversations list
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const conversations = await getConversations(user.id);
        const unreadCount = await getUnreadCount(user.id);

        return NextResponse.json({ conversations, unreadCount });
    } catch (error) {
        console.error("Messaging error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
