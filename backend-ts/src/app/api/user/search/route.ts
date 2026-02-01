/**
 * User Search API Route
 * 
 * GET /api/user/search?q=username
 * Search for users by username
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { like, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get("q")?.trim();

        if (!query || query.length < 2) {
            return NextResponse.json({ 
                users: [],
                message: "Query must be at least 2 characters"
            });
        }

        // Search users by username (case-insensitive)
        const searchResults = await db.select({
            id: users.id,
            username: users.username,
            avatarUrl: users.avatarUrl,
            role: users.role,
        })
        .from(users)
        .where(like(sql`LOWER(${users.username})`, `%${query.toLowerCase()}%`))
        .limit(10);

        return NextResponse.json({
            users: searchResults,
            total: searchResults.length
        });
    } catch (error) {
        console.error("GET /api/user/search error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
