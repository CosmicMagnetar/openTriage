/** Everything ranking needs about the signed-in user, in one call. */
import type { Octokit } from "@octokit/rest";
import { fetchSignals } from "@/lib/github/personal";
import type { Me } from "./index";
import { getGoals } from "./store";

export async function rankingContext(octokit: Octokit, userId: string, login: string) {
    const [signals, saved] = await Promise.all([
        fetchSignals(octokit, login).catch(() => ({ languages: [], contributedTo: [], starred: [], topics: [] })),
        getGoals(userId),
    ]);
    const me: Me = {
        languages: signals.languages,
        topics: signals.topics ?? [],
        contributedTo: signals.contributedTo,
        starred: signals.starred,
    };
    return { me, goals: saved.goals, feedback: saved.feedback, goalsSet: saved.set };
}
