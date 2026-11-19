import type { Actor } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const NEWCOMER_ASSOCIATIONS = new Set(["FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "NONE"]);

export function daysBetween(from: string | Date, to: Date): number {
    const start = typeof from === "string" ? new Date(from) : from;
    return (to.getTime() - start.getTime()) / DAY_MS;
}

export function hoursBetween(from: string, to: string | Date): number {
    const end = typeof to === "string" ? new Date(to) : to;
    return (end.getTime() - new Date(from).getTime()) / (60 * 60 * 1000);
}

export function isBot(actor: Actor | undefined | null): boolean {
    if (!actor) return false;
    return Boolean(actor.isBot) || /\[bot\]$|-bot$|^dependabot|^renovate/i.test(actor.login);
}

/** Has write-level standing in the repo according to GitHub's author_association. */
export function isMaintainer(actor: Actor | undefined | null): boolean {
    return Boolean(actor?.association && MAINTAINER_ASSOCIATIONS.has(actor.association.toUpperCase()));
}

export function isNewcomer(actor: Actor | undefined | null): boolean {
    return Boolean(actor?.association && NEWCOMER_ASSOCIATIONS.has(actor.association.toUpperCase()));
}

export function sameLogin(a: string | undefined | null, b: string | undefined | null): boolean {
    return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function latest(dates: Array<string | null | undefined>): string | null {
    let best: string | null = null;
    for (const d of dates) {
        if (d && (!best || new Date(d) > new Date(best))) best = d;
    }
    return best;
}

export function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function formatDays(days: number): string {
    const d = Math.floor(days);
    if (d <= 0) return "today";
    if (d === 1) return "1 day";
    return `${d} days`;
}
