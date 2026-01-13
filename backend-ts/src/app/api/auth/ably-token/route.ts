/**
 * Ably Token Authentication Route
 * 
 * GET /api/auth/ably-token - Get Ably token for client-side auth
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTokenRequest, isAblyConfigured } from "@/lib/ably-client";

export async function GET(request: NextRequest) {
    try {
        // Check if Ably is configured
        if (!isAblyConfigured()) {
            return NextResponse.json(
                { error: "Ably is not configured" },
                { status: 503 }
            );
        }

        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Create token request with user's client ID
        const tokenRequest = await createTokenRequest(user.id);

        return NextResponse.json(tokenRequest);
    } catch (error) {
        console.error("GET /api/auth/ably-token error:", error);
        return NextResponse.json(
            { error: "Failed to create Ably token" },
            { status: 500 }
        );
    }
}
