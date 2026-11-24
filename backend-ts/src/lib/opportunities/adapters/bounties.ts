/**
 * Open bounty issues (Algora's "💎 Bounty", "💰 Bounty" and plain "bounty"
 * labels), grouped per repo, with the newest issues and their amounts listed.
 */
import type { Program } from "@/lib/programs";
import { isoDay } from "../dates";

export interface BountyIssue { html_url: string; title: string; repository_url: string; labels: { name: string }[]; created_at: string }

/** Label searches the sync runs (GitHub label search is case-insensitive). */
export const BOUNTY_LABELS = ['"💎 Bounty"', '"💰 Bounty"', "bounty"];

const repoOf = (i: BountyIssue) => i.repository_url.replace("https://api.github.com/repos/", "");

/** "$1,500", "$50", "$2k", "500 USD" from labels first, then the title. */
export function bountyAmount(i: Pick<BountyIssue, "labels" | "title">): string | null {
    const find = (s: string) => s.match(/\$\s?\d[\d,]*(?:\.\d+)?\s?[kK]?\b/)?.[0]?.replace(/\s/g, "")
        ?? s.match(/\b\d[\d,]*\s?(?:USD|usd)\b/)?.[0]?.replace(/\s?usd$/i, "").replace(/^/, "$") ?? null;
    for (const l of i.labels) {
        const a = find(l.name);
        if (a) return a;
    }
    return find(i.title);
}

/** One opportunity per repo with open bounties; `stars` filters out spam and toy repos. */
export function bountiesToPrograms(items: BountyIssue[], stars: Map<string, number>, minStars = 20): Program[] {
    const byRepo = new Map<string, BountyIssue[]>();
    const seen = new Set<string>();
    for (const i of items) {
        if (seen.has(i.html_url)) continue; // same issue found by two label searches
        seen.add(i.html_url);
        const r = repoOf(i);
        if ((stars.get(r) ?? 0) < minStars) continue;
        byRepo.set(r, [...(byRepo.get(r) ?? []), i]);
    }
    return [...byRepo.entries()].map(([repo, list]) => {
        const newest = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
        const amounts = newest.map(bountyAmount).filter((a): a is string => !!a);
        return {
            id: `bounty-${repo.toLowerCase().replace("/", "--")}`,
            kind: "bounty" as const,
            verification: "official" as const,
            recurring: false,
            name: `Bounties in ${repo}`,
            org: repo.split("/")[0],
            url: `https://github.com/${repo}/issues?q=is%3Aopen+label%3Abounty%2C%22%F0%9F%92%8E+Bounty%22%2C%22%F0%9F%92%B0+Bounty%22`,
            // The issues themselves are listed in `items`; the summary only counts them.
            summary: `${list.length} open paid issue${list.length > 1 ? "s" : ""}. Pick one, comment that you're on it, then open a PR.`,
            tags: ["paid", "bounty", "remote"],
            eligibility: "Anyone; read the repo's bounty rules before starting.",
            stipend: null,
            reward: amounts.length ? `${amounts.slice(0, 3).join(", ")}${amounts.length > 3 ? "…" : ""}` : "Paid on merge",
            rolling: true,
            phases: [],
            source: "https://github.com/search?q=label%3A%22%F0%9F%92%8E+Bounty%22+state%3Aopen&type=issues",
            checkedAt: isoDay(new Date()),
            repo,
            items: newest.slice(0, 5).map((i) => ({ title: i.title.slice(0, 140), url: i.html_url, amount: bountyAmount(i) })),
        };
    });
}
