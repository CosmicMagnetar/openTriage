/**
 * Messages Route
 * 
 * Get conversations and send messages.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getConversations, getChatHistory, sendMessage, markMessagesAsRead, getUnreadCount } from "@/lib/db/queries/messages";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const otherUserId = searchParams.get("with");

        if (otherUserId) {
            // Get chat history with specific user
            const history = await getChatHistory(user.id, otherUserId);
            await markMessagesAsRead(user.id, otherUserId);
            return NextResponse.json({ messages: history });
        } else {
            // Get all conversations
            const conversations = await getConversations(user.id);
            const unreadCount = await getUnreadCount(user.id);
            return NextResponse.json({ conversations, unreadCount });
        }
    } catch (error) {
        console.error("Messages fetch error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { receiverId, content } = body;

        if (!receiverId || !content) {
            return NextResponse.json({ error: "receiverId and content are required" }, { status: 400 });
        }

        const message = await sendMessage({
            senderId: user.id,
            receiverId,
            content,
        });

        return NextResponse.json(message);
    } catch (error) {
        console.error("Message send error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
