import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Return user details. In a real app we might fetch full profile from DB here too,
        // but getCurrentUser usually returns the basic valid session user.
        return NextResponse.json(user);
    } catch (error) {
        console.error("GET /api/user/me error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
