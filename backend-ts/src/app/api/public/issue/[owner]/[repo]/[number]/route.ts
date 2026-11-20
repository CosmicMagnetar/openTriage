/**
 * GET /api/public/issue/:owner/:repo/:number
 * Read-only summary for the browser extension: is it free, who is on it,
 * and how fast maintainers reply. Public repos only; needs GITHUB_TOKEN on
 * the server (GraphQL requires auth). Without it: { configured: false }.
 */
import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { buildIssueView, cached, MINUTE } from "@/lib/github/services";
import { validRepo } from "@/lib/github/route-helpers";

const token = process.env.GITHUB_TOKEN;
const octokit = token ? new Octokit({ auth: token }) : null;

export async function GET(_req: NextRequest, context: { params: Promise<{ owner: string; repo: string; number: string }> }) {
    const { owner, repo, number } = await context.params;
    const n = Number(number);
    if (!validRepo(owner, repo) || !Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
    }
    if (!octokit) return NextResponse.json({ configured: false });
    try {
        const data = await cached(`pub:${owner}/${repo}#${n}`.toLowerCase(), 10 * MINUTE, async () => {
            const meta = await octokit.repos.get({ owner, repo });
            if (meta.data.private) return null; // never expose private repos through a public endpoint
            const v = await buildIssueView(octokit, owner, repo, n, "");
            if (!v) return null;
            return {
                configured: true,
                availability: { status: v.availability.status, summary: v.availability.summary, contested: v.availability.contested },
                claims: v.availability.claims.map((c) => ({ login: c.login, stale: c.stale })),
                openPRs: v.availability.openPRs.map((p) => ({ number: p.number, author: p.author, url: p.url })),
                pickup: { verdict: v.pickup.verdict },
                responsiveness: v.responsiveness ? { level: v.responsiveness.level, summary: v.responsiveness.summary } : null,
            };
        });
        if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=300" } });
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}
