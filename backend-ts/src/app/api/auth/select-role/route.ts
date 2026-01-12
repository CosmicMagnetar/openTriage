/**
 * Role Selection Route
 * 
 * POST /api/auth/select-role
 * Allows authenticated users to select their role (MAINTAINER or CONTRIBUTOR)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createJwtToken } from "@/lib/auth";
import { updateUserRole } from "@/lib/db/queries/users";

export async function POST(request: NextRequest) {
    const { user, error } = await requireAuth(request);

    if (error) {
        return error;
    }

    try {
        const body = await request.json();
        const { role } = body;

        // Validate role
        if (!role || !["MAINTAINER", "CONTRIBUTOR"].includes(role.toUpperCase())) {
            return NextResponse.json(
                { error: "Invalid role. Must be MAINTAINER or CONTRIBUTOR" },
                { status: 400 }
            );
        }

        const normalizedRole = role.toUpperCase();

        // Update user role in database
        await updateUserRole(user!.id, normalizedRole);

        // Generate new token with updated role
        const newToken = createJwtToken(user!.id, normalizedRole);

        return NextResponse.json({
            success: true,
            role: normalizedRole,
            token: newToken,
        });
    } catch (error) {
        console.error("Role selection error:", error);
        return NextResponse.json(
            { error: "Failed to update role" },
            { status: 500 }
        );
    }
}
