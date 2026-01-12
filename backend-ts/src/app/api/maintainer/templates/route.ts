/**
 * Maintainer Templates Route
 * 
 * GET /api/maintainer/templates
 * Fetch templates for a maintainer.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTemplatesByOwnerId } from "@/lib/db/queries/templates";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const templates = await getTemplatesByOwnerId(user.id);
        return NextResponse.json(templates);
    } catch (error) {
        console.error("GET /api/maintainer/templates error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
