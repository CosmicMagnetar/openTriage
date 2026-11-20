/**
 * Contributor intelligence (maintainer-only, per repo, from GitHub evidence).
 * Answers "has this person worked here before, on what, and how did it go?"
 * Never a score: counts, dates, areas and links only.
 */

export interface ContributorPR {
    number: number;
    title: string;
    url: string;
    state: "OPEN" | "CLOSED" | "MERGED";
    createdAt: string;
    mergedAt: string | null;
    files: string[];
}

export interface ContributorSummary {
    login: string;
    repo: string;
    prs: { merged: number; open: number; closedUnmerged: number };
    issuesOpened: number;
    firstSeenAt: string | null;
    lastActiveAt: string | null;
    /** Median days from opening to merge, for merged PRs. */
    medianDaysToMerge: number | null;
    /** Top-level areas touched by merged PRs, most first. */
    areas: Array<{ path: string; prs: number }>;
    recent: Array<Pick<ContributorPR, "number" | "title" | "url" | "state" | "createdAt">>;
    /** Plain-language one-liner for the item panel. */
    summary: string;
}

const area = (file: string) => {
    const parts = file.split("/");
    if (parts.length === 1) return "(root)";
    // packages/foo/... and apps/foo/... are areas of their own.
    if (["packages", "apps", "libs", "crates", "modules", "services"].includes(parts[0]) && parts.length > 2) return `${parts[0]}/${parts[1]}`;
    return parts[0];
};

function median(nums: number[]): number | null {
    if (nums.length === 0) return null;
    const s = [...nums].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function summarizeContributor(login: string, repo: string, prs: ContributorPR[], issuesOpened: number, issueDates: string[] = []): ContributorSummary {
    const merged = prs.filter((p) => p.state === "MERGED");
    const open = prs.filter((p) => p.state === "OPEN");
    const closedUnmerged = prs.filter((p) => p.state === "CLOSED");

    const areaCounts = new Map<string, number>();
    for (const p of merged) {
        for (const a of new Set(p.files.map(area))) areaCounts.set(a, (areaCounts.get(a) ?? 0) + 1);
    }
    const areas = [...areaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([path, n]) => ({ path, prs: n }));

    const dates = [...prs.map((p) => p.createdAt), ...prs.map((p) => p.mergedAt).filter(Boolean) as string[], ...issueDates].sort();
    const daysToMerge = merged.map((p) => (new Date(p.mergedAt!).getTime() - new Date(p.createdAt).getTime()) / 86_400_000);
    const med = median(daysToMerge);

    let summary: string;
    if (prs.length === 0 && issuesOpened === 0) summary = `First time in ${repo}.`;
    else if (merged.length === 0 && prs.length > 0) summary = `${prs.length} PR${prs.length > 1 ? "s" : ""} here, none merged yet.`;
    else if (merged.length === 0) summary = `Opened ${issuesOpened} issue${issuesOpened > 1 ? "s" : ""} here, no PRs yet.`;
    else summary = `${merged.length} merged PR${merged.length > 1 ? "s" : ""} here${areas[0] ? `, mostly in ${areas[0].path}` : ""}.`;

    return {
        login, repo,
        prs: { merged: merged.length, open: open.length, closedUnmerged: closedUnmerged.length },
        issuesOpened,
        firstSeenAt: dates[0] ?? null,
        lastActiveAt: dates[dates.length - 1] ?? null,
        medianDaysToMerge: med === null ? null : Math.round(med * 10) / 10,
        areas,
        recent: [...prs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
            .map(({ number, title, url, state, createdAt }) => ({ number, title, url, state, createdAt })),
        summary,
    };
}
