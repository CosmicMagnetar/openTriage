/**
 * Mentor Leaderboard Proxy Route
 * 
 * GET /api/leaderboard
 * Proxies requests to the Python AI engine leaderboard endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const limit = searchParams.get("limit") || "100";
        const offset = searchParams.get("offset") || "0";

        // Get AI engine URL from environment
        const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:7860";
        
        console.log(`Proxying leaderboard request to: ${aiEngineUrl}/leaderboard?limit=${limit}&offset=${offset}`);

        // Use a default API key for the AI engine (or could be passed via env)
        const aiApiKey = process.env.AI_ENGINE_API_KEY || "default-key";

        // Proxy request to Python AI engine
        const response = await fetch(
            `${aiEngineUrl}/leaderboard?limit=${limit}&offset=${offset}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${aiApiKey}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("AI Engine error:", data);
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error("GET /api/leaderboard proxy error:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch leaderboard",
                message: error.message,
                hint: "Make sure the AI engine is running and accessible"
            },
            { status: 503 }
        );
    }
}
