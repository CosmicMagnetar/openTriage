/**
 * What a user can maintain on GitHub: every repo they own or can push to
 * (including through orgs and teams), the orgs they belong to, and whether
 * their sign-in has the scopes we need. Pure rules are exported for tests;
 * fetchAccess() does the network work with the user's own token.
 */
import { createHash } from "crypto";

/** Scopes added after launch. Older sign-ins lack them and must re-connect once. */
export const REQUIRED_SCOPES = ["read:org", "read:project"] as const;

export type RepoRole = "owner" | "admin" | "maintain" | "push";

export interface AccessRepo {
    fullName: string;
    owner: string;
    name: string;
    role: RepoRole;
    viaOrg: boolean;
    private: boolean;
    archived: boolean;
    fork: boolean;
    pushedAt: string | null;
    stars: number;
    language: string | null;
    description: string | null;
}

export interface AccessOrg {
    login: string;
    avatarUrl: string;
    role: "admin" | "member" | null;
}

export interface Access {
    scopes: string[];
    missingScopes: string[];
    repos: AccessRepo[];
    orgs: AccessOrg[];
}

export interface RawRepo {
    full_name: string;
    name: string;
    owner: { login: string; type?: string };
    permissions?: { admin?: boolean; maintain?: boolean; push?: boolean };
    private?: boolean;
    archived?: boolean;
    fork?: boolean;
    pushed_at?: string | null;
    stargazers_count?: number;
    language?: string | null;
    description?: string | null;
}

const ROLE_RANK: Record<RepoRole, number> = { owner: 3, admin: 2, maintain: 1, push: 0 };

/** Scopes granted to the token, from GitHub's `X-OAuth-Scopes` header. No header (e.g. a GitHub App token): don't nag. */
export function missingScopes(header: string | null | undefined): { scopes: string[]; missing: string[] } {
    if (header == null) return { scopes: [], missing: [] };
    const scopes = header.split(",").map((s) => s.trim()).filter(Boolean);
    const has = new Set(scopes);
    // `admin:org` / `write:org` include read:org; `project` includes read:project.
    const covers: Record<string, string[]> = { "read:org": ["admin:org", "write:org"], "read:project": ["project"] };
    const missing = REQUIRED_SCOPES.filter((s) => !has.has(s) && !(covers[s] ?? []).some((c) => has.has(c)));
    return { scopes, missing };
}

/** A repo the user can maintain, or null when they can only read it. */
export function classifyRepo(r: RawRepo, login: string): AccessRepo | null {
    const p = r.permissions ?? {};
    const isOwner = r.owner.login.toLowerCase() === login.toLowerCase();
    const role: RepoRole | null = isOwner ? "owner" : p.admin ? "admin" : p.maintain ? "maintain" : p.push ? "push" : null;
    if (!role) return null;
    return {
        fullName: r.full_name,
        owner: r.owner.login,
        name: r.name,
        role,
        viaOrg: r.owner.type === "Organization",
        private: !!r.private,
        archived: !!r.archived,
        fork: !!r.fork,
        pushedAt: r.pushed_at ?? null,
        stars: r.stargazers_count ?? 0,
        language: r.language ?? null,
        description: r.description ?? null,
    };
}

/** Strongest role first, then most recently pushed. */
export function sortRepos(repos: AccessRepo[]): AccessRepo[] {
    return [...repos].sort((a, b) =>
        ROLE_RANK[b.role] - ROLE_RANK[a.role] || (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "") || a.fullName.localeCompare(b.fullName));
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Repos to start tracking for someone who tracks none yet: live (not archived,
 * not a fork), pushed in the last 180 days, and where they have real say
 * (owner/admin/maintain), or push access with a push in the last 60 days.
 */
export function pickAutoTrack(repos: AccessRepo[], now = Date.now(), max = 12): string[] {
    const recent = (r: AccessRepo, days: number) => !!r.pushedAt && now - Date.parse(r.pushedAt) <= days * DAY;
    return sortRepos(repos)
        .filter((r) => !r.archived && !r.fork)
        .filter((r) => (r.role === "push" ? recent(r, 60) : recent(r, 180)))
        .slice(0, max)
        .map((r) => r.fullName);
}

/** GitHub page where a user asks an org to approve this OAuth app. */
export function requestAccessUrl(clientId: string | undefined): string {
    return clientId ? `https://github.com/settings/connections/applications/${clientId}` : "https://github.com/settings/applications";
}

/**
 * Cache key for a user's access. Includes a fingerprint of the token, so a
 * fresh sign-in (new token, new scopes) is never answered from the old entry.
 */
export function accessCacheKey(userId: string, token: string): string {
    return `access:${userId}:${createHash("sha256").update(token).digest("hex").slice(0, 12)}`;
}

const UA = "OpenTriage";
const MAX_PAGES = 10;

async function gh(token: string, path: string) {
    const res = await fetch(`https://api.github.com${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": UA },
        signal: AbortSignal.timeout(15_000),
    });
    return res;
}

/** All repos the token can push to (owned, collaborator, org/team member), plus orgs and scopes. */
export async function fetchAccess(token: string, login: string): Promise<Access> {
    const raw: RawRepo[] = [];
    let header: string | null = null;
    for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await gh(token, `/user/repos?affiliation=owner,collaborator,organization_member&per_page=100&sort=pushed&page=${page}`);
        if (!res.ok) {
            const err = new Error(`GitHub ${res.status} listing repositories`) as Error & { status?: number };
            err.status = res.status;
            throw err;
        }
        if (page === 1) header = res.headers.get("x-oauth-scopes");
        const batch = (await res.json()) as RawRepo[];
        raw.push(...batch);
        if (batch.length < 100) break;
    }
    const { scopes, missing } = missingScopes(header);

    // Memberships give the role but need read:org; /user/orgs is the fallback.
    let orgs: AccessOrg[] = [];
    const m = await gh(token, "/user/memberships/orgs?state=active&per_page=100").catch(() => null);
    if (m?.ok) {
        const list = (await m.json()) as Array<{ role: string; organization: { login: string; avatar_url: string } }>;
        orgs = list.map((x) => ({ login: x.organization.login, avatarUrl: x.organization.avatar_url, role: x.role === "admin" ? "admin" : "member" }));
    } else {
        const o = await gh(token, "/user/orgs?per_page=100").catch(() => null);
        if (o?.ok) {
            const list = (await o.json()) as Array<{ login: string; avatar_url: string }>;
            orgs = list.map((x) => ({ login: x.login, avatarUrl: x.avatar_url, role: null }));
        }
    }

    const seen = new Set<string>();
    const repos = sortRepos(raw.map((r) => classifyRepo(r, login)).filter((r): r is AccessRepo => {
        if (!r || seen.has(r.fullName.toLowerCase())) return false;
        seen.add(r.fullName.toLowerCase());
        return true;
    }));
    return { scopes, missingScopes: missing, repos, orgs };
}
