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
 * Extract user from Authorization header.
 */
export async function getCurrentUser(request: NextRequest) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }

    const token = authHeader.substring(7);

    try {
        const payload = verifyJwtToken(token);

        // Fetch full user from database
        const userRecords = await db
            .select()
            .from(users)
            .where(eq(users.id, payload.user_id))
            .limit(1);

        if (userRecords.length === 0) {
            return null;
        }

        return userRecords[0];
    } catch {
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
