/**
 * One way to build GitHub clients, so every call gets the same care:
 * - Conditional requests: GET responses are remembered with their ETag and
 *   re-asked with If-None-Match. A 304 costs nothing against the rate limit.
 * - Rate budget: each token's remaining core requests are recorded, so jobs
 *   can pick the least-used token and pages can back off.
 * - Short secondary-rate-limit waits (Retry-After ≤ 10 s) are retried once.
 * Server-side jobs use serverOctokit(), which picks from GITHUB_TOKENS.
 */
import { createHash } from "crypto";
import type { Octokit } from "@octokit/rest";

/**
 * Loaded only when a client is built, so the pure helpers here (budgets,
 * token pool, ETag wrapper) can be imported by jobs and tests without
 * pulling in the ESM-only Octokit package.
 */
function OctokitClass(): typeof Octokit {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@octokit/rest").Octokit;
}

export const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex").slice(0, 12);

// ---------------------------------------------------------------------------
// Rate budget per token
// ---------------------------------------------------------------------------

export interface Budget { remaining: number; limit: number; resetAt: number }
const budgets = new Map<string, Budget>();

type HeaderBag = Headers | Record<string, string | number | undefined> | undefined | null;
const header = (h: HeaderBag, k: string): string | null => {
    if (!h) return null;
    if (typeof (h as Headers).get === "function") return (h as Headers).get(k);
    const v = (h as Record<string, unknown>)[k];
    return v == null ? null : String(v);
};

/** Remember what GitHub said about this token's core rate limit. Search/GraphQL buckets are ignored. */
export function recordBudget(token: string, h: HeaderBag): void {
    const remaining = Number(header(h, "x-ratelimit-remaining"));
    if (!Number.isFinite(remaining) || header(h, "x-ratelimit-remaining") === null) return;
    const resource = header(h, "x-ratelimit-resource");
    if (resource && resource !== "core") return;
    budgets.set(fingerprint(token), {
        remaining,
        limit: Number(header(h, "x-ratelimit-limit")) || 5000,
        resetAt: Number(header(h, "x-ratelimit-reset")) * 1000 || Date.now() + 60 * 60 * 1000,
    });
}

/** Known budget, or null when unknown or already reset (assume full). */
export function rateBudget(token: string, now = Date.now()): Budget | null {
    const b = budgets.get(fingerprint(token));
    return b && now < b.resetAt ? b : null;
}

/** Fewer than `floor` core requests left before the next reset. */
export function isBudgetLow(token: string, floor = 100): boolean {
    const b = rateBudget(token);
    return !!b && b.remaining < floor;
}

/** Pick the token with the most requests left; unknown counts as full. Pure, for tests. */
export function pickToken(tokens: string[], remainingOf: (t: string) => number | null): string | null {
    let best: string | null = null;
    let bestLeft = -1;
    for (const t of tokens) {
        const left = remainingOf(t) ?? Number.MAX_SAFE_INTEGER;
        if (left > bestLeft) { best = t; bestLeft = left; }
    }
    return best;
}

/** Tokens for server-side work: GITHUB_TOKENS (comma-separated) plus GITHUB_TOKEN. */
export function serverTokens(): string[] {
    const raw = [process.env.GITHUB_TOKENS ?? "", process.env.GITHUB_TOKEN ?? ""].join(",");
    return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

/** The server token with the most budget left, or null when none is configured. */
export function serverToken(): string | null {
    return pickToken(serverTokens(), (t) => rateBudget(t)?.remaining ?? null);
}

// ---------------------------------------------------------------------------
// Conditional requests (ETag), memory only, per token
// ---------------------------------------------------------------------------

const ETAG_MAX = 2000;
const etags = new Map<string, { etag: string; data: unknown }>();
function rememberEtag(key: string, entry: { etag: string; data: unknown }) {
    etags.delete(key);
    etags.set(key, entry);
    if (etags.size > ETAG_MAX) etags.delete(etags.keys().next().value as string);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GhResponse = { status: number; url: string; headers: Record<string, string>; data: unknown };
export type RequestOptions = Record<string, unknown> & { method?: string; headers?: Record<string, string> };

/**
 * The request wrapper, independent of Octokit so it can be tested with a fake
 * transport. `url` is the fully expanded URL (used as the ETag key).
 */
export async function conditionalRequest(token: string, url: string, send: (o: RequestOptions) => Promise<GhResponse>, options: RequestOptions, wait = sleep): Promise<GhResponse> {
    const isGet = (options.method ?? "GET").toUpperCase() === "GET";
    const key = isGet ? `${fingerprint(token)} ${url}` : null;
    const known = key ? etags.get(key) : undefined;
    if (known) options.headers = { ...(options.headers ?? {}), "if-none-match": known.etag };
    for (let attempt = 0; ; attempt++) {
        try {
            const res = await send(options);
            recordBudget(token, res.headers);
            const etag = res.headers?.etag;
            if (key && etag) rememberEtag(key, { etag, data: res.data });
            return res;
        } catch (err) {
            const e = err as { status?: number; response?: { headers?: Record<string, string>; url?: string } };
            const h = e.response?.headers;
            recordBudget(token, h);
            if (e.status === 304 && key && known) {
                rememberEtag(key, known);
                return { status: 200, url: e.response?.url ?? url, headers: h ?? {}, data: known.data };
            }
            const retryAfter = Number(h?.["retry-after"]);
            if (attempt === 0 && (e.status === 403 || e.status === 429) && retryAfter > 0 && retryAfter <= 10) {
                await wait(retryAfter * 1000);
                continue;
            }
            throw err;
        }
    }
}

export function createGitHubClient(token: string): Octokit {
    const Client = OctokitClass();
    const octokit = new Client({ auth: token, userAgent: "OpenTriage" });
    octokit.hook.wrap("request", (request, options) => {
        const url = octokit.request.endpoint(options as never).url;
        return conditionalRequest(token, url, request as never, options as unknown as RequestOptions) as never;
    });
    return octokit;
}

/** Client for server-side work on public data (sync jobs, public routes). Null when no token is configured. */
export function serverOctokit(): Octokit | null {
    const t = serverToken();
    return t ? createGitHubClient(t) : null;
}
