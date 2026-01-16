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

        const body = await request.json();
        const badgeIds = body.badge_ids || [];

        // TODO: Store featured badges in database
        // For now, just acknowledge the request
        console.log(`Updated featured badges for ${username}:`, badgeIds);

        return NextResponse.json({
            message: "Featured badges updated",
            featured: badgeIds
        });
    } catch (error) {
        console.error("POST /api/profile/:username/featured-badges error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// PUT method - same as POST for compatibility
export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    return POST(request, context);
}

