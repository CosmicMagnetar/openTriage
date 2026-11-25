/**
 * GET /api/maintainer/funding
 * Grants, funds, hosting roles (GSoC org, LFX mentor, Outreachy), foundation
 * paths and perks, each with eligibility checked against the repos you
 * track (public, licence, stars), ordered for your maintainer goals.
 */
import { NextRequest, NextResponse } from "next/server";
import { MINUTE, cached } from "@/lib/github/services";
import { githubError, resolveRepos, withGitHub } from "@/lib/github/route-helpers";
import { loadOpportunities } from "@/lib/opportunities/store";
import { isoDay } from "@/lib/opportunities/dates";
import { withStatus } from "@/lib/programs";
import { maintainerOpportunities, type RepoBrief } from "@/lib/maintainer/funding";
import { getGoals } from "@/lib/ranking/store";

export async function GET(request: NextRequest) {
    const g = await withGitHub(request);
    if ("error" in g) return g.error;
    try {
        const repos = (await resolveRepos(request, g.user.id)).slice(0, 12);
        const briefs = (await Promise.all(repos.map((r) =>
            // Per viewer: private repos' facts never leave your own cache entries.
            cached(`brief:${g.user.username}:${r.owner}/${r.repo}`.toLowerCase(), 60 * MINUTE, async (): Promise<RepoBrief> => {
                const { data } = await g.octokit.repos.get({ owner: r.owner, repo: r.repo });
                const spdx = data.license?.spdx_id;
                return { repo: data.full_name, private: data.private, archived: data.archived, stars: data.stargazers_count, license: spdx && spdx !== "NOASSERTION" ? spdx : null };
            }).catch(() => null)))).filter((b): b is RepoBrief => !!b);
        const [{ list }, { goals }] = await Promise.all([loadOpportunities(), getGoals(g.user.id)]);
        const today = isoDay(new Date());
        const items = maintainerOpportunities(list.map((p) => withStatus(p, today)), briefs, goals.maintainer.goals);
        return NextResponse.json({ repos: briefs.map((b) => b.repo), goals: goals.maintainer.goals, items });
    } catch (err) {
        return githubError(err, "funding and programs");
    }
}
