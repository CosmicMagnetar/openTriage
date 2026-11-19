import { NextRequest, NextResponse } from "next/server";
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

/** Map GitHub API failures to useful HTTP responses. */
export function githubError(err: unknown, what: string) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${what}]`, status ?? "", message);
    if (status === 404) return NextResponse.json({ error: "Not found on GitHub (or no access)." }, { status: 404 });
    if (status === 401) return NextResponse.json({ error: "GitHub token expired. Sign in again." }, { status: 401 });
    if (status === 403 || /rate limit/i.test(message)) {
        return NextResponse.json({ error: "GitHub rate limit reached. Try again in a few minutes." }, { status: 429 });
    }
    return NextResponse.json({ error: `Failed to load ${what}` }, { status: 502 });
}
