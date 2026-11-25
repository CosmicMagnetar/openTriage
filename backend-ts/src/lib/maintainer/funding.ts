/**
 * Funding and programs for maintainers: grants and funds, hosting roles
 * (GSoC org, LFX mentor, Outreachy community), foundation paths and free
 * perks. The entries themselves live in the opportunities store (seed +
 * daily sync: link checks, dates rolled forward), tagged "maintainers".
 * This file adds what a contributor list can't: per-repo eligibility,
 * checked against the repo's own facts. Pure and tested.
 */
import type { Program } from "@/lib/programs";
import type { MaintainerGoals } from "@/lib/ranking";

export type MaintainerKind = "fund" | "host" | "foundation" | "perk";

/** OSI-approved licences we see most; anything else counts as "check yourself". */
const OSI = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "GPL-2.0", "GPL-2.0-only", "GPL-2.0-or-later", "GPL-3.0",
    "GPL-3.0-only", "GPL-3.0-or-later", "LGPL-2.1", "LGPL-3.0", "AGPL-3.0", "MPL-2.0", "ISC", "EPL-2.0", "0BSD", "Unlicense", "Zlib", "BSL-1.0"]);

export interface RepoBrief { repo: string; private: boolean; archived: boolean; stars: number; license: string | null }

interface Rule {
    kind: MaintainerKind;
    /** Shown on the card: what the program gives. Only facts the program publishes. */
    gives: string;
    publicOnly?: boolean;
    osiLicense?: boolean;
    minStars?: number;
    /** Things we can't check from GitHub; shown as "check yourself". */
    manual?: string[];
}

/** Rules for entries in the opportunities store, by id. Unknown ids get no rule (always "check"). */
export const RULES: Record<string, Rule> = {
    "github-sosf": { kind: "fund", gives: "$10,000 per project, security training", publicOnly: true, osiLicense: true, minStars: 100, manual: ["Widely used project with clear governance", "Lives in a GitHub Sponsors region"] },
    "sovereign-tech-fund": { kind: "fund", gives: "From €50,000 for maintenance work", publicOnly: true, osiLicense: true, minStars: 50, manual: ["Infrastructure others build on, not an end-user app"] },
    "nlnet-ngi0": { kind: "fund", gives: "Grants for internet-related open source; calls every two months", publicOnly: true, osiLicense: true, manual: ["Your work fits one of NLnet's open calls"] },
    "floss-fund": { kind: "fund", gives: "Yearly funding for open-source projects", publicOnly: true, osiLicense: true, minStars: 50, manual: ["Publish a funding.json manifest"] },
    "prototype-fund": { kind: "fund", gives: "Funding for public-interest prototypes", publicOnly: true, osiLicense: true, manual: ["Based in Germany"] },
    "alpha-omega": { kind: "fund", gives: "Security funding for critical projects", publicOnly: true, minStars: 1000, manual: ["Mostly invited or targeted grants"] },
    gsoc: { kind: "host", gives: "Contributors paid by Google to work on your project", publicOnly: true, osiLicense: true, manual: ["Apply as an organisation with a list of project ideas"] },
    "lfx-mentorship": { kind: "host", gives: "Paid mentees for Linux Foundation / CNCF projects", publicOnly: true, manual: ["Project is part of an LF foundation"] },
    outreachy: { kind: "host", gives: "Paid interns from groups underrepresented in tech", publicOnly: true, manual: ["Your community funds or finds funding for an intern"] },
    "cncf-sandbox": { kind: "foundation", gives: "Neutral home, CNCF services and visibility", publicOnly: true, osiLicense: true, manual: ["Cloud native project"] },
    "openssf-best-practices": { kind: "foundation", gives: "A best-practices badge funders and foundations recognise", publicOnly: true, osiLicense: true },
    "github-maintainer-perks": { kind: "perk", gives: "Free GitHub Copilot Pro and tools for maintainers of popular projects", publicOnly: true, minStars: 100 },
    "github-sponsors": { kind: "perk", gives: "Recurring donations to you or your project", publicOnly: true, manual: ["Lives in a GitHub Sponsors region"] },
};

export type Verdict = "eligible" | "check" | "not-yet";

export interface Eligibility { repo: string; verdict: Verdict; met: string[]; missing: string[]; manual: string[] }

/** Can this repo apply? Only from facts GitHub shows; the rest is listed as "check yourself". */
export function eligibilityFor(id: string, r: RepoBrief): Eligibility {
    const rule = RULES[id];
    const met: string[] = [];
    const missing: string[] = [];
    if (r.archived) return { repo: r.repo, verdict: "not-yet", met, missing: ["Repo is archived"], manual: [] };
    if (rule?.publicOnly) (r.private ? missing : met).push("Public repo");
    if (rule?.osiLicense) {
        if (r.license && OSI.has(r.license)) met.push(`${r.license} licence`);
        else missing.push(r.license ? `OSI licence (${r.license} isn't one we know)` : "An open-source licence");
    }
    if (rule?.minStars) (r.stars >= rule.minStars ? met : missing).push(`${rule.minStars}+ stars (has ${r.stars})`);
    const manual = rule?.manual ?? [];
    const verdict: Verdict = missing.length ? "not-yet" : manual.length || !rule ? "check" : "eligible";
    return { repo: r.repo, verdict, met, missing, manual };
}

export interface MaintainerOpportunity {
    program: Program;
    kind: MaintainerKind;
    gives: string | null;
    /** Best repo first. */
    repos: Eligibility[];
    best: Verdict;
    score: number;
}

const VERDICT_RANK: Record<Verdict, number> = { eligible: 0, check: 1, "not-yet": 2 };
const KIND_FOR_GOAL: Record<string, MaintainerKind[]> = { funding: ["fund", "perk"], contributors: ["host"], foundation: ["foundation"], security: ["fund"] };

/** Every maintainer opportunity with eligibility per repo, ordered for your goals. */
export function maintainerOpportunities(list: Program[], repos: RepoBrief[], goals: MaintainerGoals["goals"] = []): MaintainerOpportunity[] {
    const wanted = new Set(goals.flatMap((g) => KIND_FOR_GOAL[g] ?? []));
    return list
        .filter((p) => RULES[p.id] || p.tags.includes("maintainers"))
        .map((p) => {
            const rule = RULES[p.id];
            const kind = rule?.kind ?? "fund";
            const per = repos.map((r) => eligibilityFor(p.id, r)).sort((a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]);
            const best = per[0]?.verdict ?? "check";
            const securityBoost = goals.includes("security") && p.tags.includes("security") ? 15 : 0;
            // A goal (35) outweighs one step of eligibility certainty (30): if you said "funding", funds lead.
            const score = (2 - VERDICT_RANK[best]) * 30 + (wanted.has(kind) ? 35 : 0) + securityBoost;
            return { program: p, kind, gives: rule?.gives ?? null, repos: per.slice(0, 5), best, score };
        })
        .sort((a, b) => b.score - a.score || a.program.name.localeCompare(b.program.name));
}
