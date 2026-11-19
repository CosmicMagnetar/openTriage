/**
 * "Will anyone respond if I contribute here?"
 * Based on CHAOSS Time to First Response and Change Request Closure Ratio, but
 * restricted to *outside* contributors, because that's the experience a newcomer gets.
 */
import type { Actor, Comment, Review } from "./types";
import { hoursBetween, isBot, isMaintainer, median, sameLogin } from "./util";

export interface ResponsivenessSample {
    author: Actor;
    createdAt: string;
    isPR: boolean;
    /** MERGED / CLOSED / OPEN */
    state: string;
    comments: Comment[];
    reviews?: Review[];
}

export type ResponsivenessLevel = "responsive" | "slow" | "unresponsive" | "unknown";

export interface Responsiveness {
    level: ResponsivenessLevel;
    /** Median hours until a maintainer (human) first responded to an outside contributor. */
    medianFirstResponseHours: number | null;
    /** Share of outside items that got any maintainer response. */
    responseRate: number | null;
    /** Share of outside PRs (closed ones) that were merged. */
    outsidePRMergeRate: number | null;
    sampleSize: number;
    summary: string;
}

function firstMaintainerResponse(sample: ResponsivenessSample): string | null {
    const events = [
        ...sample.comments.map((c) => ({ actor: c.author, at: c.createdAt })),
        ...(sample.reviews ?? []).map((r) => ({ actor: r.author, at: r.submittedAt })),
    ]
        .filter((e) => !isBot(e.actor) && isMaintainer(e.actor) && !sameLogin(e.actor.login, sample.author.login))
        .sort((a, b) => a.at.localeCompare(b.at));
    return events[0]?.at ?? null;
}

export function computeResponsiveness(samples: ResponsivenessSample[], now: Date = new Date()): Responsiveness {
    const outside = samples.filter((s) => !isMaintainer(s.author) && !isBot(s.author));
    // Too-recent items haven't had a fair chance to get a response.
    const judged = outside.filter((s) => hoursBetween(s.createdAt, now) >= 72 || firstMaintainerResponse(s));

    if (judged.length < 3) {
        return {
            level: "unknown",
            medianFirstResponseHours: null,
            responseRate: null,
            outsidePRMergeRate: null,
            sampleSize: judged.length,
            summary: "Not enough recent outside contributions to judge responsiveness.",
        };
    }

    const responseHours: number[] = [];
    let responded = 0;
    for (const s of judged) {
        const at = firstMaintainerResponse(s);
        if (at) {
            responded++;
            responseHours.push(Math.max(0, hoursBetween(s.createdAt, at)));
        }
    }
    const closedPRs = judged.filter((s) => s.isPR && (s.state === "MERGED" || s.state === "CLOSED"));
    const merged = closedPRs.filter((s) => s.state === "MERGED").length;

    const med = median(responseHours);
    const rate = responded / judged.length;
    const mergeRate = closedPRs.length >= 3 ? merged / closedPRs.length : null;

    let level: ResponsivenessLevel;
    if (rate < 0.4) level = "unresponsive";
    else if (med !== null && med <= 72 && rate >= 0.7) level = "responsive";
    else level = "slow";

    const medText = med === null ? "n/a" : med < 48 ? `${Math.round(med)}h` : `${Math.round(med / 24)}d`;
    const summary =
        `Maintainers answered ${Math.round(rate * 100)}% of ${judged.length} outside contributions ` +
        `(median first response ${medText})` +
        (mergeRate !== null ? `; ${Math.round(mergeRate * 100)}% of outside PRs merged.` : ".");

    return {
        level,
        medianFirstResponseHours: med === null ? null : Math.round(med),
        responseRate: Math.round(rate * 100) / 100,
        outsidePRMergeRate: mergeRate === null ? null : Math.round(mergeRate * 100) / 100,
        sampleSize: judged.length,
        summary,
    };
}

/** Repo-relative "slow" threshold in days, so a weekly-cadence repo isn't flagged daily. */
export function responseThresholdDays(r: Responsiveness, fallbackDays = 3): number {
    if (r.medianFirstResponseHours === null) return fallbackDays;
    const days = (r.medianFirstResponseHours / 24) * 2;
    return Math.min(14, Math.max(2, Math.round(days)));
}
