import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Get current authenticated user information.
 */
export async function GET(request: NextRequest) {
    const { user, error } = await requireAuth(request);

    if (error) {
        return error;
    }

    return NextResponse.json({
        id: user!.id,
        username: user!.username,
        avatarUrl: user!.avatarUrl,
        role: user!.role,
        githubId: user!.githubId,
    });
}
