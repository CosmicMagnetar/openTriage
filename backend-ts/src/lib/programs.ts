/**
 * Curated open-source programs (GSoC, Outreachy, LFX, ...) from src/data/programs.json.
 * Status and next deadline are computed per request against "today" (UTC dates).
 */
import raw from "@/data/programs.json";

export type PhaseKind = "application" | "work" | "event" | "other";

export interface Phase {
    name: string;
    kind: PhaseKind;
    start: string; // YYYY-MM-DD, inclusive
    end: string; // YYYY-MM-DD, inclusive
}

export type OpportunityKind = "program" | "hackathon" | "cfp" | "bounty" | "grant" | "event" | "directory";

/** official: from the program's own feed/page this run. curated: hand-checked seed. estimated: usual timing. discovered: found in a list, link alive, details unverified. */
export type Verification = "official" | "curated" | "estimated" | "discovered";

export interface Program {
    id: string;
    /** Defaults to "program" for older data. */
    kind?: OpportunityKind;
    verification?: Verification;
    /** Comes back every year/term (rolls forward instead of being deleted). */
    recurring?: boolean;
    /** Prize or reward text, e.g. hackathon prizes or bounty amount. */
    reward?: string | null;
    name: string;
    org: string;
    url: string;
    summary: string;
    tags: string[];
    eligibility: string;
    stipend: string | null;
    /** Applications accepted any time; no fixed dates published. */
    rolling: boolean;
    phases: Phase[];
    source: string;
    checkedAt: string;
    /** Dates follow the program's usual yearly timing; next round not announced yet. */
    estimated?: boolean;
    /** Weekly official-page watch (see lib/opportunities/pageWatch.ts). */
    pageDates?: string[];
    pageCheckedAt?: string;
    datesChangedAt?: string | null;
    /** Main GitHub repo ("owner/repo") when known; used for ranking and repo links. */
    repo?: string;
    /** A few concrete items (e.g. open bounty issues with their amount). */
    items?: Array<{ title: string; url: string; amount: string | null }>;
}

export type ProgramStatus = "open" | "upcoming" | "closed";

export interface ProgramView extends Program {
    status: ProgramStatus;
    nextDeadline: { name: string; date: string } | null;
}

export const programs: Program[] = raw as Program[];

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Phases that decide whether you can join: application phases, or every phase if a program has none. */
function gatePhases(p: Program): Phase[] {
    const apply = p.phases.filter((ph) => ph.kind === "application");
    return apply.length ? apply : p.phases;
}

export function programStatus(p: Program, today: string): ProgramStatus {
    if (p.rolling) return "open";
    const gates = gatePhases(p);
    if (gates.some((ph) => ph.start <= today && today <= ph.end)) return "open";
    if (gates.some((ph) => ph.start > today)) return "upcoming";
    return "closed";
}

export function nextDeadline(p: Program, today: string): ProgramView["nextDeadline"] {
    const next = gatePhases(p)
        .filter((ph) => ph.end >= today)
        .sort((a, b) => a.end.localeCompare(b.end))[0];
    return next ? { name: next.name, date: next.end } : null;
}

export function withStatus(p: Program, today: string): ProgramView {
    return { ...p, status: programStatus(p, today), nextDeadline: nextDeadline(p, today) };
}

export interface ProgramFilter {
    q?: string;
    tags?: string[];
    ids?: string[];
}

const ORDER: Record<ProgramStatus, number> = { open: 0, upcoming: 1, closed: 2 };

/** Filter (q matches name/org/summary/tags, every tag must match) and sort open → upcoming → closed, then by deadline. */
export function listPrograms(filter: ProgramFilter = {}, now = new Date(), source = programs): ProgramView[] {
    const today = isoDay(now);
    const q = filter.q?.trim().toLowerCase();
    const tags = (filter.tags ?? []).map((t) => t.toLowerCase());
    const ids = filter.ids?.length ? new Set(filter.ids) : null;
    return source
        .filter((p) => !ids || ids.has(p.id))
        .filter((p) => tags.every((t) => p.tags.includes(t)))
        .filter((p) => !q || [p.name, p.org, p.summary, ...p.tags].some((s) => s.toLowerCase().includes(q)))
        .map((p) => withStatus(p, today))
        .sort((a, b) =>
            ORDER[a.status] - ORDER[b.status] ||
            (a.nextDeadline?.date ?? "9999").localeCompare(b.nextDeadline?.date ?? "9999") ||
            a.name.localeCompare(b.name));
}

// ---------- iCalendar (RFC 5545) ----------

const icsDate = (iso: string) => iso.replace(/-/g, "");

function dayAfter(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return isoDay(d);
}

/** Escape TEXT values (RFC 5545 §3.3.11). */
export const icsEscape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
    const bytes = Buffer.from(line, "utf8");
    if (bytes.length <= 75) return line;
    const parts: string[] = [];
    let cur = "";
    let len = 0;
    for (const ch of line) {
        const n = Buffer.byteLength(ch, "utf8");
        const limit = parts.length ? 74 : 75; // continuation lines start with a space
        if (len + n > limit) {
            parts.push(cur);
            cur = "";
            len = 0;
        }
        cur += ch;
        len += n;
    }
    parts.push(cur);
    return parts.join("\r\n ");
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Stable across rebuilds: depends only on program id, phase name and start date. */
export const phaseUid = (p: Program, ph: Phase) =>
    `${p.id}-${slug(ph.name)}-${icsDate(ph.start)}@opentriage`;

export function programsToIcs(list: Program[], now = new Date()): string {
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//OpenTriage//Open Source Programs//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Open source programs",
    ];
    for (const p of list) {
        for (const ph of p.phases) {
            lines.push(
                "BEGIN:VEVENT",
                `UID:${phaseUid(p, ph)}`,
                `DTSTAMP:${stamp}`,
                `DTSTART;VALUE=DATE:${icsDate(ph.start)}`,
                `DTEND;VALUE=DATE:${icsDate(dayAfter(ph.end))}`, // DTEND is exclusive for all-day events
                `SUMMARY:${icsEscape(`${p.name}: ${ph.name}`)}`,
                `DESCRIPTION:${icsEscape(`${p.summary}\nSource: ${p.source}`)}`,
                `URL:${p.url}`,
                "TRANSP:TRANSPARENT",
                "END:VEVENT",
            );
        }
    }
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
}
