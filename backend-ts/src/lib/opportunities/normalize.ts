/**
 * Pure rules shared by the sync job and the read path:
 * roll recurring programs forward, decide expiry, merge sources.
 */
import type { Program } from "@/lib/programs";
import { addYears } from "./dates";

const GRANT_TAGS = new Set(["grant"]);
const DIRECTORY_TAGS = new Set(["directory"]);

/** Seed data predates `kind`; infer it from tags. */
export function kindOf(p: Program): NonNullable<Program["kind"]> {
    if (p.kind) return p.kind;
    if (p.tags.some((t) => DIRECTORY_TAGS.has(t))) return "directory";
    if (p.tags.some((t) => GRANT_TAGS.has(t))) return "grant";
    if (p.tags.includes("event") || p.phases.every((ph) => ph.kind === "event") && p.phases.length) return "event";
    return "program";
}

/** Last day anything about it is still open; null for rolling/undated. */
export function endsOn(p: Program): string | null {
    if (p.rolling || p.phases.length === 0) return null;
    return p.phases.map((ph) => ph.end).sort().pop() ?? null;
}

/**
 * Recurring program whose dates are all in the past: move them forward a year
 * at a time to the next cycle, marked as usual timing, instead of deleting it.
 */
export function rollForward(p: Program, today: string): Program {
    const end = endsOn(p);
    if (!p.recurring || !end || end >= today) return p;
    let years = 0;
    while (addYears(end, years) < today && years < 5) years++;
    return {
        ...p,
        estimated: true,
        verification: p.verification === "official" ? "estimated" : p.verification ?? "estimated",
        name: p.name.replace(/\b(20\d{2})\b/, (y) => String(Number(y) + years)),
        phases: p.phases.map((ph) => ({
            ...ph,
            name: /usual timing/.test(ph.name) ? ph.name : `${ph.name} (usual timing)`,
            start: addYears(ph.start, years),
            end: addYears(ph.end, years),
        })),
    };
}

/** One-off whose last date has passed: remove it. */
export function isExpired(p: Program, today: string): boolean {
    if (p.recurring) return false;
    const end = endsOn(p);
    return end !== null && end < today;
}

/** Official adapters replace hand-kept seed entries for the same program. */
export const SEED_REPLACED_BY: Record<string, RegExp> = {
    gsoc: /^gsoc$/,
    outreachy: /^outreachy/,
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Discovered names that are already known (by name or link host) are dropped. */
export function isKnown(name: string, url: string, known: Program[]): boolean {
    const n = norm(name);
    let host = "";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    return known.some((k) => {
        const kn = norm(k.name);
        let kh = "";
        try { kh = new URL(k.url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
        return kn.includes(n) || n.includes(kn) || (host && host === kh);
    });
}
