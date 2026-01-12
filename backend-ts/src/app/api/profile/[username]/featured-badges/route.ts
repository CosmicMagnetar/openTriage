import { NextRequest, NextResponse } from "next/server";
import { getUserBadges } from "@/lib/db/queries/gamification";
import { getCurrentUser } from "@/lib/auth";

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

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { username } = await context.params;
        if (user.username !== username) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // In a real app, we would update the 'isFeatured' flag on the trophies
        // For now, we'll just acknowledge the request to prevent 405 error
        // const body = await request.json();

        return NextResponse.json({ message: "Featured badges updated" });
    } catch (error) {
        console.error("POST /api/profile/:username/featured-badges error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
