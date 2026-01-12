/**
 * Messaging Unread Count Route
 * 
 * GET /api/messaging/unread-count
 * Get the count of unread messages for the authenticated user
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/db/queries/messages";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const count = await getUnreadCount(user.id);

        return NextResponse.json({ count });
    } catch (error) {
        console.error("Unread count error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
