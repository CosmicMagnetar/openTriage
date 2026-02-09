/**
 * Single Issue Route
 *
 * GET /api/maintainer/issues/:id
 * Fetch a single issue with its triage data by ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getIssueById, getTriageData } from "@/lib/db/queries/issues";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        const issue = await getIssueById(id);
        if (!issue) {
            return NextResponse.json({ error: "Issue not found" }, { status: 404 });
        }

        // Attach triage data if available
        const triage = await getTriageData(id);

        return NextResponse.json({
            ...issue,
            triage: triage || null,
        });
    } catch (error) {
        console.error("GET /api/maintainer/issues/:id error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
