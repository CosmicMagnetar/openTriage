/**
 * My Claimed Issues Route
 * 
 * GET /api/contributor/my-claimed-issues
 * Get all issues claimed by the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // TODO: Implement with claimed_issues table
        return NextResponse.json({
            claims: [],
            count: 0,
        });
    } catch (error) {
        console.error("My claimed issues error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
