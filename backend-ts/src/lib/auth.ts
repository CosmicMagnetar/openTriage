import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Cookie holding the OAuth `state` between /api/auth/github and its callback. */
export const OAUTH_STATE_COOKIE = "ot_oauth_state";

export type Workspace = "MAINTAINER" | "CONTRIBUTOR";

/**
 * Maintainer/Contributor are switchable workspaces on one account, not permission roles.
 * Anything else (null, legacy "MENTOR") maps to CONTRIBUTOR.
 */
export function normalizeWorkspace(role: string | null | undefined): Workspace {
    return role?.toUpperCase() === "MAINTAINER" ? "MAINTAINER" : "CONTRIBUTOR";
}

/**
 * Routes that may authenticate with `?token=` because EventSource/WebSocket
 * clients cannot set an Authorization header. Everything else must use the header.
 */
const QUERY_TOKEN_PATHS: string[] = [];

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return secret;
}

/**
 * Create a JWT token for a user.
 */
export function createJwtToken(userId: string, role: string | null): string {
    const payload = {
        user_id: userId,
        role: role,
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    };
    return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256" });
}

/**
 * Verify and decode a JWT token.
 */
export function verifyJwtToken(token: string): { user_id: string; role: string | null } {
    try {
        return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as {
            user_id: string;
            role: string | null;
        };
    } catch {
        throw new Error("Invalid or expired token");
    }
}

function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }
    const url = new URL(request.url);
    if (QUERY_TOKEN_PATHS.some((p) => url.pathname.startsWith(p))) {
        return url.searchParams.get("token");
    }
    return null;
}

/**
 * Extract the current user from the Authorization header
 * (or `?token=` for streaming endpoints only).
 */
export async function getCurrentUser(request: NextRequest) {
    const token = extractToken(request);
    if (!token) return null;

    let payload: { user_id: string };
    try {
        payload = verifyJwtToken(token);
    } catch {
        return null;
    }

    // NOTE: sync_status columns excluded until Turso migration is applied
    const userRecords = await db
        .select({
            id: users.id,
            githubId: users.githubId,
            username: users.username,
            avatarUrl: users.avatarUrl,
            role: users.role,
            githubAccessToken: users.githubAccessToken,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, payload.user_id))
        .limit(1);

    if (userRecords.length === 0) return null;
    const user = userRecords[0];
    return { ...user, role: normalizeWorkspace(user.role) };
}

/**
 * Helper to require authentication on a route.
 */
export async function requireAuth(request: NextRequest) {
    const user = await getCurrentUser(request);

    if (!user) {
        return {
            user: null,
            error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    return { user, error: null };
}
