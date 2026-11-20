/** Devpost: public JSON listing; we keep open/upcoming hackathons that match open source. */
import type { Program } from "@/lib/programs";
import { isoDay, parseHumanDate, slugify } from "../dates";

interface DevpostHackathon {
    id: number; title: string; url: string; organization_name?: string | null;
    submission_period_dates: string; open_state: string; prize_amount?: string;
    themes?: { name: string }[]; displayed_location?: { location?: string }; invite_only?: boolean;
}

/** "Nov 11, 2026 - Jan 11, 2027" or "Nov 11 - 25, 2026" → [start, end]. */
export function parsePeriod(s: string): [string, string] | null {
    const parts = s.split(/\s+-\s+/);
    if (parts.length !== 2) return null;
    let [a, b] = parts;
    const end = parseHumanDate(b) ?? parseHumanDate(`${a.split(" ")[0]} ${b}`);
    if (!end) return null;
    if (!/\d{4}/.test(a)) a = `${a}, ${end.slice(0, 4)}`;
    const start = parseHumanDate(a);
    return start ? [start, end] : null;
}

const strip = (s?: string) => (s ?? "").replace(/<[^>]+>/g, "").trim();

export function devpostToPrograms(list: DevpostHackathon[]): Program[] {
    return list.filter((h) => !h.invite_only && h.open_state !== "ended").flatMap((h) => {
        const period = parsePeriod(h.submission_period_dates);
        if (!period) return [];
        const prize = strip(h.prize_amount);
        return [{
            id: `devpost-${h.id}`,
            kind: "hackathon" as const,
            verification: "official" as const,
            recurring: false,
            name: h.title,
            org: h.organization_name || "Devpost",
            url: h.url,
            summary: `Hackathon${h.themes?.length ? ` · ${h.themes.map((t) => t.name).slice(0, 3).join(", ")}` : ""}${h.displayed_location?.location ? ` · ${h.displayed_location.location}` : ""}.`,
            tags: ["hackathon", ...(h.displayed_location?.location === "Online" ? ["remote"] : []), ...(h.themes ?? []).map((t) => slugify(t.name)).slice(0, 3)],
            eligibility: "See the hackathon rules.",
            stipend: null,
            // "$0", "CAD 0", "₹ 0": no cash prize.
            reward: prize && /[1-9]/.test(prize) ? `Prizes: ${prize}` : null,
            rolling: false,
            phases: [{ name: "Submissions", kind: "event" as const, start: period[0], end: period[1] }],
            source: "https://devpost.com/hackathons",
            checkedAt: isoDay(new Date()),
        }];
    });
}
