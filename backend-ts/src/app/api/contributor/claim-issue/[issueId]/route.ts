/**
 * Unclaim Issue Route
 * 
 * DELETE /api/contributor/claim-issue/[issueId]
 * Unclaim a previously claimed issue
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ issueId: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { issueId } = await params;

        // TODO: Implement full unclaiming logic with claimed_issues table
        return NextResponse.json({
            message: "Issue unclaimed successfully (stub)",
            issueId,
        });
    } catch (error) {
        console.error("Unclaim issue error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
