/** Google Summer of Code: official public API with exact milestones. */
import type { Phase, Program } from "@/lib/programs";
import { addYears, isoDay } from "../dates";

interface Milestone { name: string; datetime: string; label: string }
interface GsocProgram { name: string; slug: string; milestones: Milestone[] }

const day = (dt: string) => dt.slice(0, 10);

export function gsocFromApi(list: GsocProgram[], today: string): Program | null {
    const latest = [...list].filter((p) => p.milestones?.length).sort((a, b) => a.slug.localeCompare(b.slug)).pop();
    if (!latest) return null;
    // Milestones repeat for extended timelines; the first one is the standard schedule.
    const m = new Map<string, string>();
    for (const x of latest.milestones) if (!m.has(x.name)) m.set(x.name, day(x.datetime));
    const phases: Phase[] = [];
    const add = (name: string, kind: Phase["kind"], a?: string, b?: string) => { if (a && b) phases.push({ name, kind, start: a, end: b }); };
    add("Org applications", "application", m.get("org_application_start"), m.get("org_application_deadline"));
    add("Contributor proposals", "application", m.get("contributor_proposals_open"), m.get("proposal_deadline"));
    add("Coding period", "work", m.get("project_work_start"), m.get("project_completion") ?? m.get("final_evaluation_deadline") ?? m.get("program_end"));

    // Next year not published yet: show last year's timing, marked estimated.
    const allPast = phases.every((p) => p.end < today);
    const year = Number(latest.slug) || new Date().getUTCFullYear();
    const shown = allPast ? phases.map((p) => ({ ...p, name: `${p.name} (usual timing)`, start: addYears(p.start, 1), end: addYears(p.end, 1) })) : phases;
    return {
        id: "gsoc",
        kind: "program",
        verification: allPast ? "estimated" : "official",
        estimated: allPast,
        recurring: true,
        name: `Google Summer of Code ${allPast ? year + 1 : year}`,
        org: "Google",
        url: "https://summerofcode.withgoogle.com/",
        summary: "Paid, mentored open-source coding projects with established organizations over the summer.",
        tags: ["paid", "remote", "students", "first-timers", "mentorship"],
        eligibility: "18+ and new or beginner open-source contributors (not limited to students).",
        stipend: "Paid; amount depends on project size and country.",
        rolling: false,
        phases: shown,
        source: "https://summerofcode.withgoogle.com/api/program/",
        checkedAt: isoDay(new Date()),
    };
}
