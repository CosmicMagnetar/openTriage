import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createJwtToken, normalizeWorkspace, OAUTH_STATE_COOKIE } from "@/lib/auth";
import { generateId, now } from "@/lib/utils";
import { eq } from "drizzle-orm";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function fail(reason: string) {
    const response = NextResponse.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(reason)}`);
    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth/github" });
    return response;
}

function statesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * GET /api/auth/github/callback
 * Handle GitHub OAuth callback and create user session.
 *
 * The session JWT is handed to the frontend in the URL *fragment* (`#token=`),
 * which browsers never send to servers or put in Referer headers.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (searchParams.get("error")) return fail("access_denied");
    if (!code) return fail("no_code");
    if (!statesMatch(state, request.cookies.get(OAUTH_STATE_COOKIE)?.value)) {
        return fail("invalid_state");
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.error("[auth] GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not configured");
        return fail("not_configured");
    }

    try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
        });
        const tokenData = await tokenResponse.json().catch(() => ({}));
        const accessToken: string | undefined = tokenData.access_token;
        if (!tokenResponse.ok || !accessToken) {
            console.error("[auth] Token exchange failed:", tokenData.error || tokenResponse.status);
            return fail("no_token");
        }

        const userResponse = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
        });
        if (!userResponse.ok) {
            console.error("[auth] GitHub /user failed:", userResponse.status);
            return fail("github_user_failed");
        }
        const githubUser = await userResponse.json();
        if (typeof githubUser?.id !== "number" || !githubUser.login) {
            return fail("github_user_failed");
        }

        const existing = await db
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(eq(users.githubId, githubUser.id))
            .limit(1);

        let userId: string;
        let role: string | null;

        if (existing.length > 0) {
            userId = existing[0].id;
            // Legacy rows may hold "MENTOR" (old sync bug) or null; workspaces are only these two.
            role = normalizeWorkspace(existing[0].role);
            // Refresh token and profile fields that can change on GitHub (rename, new avatar).
            await db
                .update(users)
                .set({
                    role,
                    githubAccessToken: accessToken,
                    username: githubUser.login,
                    avatarUrl: githubUser.avatar_url,
                    updatedAt: now(),
                })
                .where(eq(users.id, userId));
        } else {
            userId = generateId();
            // New accounts start in the contributor workspace; it can be switched anytime.
            role = "CONTRIBUTOR";
            await db.insert(users).values({
                id: userId,
                githubId: githubUser.id,
                username: githubUser.login,
                avatarUrl: githubUser.avatar_url,
                role,
                githubAccessToken: accessToken,
                createdAt: now(),
                updatedAt: now(),
            });
        }

        const token = createJwtToken(userId, role);
        const response = NextResponse.redirect(`${FRONTEND_URL}/#token=${encodeURIComponent(token)}`);
        response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth/github" });
        return response;
    } catch (error) {
        console.error("[auth] GitHub auth error:", error);
        return fail("auth_failed");
    }
}
