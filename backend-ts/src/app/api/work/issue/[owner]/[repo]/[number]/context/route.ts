/**
 * GET /api/work/issue/:owner/:repo/:number/context[?ai=1]
 * Understanding: the Context Pack — previous attempts, maintainer notes, likely
 * files + who knows them, related issues, setup steps, a start checklist.
 * With ?ai=1 and AI configured, adds a short "where to start" guide grounded in that pack.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildContextPack, cached } from "@/lib/github/services";
import { githubError, validRepo, wantsFresh, withGitHub } from "@/lib/github/route-helpers";
import { aiEnabled, complete, quoteUntrusted } from "@/lib/ai/llm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ owner: string; repo: string; number: string }> }
) {
    const gh = await withGitHub(request);
    if ("error" in gh) return gh.error;
    const { owner, repo, number } = await context.params;
    const n = Number(number);
    if (!validRepo(owner, repo) || !Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ error: "Invalid issue reference" }, { status: 400 });
    }

    try {
        const pack = await cached(`ctx:${owner}/${repo}#${n}`.toLowerCase(), 10 * 60_000,
            () => buildContextPack(gh.octokit, owner, repo, n), wantsFresh(request));
        if (!pack) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

        let guide: string | null = null;
        const wantAi = new URL(request.url).searchParams.get("ai") === "1";
        if (wantAi && aiEnabled()) {
            guide = await complete(
                [
                    "You help a contributor start on a GitHub issue. Using ONLY the facts below, write a short plan:",
                    "1) what the problem is in one sentence, 2) which files to read first and why, 3) the first concrete step,",
                    "4) what to confirm with maintainers. Under 180 words. Say 'unknown' rather than guess.",
                    quoteUntrusted("context_pack", JSON.stringify({
                        title: pack.issue.title,
                        availability: pack.availability.summary,
                        previousAttempts: pack.previousAttempts.map((p) => `#${p.number} ${p.state} by ${p.author}: ${p.title}`),
                        maintainerNotes: pack.maintainerNotes.map((m) => `${m.author}: ${m.excerpt}`),
                        likelyFiles: pack.likelyFiles.map((f) => f.path),
                        related: pack.related.possibleDuplicates.concat(pack.related.related).map((r) => `#${r.number} ${r.title}`),
                        setup: pack.setup?.setup,
                    }), 6000),
                ].join("\n"),
                { maxTokens: 400 }
            );
        }

        return NextResponse.json({ ...pack, ai: { available: aiEnabled(), guide } });
    } catch (err) {
        return githubError(err, "context pack");
    }
}
