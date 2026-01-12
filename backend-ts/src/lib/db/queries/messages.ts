/**
 * Message Queries - Drizzle ORM
 * 
 * All messaging-related database operations.
 */

import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { eq, and, or, desc, count, gt, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// =============================================================================
// Message CRUD
// =============================================================================

export async function sendMessage(data: {
    senderId: string;
    receiverId: string;
    content: string;
}) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.insert(messages).values({
        id,
        senderId: data.senderId,
        receiverId: data.receiverId,
        content: data.content,
        read: false,
        timestamp: now,
    });

    return { id, ...data, read: false, timestamp: now };
}

export async function markMessagesAsRead(currentUserId: string, otherUserId: string) {
    await db.update(messages)
        .set({ read: true })
        .where(
            and(
                eq(messages.senderId, otherUserId),
                eq(messages.receiverId, currentUserId),
                eq(messages.read, false)
            )
        );
}

// =============================================================================
// Chat History
// =============================================================================

export async function getChatHistory(currentUserId: string, otherUserId: string, limit = 50) {
    const history = await db.select()
        .from(messages)
        .where(
            or(
                and(eq(messages.senderId, currentUserId), eq(messages.receiverId, otherUserId)),
                and(eq(messages.senderId, otherUserId), eq(messages.receiverId, currentUserId))
            )
        )
        .orderBy(asc(messages.timestamp))
        .limit(limit);

    return history;
}

export async function pollNewMessages(currentUserId: string, otherUserId: string, lastMessageId?: string) {
    let query = db.select()
        .from(messages)
        .where(
            and(
                eq(messages.senderId, otherUserId),
                eq(messages.receiverId, currentUserId)
            )
        )
        .orderBy(asc(messages.timestamp));

    // If we have a last message ID, only get newer messages
    if (lastMessageId) {
        const lastMessage = await db.select({ timestamp: messages.timestamp })
            .from(messages)
            .where(eq(messages.id, lastMessageId))
            .limit(1);

        if (lastMessage[0]) {
            query = db.select()
                .from(messages)
                .where(
                    and(
                        eq(messages.senderId, otherUserId),
                        eq(messages.receiverId, currentUserId),
                        gt(messages.timestamp, lastMessage[0].timestamp)
                    )
                )
                .orderBy(asc(messages.timestamp));
        }
    }

    return query;
}

// =============================================================================
// Conversations
// =============================================================================

export async function getConversations(currentUserId: string) {
    // Get all unique conversation partners
    const sentTo = await db.selectDistinct({ partnerId: messages.receiverId })
        .from(messages)
        .where(eq(messages.senderId, currentUserId));

    const receivedFrom = await db.selectDistinct({ partnerId: messages.senderId })
        .from(messages)
        .where(eq(messages.receiverId, currentUserId));

    const partnerIds = new Set([
        ...sentTo.map(m => m.partnerId),
        ...receivedFrom.map(m => m.partnerId)
    ]);

    const conversations = await Promise.all([...partnerIds].map(async (partnerId) => {
        // Get partner info
        const partner = await db.select()
            .from(users)
            .where(eq(users.id, partnerId))
            .limit(1);

        // Get last message
        const lastMessage = await db.select()
            .from(messages)
            .where(
                or(
                    and(eq(messages.senderId, currentUserId), eq(messages.receiverId, partnerId)),
                    and(eq(messages.senderId, partnerId), eq(messages.receiverId, currentUserId))
                )
            )
            .orderBy(desc(messages.timestamp))
            .limit(1);

        // Count unread
        const unreadCount = await db.select({ count: count() })
            .from(messages)
            .where(
                and(
                    eq(messages.senderId, partnerId),
                    eq(messages.receiverId, currentUserId),
                    eq(messages.read, false)
                )
            );

        return {
            partnerId,
            partnerUsername: partner[0]?.username || "Unknown",
            partnerAvatar: partner[0]?.avatarUrl || null,
            lastMessage: lastMessage[0] || null,
            unreadCount: unreadCount[0]?.count || 0,
        };
    }));

    // Sort by last message timestamp
    return conversations.sort((a, b) => {
        const aTime = a.lastMessage?.timestamp || "";
        const bTime = b.lastMessage?.timestamp || "";
        return bTime.localeCompare(aTime);
    });
}

// =============================================================================
// Unread Count
// =============================================================================

export async function getUnreadCount(userId: string) {
    const result = await db.select({ count: count() })
        .from(messages)
        .where(and(eq(messages.receiverId, userId), eq(messages.read, false)));

    return result[0]?.count || 0;
}
