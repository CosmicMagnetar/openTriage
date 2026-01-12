import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { repositories, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;

        // Find user first to get ID
        const user = await db.select().from(users).where(eq(users.username, username)).limit(1);

        if (!user[0]) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const repos = await db
            .select()
            .from(repositories)
            .where(eq(repositories.userId, user[0].id))
            .orderBy(desc(repositories.createdAt));

        return NextResponse.json(repos);
    } catch (error) {
        console.error("GET /api/profile/:username/repos error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
