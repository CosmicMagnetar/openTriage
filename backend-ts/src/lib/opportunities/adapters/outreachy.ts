/** Outreachy: no API; the applicant docs state the round dates in plain sentences. */
import type { Phase, Program } from "@/lib/programs";
import { isoDay, parseHumanDate } from "../dates";

const DATE = "([A-Z][a-z]+\\.? \\d{1,2}, \\d{4})";

export function outreachyFromHtml(html: string): Program | null {
    const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    const due = text.match(new RegExp(`[Ii]nitial applications? (?:are|is) due (?:on|by) ${DATE}`));
    const runs = text.match(new RegExp(`internship runs from ${DATE} to ${DATE}`));
    const appOpen = text.match(new RegExp(`[Ii]nitial applications? (?:open|opens) (?:on )?${DATE}`));
    const phases: Phase[] = [];
    const dueDay = due && parseHumanDate(due[1]);
    if (dueDay) {
        const start = (appOpen && parseHumanDate(appOpen[1])) || isoDay(new Date(Date.parse(dueDay) - 28 * 86_400_000));
        phases.push({ name: "Initial applications", kind: "application", start, end: dueDay });
    }
    const a = runs && parseHumanDate(runs[1]);
    const b = runs && parseHumanDate(runs[2]);
    if (a && b) phases.push({ name: "Internship", kind: "work", start: a, end: b });
    if (!phases.length) return null;
    return {
        id: "outreachy",
        kind: "program",
        verification: "official",
        recurring: true,
        name: "Outreachy internships",
        org: "Outreachy / Software Freedom Conservancy",
        url: "https://www.outreachy.org/",
        summary: "Paid, remote three-month open-source internships for people underrepresented in tech. Two rounds a year.",
        tags: ["paid", "remote", "first-timers", "underrepresented", "mentorship"],
        eligibility: "People who face underrepresentation, systemic bias or discrimination in tech where they live; must be available full-time.",
        stipend: "USD 7,000 total",
        rolling: false,
        phases,
        source: "https://www.outreachy.org/docs/applicant/",
        checkedAt: isoDay(new Date()),
    };
}
