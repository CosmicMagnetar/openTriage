/**
 * Issue Reconciliation API Route
 * 
 * POST /api/sync/reconcile - Reconcile a specific issue's state
 * 
 * Checks the issue state on GitHub and updates the database accordingly.
 * Use this to immediately sync a specific issue without running full sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reconcileSingleIssue, reconcileOpenTriageIssue1 } from "@/lib/sync/github-sync";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json({ error: "GitHub access token not found" }, { status: 400 });
        }

        // Parse request body
        const body = await request.json().catch(() => ({}));
        const { owner, repo, issueNumber, reconcileOpenTriage } = body;

        // Option 1: Reconcile the specific openTriage#1 issue
        if (reconcileOpenTriage) {
            const result = await reconcileOpenTriageIssue1(user.githubAccessToken);
            return NextResponse.json({
                success: result.success,
                message: result.message,
                result,
            });
        }

        // Option 2: Reconcile a specific issue by owner/repo/number
        if (owner && repo && issueNumber) {
            const result = await reconcileSingleIssue(
                user.githubAccessToken,
                owner,
                repo,
                Number(issueNumber)
            );
            return NextResponse.json({
                success: result.success,
                message: result.message,
                result,
            });
        }

        return NextResponse.json({
            error: "Missing required parameters. Provide either { reconcileOpenTriage: true } or { owner, repo, issueNumber }",
        }, { status: 400 });

    } catch (error) {
        console.error("POST /api/sync/reconcile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        description: "Issue Reconciliation API",
        usage: {
            reconcileOpenTriage: {
                method: "POST",
                body: { reconcileOpenTriage: true },
                description: "Reconcile cosmicMagnetar/openTriage#1 specifically",
            },
            reconcileSpecific: {
                method: "POST",
                body: { owner: "string", repo: "string", issueNumber: "number" },
                description: "Reconcile any specific issue by owner/repo/number",
            },
        },
        behavior: [
            "Fetches the issue state directly from GitHub API",
            "If issue is closed/not found on GitHub, removes it from database",
            "If issue is open, updates database to match GitHub state",
            "Publishes real-time events via Ably if configured",
        ],
    });
}
