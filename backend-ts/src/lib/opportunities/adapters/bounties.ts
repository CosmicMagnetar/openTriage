/** Open bounty issues (Algora's "💎 Bounty" label and plain "bounty" labels), grouped per repo. */
import type { Program } from "@/lib/programs";
import { isoDay } from "../dates";

export interface BountyIssue { html_url: string; title: string; repository_url: string; labels: { name: string }[]; created_at: string }

const repoOf = (i: BountyIssue) => i.repository_url.replace("https://api.github.com/repos/", "");
const amount = (i: BountyIssue) => i.labels.map((l) => l.name.match(/\$\s?[\d,]+/)?.[0]).find(Boolean) ?? null;

/** One opportunity per repo with open bounties; `stars` filters out spam and toy repos. */
export function bountiesToPrograms(items: BountyIssue[], stars: Map<string, number>, minStars = 100): Program[] {
    const byRepo = new Map<string, BountyIssue[]>();
    for (const i of items) {
        const r = repoOf(i);
        if ((stars.get(r) ?? 0) < minStars) continue;
        byRepo.set(r, [...(byRepo.get(r) ?? []), i]);
    }
    return [...byRepo.entries()].map(([repo, list]) => {
        const amounts = list.map(amount).filter(Boolean);
        return {
            id: `bounty-${repo.toLowerCase().replace("/", "--")}`,
            kind: "bounty" as const,
            verification: "official" as const,
            recurring: false,
            name: `Bounties in ${repo}`,
            org: repo.split("/")[0],
            url: `https://github.com/${repo}/issues?q=is%3Aopen+label%3Abounty%2C%22%F0%9F%92%8E+Bounty%22`,
            summary: `${list.length} open paid issue${list.length > 1 ? "s" : ""}, e.g. "${list[0].title.slice(0, 90)}".`,
            tags: ["paid", "bounty", "remote"],
            eligibility: "Anyone; read the repo's bounty rules before starting.",
            stipend: null,
            reward: amounts.length ? `${amounts.slice(0, 3).join(", ")}${amounts.length > 3 ? "…" : ""}` : "Paid on merge",
            rolling: true,
            phases: [],
            source: "https://github.com/search?q=label%3A%22%F0%9F%92%8E+Bounty%22+state%3Aopen&type=issues",
            checkedAt: isoDay(new Date()),
        };
    });
}
