import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { issues, users } from "@/db/schema";
import { eq, and, lt, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Logic for "at-risk" issues:
        // Issues assigned but not updated in > 7 days (stub logic)

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const isoDate = sevenDaysAgo.toISOString();

        // For now, just return empty array or basic query to prevent 404
        return NextResponse.json([]);

    } catch (error) {
        console.error("GET /api/spark/cookie-licking/at-risk error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
