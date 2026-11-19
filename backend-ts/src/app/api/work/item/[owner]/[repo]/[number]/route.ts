/**
 * POST /api/work/item/:owner/:repo/:number
 *   { action: "comment", body }        → posts a comment on GitHub as the user
 *   { action: "label", labels: [..] }  → adds labels on GitHub
 * Works for issues and PRs (same GitHub issue number space).
 */
import { NextRequest, NextResponse } from "next/server";
import { addLabels, postComment } from "@/lib/github/workspace";
import { githubError, validRepo, withGitHub } from "@/lib/github/route-helpers";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ owner: string; repo: string; number: string }> }
) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const { owner, repo, number } = await context.params;
    const n = Number(number);
    if (!validRepo(owner, repo) || !Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    try {
        if (body.action === "comment") {
            const text = typeof body.body === "string" ? body.body.trim() : "";
            if (!text || text.length > 65_000) return NextResponse.json({ error: "Comment is empty or too long" }, { status: 400 });
            return NextResponse.json(await postComment(gh.octokit, owner, repo, n, text));
        }
        if (body.action === "label") {
            const labels: string[] = Array.isArray(body.labels)
                ? body.labels.filter((l: unknown): l is string => typeof l === "string" && l.trim().length > 0 && l.length <= 50).slice(0, 10)
                : [];
            if (labels.length === 0) return NextResponse.json({ error: "No labels given" }, { status: 400 });
            return NextResponse.json(await addLabels(gh.octokit, owner, repo, n, labels));
        }
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (err) {
        return githubError(err, "GitHub write");
    }
}
