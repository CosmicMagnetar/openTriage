/**
 * GET /api/next-actions?workspace=contributor|maintainer[&repos=owner/a,owner/b]
 * Coordination: what needs *me* now, why (evidence), and the smallest next step.
 *
 * Contributor: my open PRs, review requests, issues I claimed (stale claims, overlap).
 * Maintainer: repos I can push to (tracked repos, or ?repos=) — newcomers waiting,
 * reviews pending, ready to merge, duplicate effort, stale claims, possible duplicates.
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { contributorToday, maintainerToday } from "@/lib/github/services";
import { githubError, validRepo, withGitHub } from "@/lib/github/route-helpers";

export async function GET(request: NextRequest) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;

    const sp = new URL(request.url).searchParams;
    const workspace = (sp.get("workspace") ?? gh.user.role).toLowerCase();

    try {
        if (workspace === "maintainer") {
            let repos: Array<{ owner: string; repo: string }>;
            const explicit = sp.get("repos");
            if (explicit) {
                repos = explicit.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
                    const [owner, repo] = s.split("/");
                    return { owner, repo };
                }).filter((r) => r.owner && r.repo && validRepo(r.owner, r.repo));
            } else {
                const rows = await db
                    .select({ owner: repositories.owner, repo: repositories.name })
                    .from(repositories)
                    .where(and(eq(repositories.userId, gh.user.id), eq(repositories.addedByUser, true)));
                repos = rows;
            }
            if (repos.length === 0) {
                return NextResponse.json({
                    workspace: "maintainer", actions: [], repos: [], skipped: [],
                    hint: "Add a repository you maintain to see what needs your attention.",
                });
            }
            return NextResponse.json({ workspace: "maintainer", ...(await maintainerToday(gh.octokit, gh.user.username, repos)) });
        }

        return NextResponse.json({ workspace: "contributor", ...(await contributorToday(gh.octokit, gh.user.username)) });
    } catch (err) {
        return githubError(err, "next actions");
    }
}
