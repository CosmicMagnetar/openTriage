import { NextRequest, NextResponse } from "next/server";
import { getUserBadges } from "@/lib/db/queries/gamification";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        // Trigger check logic here...

        // Return current badges
        const badges = await getUserBadges(username);
        return NextResponse.json({
            message: "Badges checked",
            newBadges: [], // none for now
            currentBadges: badges
        });

    } catch (error) {
        console.error("GET /api/spark/badges/check/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    return GET(request, context);
}
