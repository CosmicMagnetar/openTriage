import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { createGitHubClient } from "@/lib/github-client";

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

export function validRepo(owner: string, repo: string): boolean {
    return NAME.test(owner) && NAME.test(repo);
}

/** Auth + GitHub client, or an error response. */
export async function withGitHub(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return { error } as const;
    if (!user!.githubAccessToken) {
        return { error: NextResponse.json({ error: "GitHub account not connected. Sign in again." }, { status: 400 }) } as const;
    }
    return { user: user!, octokit: createGitHubClient(user!.githubAccessToken) } as const;
}

/** `?fresh=1` asks to skip the server cache (manual refresh). */
export function wantsFresh(request: NextRequest): boolean {
    return new URL(request.url).searchParams.get("fresh") === "1";
}

/** Parse `?repos=a/b,c/d`, else fall back to repositories the user added. */
export async function resolveRepos(request: NextRequest, userId: string) {
    const explicit = new URL(request.url).searchParams.get("repos");
    if (explicit) {
        return explicit.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
            const [owner, repo] = s.split("/");
            return { owner, repo };
        }).filter((r) => r.owner && r.repo && validRepo(r.owner, r.repo));
    }
    const rows = await db
        .select({ owner: repositories.owner, name: repositories.name })
        .from(repositories)
        .where(and(eq(repositories.userId, userId), eq(repositories.addedByUser, true)));
    // `name` is stored as "owner/repo" by add-repo (older rows may hold just "repo").
    const seen = new Set<string>();
    return rows
        .map((r) => {
            const [maybeOwner, maybeRepo] = r.name.split("/");
            return maybeRepo ? { owner: maybeOwner, repo: maybeRepo } : { owner: r.owner, repo: r.name };
        })
        .filter((r) => {
            const k = `${r.owner}/${r.repo}`.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
}

/** Map GitHub API failures to useful HTTP responses. */
export function githubError(err: unknown, what: string) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${what}]`, status ?? "", message);
    if (status === 404) return NextResponse.json({ error: "Not found on GitHub (or no access)." }, { status: 404 });
    if (status === 401) return NextResponse.json({ error: "GitHub token expired. Sign in again." }, { status: 401 });
    if (status === 422) return NextResponse.json({ error: "GitHub rejected the request." }, { status: 422 });
    if (status === 403 || /rate limit/i.test(message)) {
        return NextResponse.json({ error: "GitHub rate limit reached. Try again in a few minutes." }, { status: 429 });
    }
    return NextResponse.json({ error: `Failed to load ${what}` }, { status: 502 });
}
