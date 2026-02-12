import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET!;

/**
 * Create a JWT token for a user.
 */
export function createJwtToken(userId: string, role: string | null): string {
    const payload = {
        user_id: userId,
        role: role,
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    };
    return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
}

/**
 * Verify and decode a JWT token.
 */
export function verifyJwtToken(token: string): { user_id: string; role: string | null } {
    try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as {
            user_id: string;
            role: string | null;
        };
        return payload;
    } catch (error) {
        throw new Error("Invalid or expired token");
    }
}

/**
 * Extract user from Authorization header or query param (for SSE).
 */
export async function getCurrentUser(request: NextRequest) {
    let token: string | null = null;

    // Try Authorization header first
    const authHeader = request.headers.get("Authorization");
    console.log("[getCurrentUser] Authorization header:", authHeader ? "Present" : "Missing");
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
        console.log("[getCurrentUser] Found token in Authorization header");
    }

    // Fallback to query param for SSE connections
    if (!token) {
        const url = new URL(request.url);
        token = url.searchParams.get("token");
        if (token) {
            console.log("[getCurrentUser] Found token in query params");
        }
    }

    if (!token) {
        console.log("[getCurrentUser] No token found in header or query params");
        return null;
    }

    try {
        const payload = verifyJwtToken(token);
        console.log("[getCurrentUser] Token verified, user_id:", payload.user_id);

        // Fetch full user from database
        // TODO: After Turso migration, re-add syncStatus, lastSyncAt, syncError to this select
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

        if (userRecords.length === 0) {
            console.log("[getCurrentUser] User not found in database for user_id:", payload.user_id);
            return null;
        }

        console.log("[getCurrentUser] User found:", userRecords[0].username);
        return userRecords[0];
    } catch (error: any) {
        console.error("[getCurrentUser] Token verification failed:", error?.message);
        return null;
    }
}

/**
 * Helper to require authentication on a route.
 */
export async function requireAuth(request: NextRequest) {
    const user = await getCurrentUser(request);

    if (!user) {
        return {
            user: null,
            error: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            ),
        };
    }

    return { user, error: null };
}
