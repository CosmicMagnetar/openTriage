import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { OAUTH_STATE_COOKIE } from "@/lib/auth";

const API_URL = process.env.API_URL || "http://localhost:3000";

/**
 * GET /api/auth/github
 * Redirect to GitHub OAuth authorization page.
 * A random `state` is stored in an httpOnly cookie and verified in the callback
 * to prevent login CSRF.
 */
export async function GET(_request: NextRequest) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
        console.error("[auth] GITHUB_CLIENT_ID is not configured");
        return NextResponse.json({ error: "GitHub login is not configured" }, { status: 500 });
    }

    const state = crypto.randomBytes(24).toString("hex");
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${API_URL}/api/auth/github/callback`,
        scope: "user:email read:user repo",
        state,
    });

    const response = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth/github",
        maxAge: 10 * 60,
    });
    return response;
}
