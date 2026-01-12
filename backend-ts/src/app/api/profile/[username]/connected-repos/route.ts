import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profileConnectedRepos } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username: id } = await context.params;
        // 'id' here corresponds to the profile's userId (since userId is PK for profiles)
        const repos = await db
            .select()
            .from(profileConnectedRepos)
            .where(eq(profileConnectedRepos.profileId, id));

        return NextResponse.json(repos);
    } catch (error) {
        console.error("GET /api/profile/:id/connected-repos error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
