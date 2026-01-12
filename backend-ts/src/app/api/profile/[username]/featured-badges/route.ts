import { NextRequest, NextResponse } from "next/server";
import { getUserBadges } from "@/lib/db/queries/gamification";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        const badges = await getUserBadges(username);
        // For now, just return top 5 badges as "featured"
        // In the future, we could add a "featured" flag to the trophy table
        const featured = badges.slice(0, 5);

        return NextResponse.json(featured);
    } catch (error) {
        console.error("GET /api/profile/:username/featured-badges error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
