import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        // Mock data for now until requirements are clear
        return NextResponse.json({
            status: "active",
            riskLevel: "low",
            activeCookies: 0
        });
    } catch (error) {
        console.error("GET /api/spark/cookie-licking/status error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
