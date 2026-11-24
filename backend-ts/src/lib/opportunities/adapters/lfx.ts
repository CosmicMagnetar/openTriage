/**
 * LFX Mentorship (Linux Foundation, incl. CNCF projects) from the public API
 * the site itself uses: GET https://mentorship.linuxfoundation.org/api/programs
 * One opportunity per project term that is accepting applications now.
 */
import type { Program } from "@/lib/programs";

export const LFX_API = "https://mentorship.linuxfoundation.org/api/programs";

export interface LfxTerm {
    id: string;
    name: string;
    status: string;
    startsAt: string;
    endsAt: string;
    applicationsStartAt: string;
    applicationsCloseAt: string;
}

export interface LfxProgram {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    skills?: string[] | null;
    status: string;
    foundation?: { name?: string | null; slug?: string | null } | null;
    isPaid?: boolean | null;
    repositoryUrl?: string | null;
    activeTerms?: LfxTerm[] | null;
    terms?: LfxTerm[] | null;
}

const day = (iso: string) => iso.slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "owner/repo" from a GitHub URL, else null. */
export function githubRepo(url: string | null | undefined): string | null {
    const m = (url ?? "").match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?]|$)/i);
    return m ? `${m[1]}/${m[2]}` : null;
}

/** LFX descriptions are often HTML: drop tags, decode the common entities. */
export function plainText(html: string): string {
    const ENT: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };
    return html
        .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, "")
        .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENT[m] ?? m)
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/\s+/g, " ")
        .trim();
}

function firstSentences(text: string, max = 200): string {
    const t = plainText(text);
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const dot = cut.lastIndexOf(". ");
    return dot > 60 ? cut.slice(0, dot + 1) : `${cut.trimEnd()}…`;
}

/** Projects accepting applications, each with its open term's dates. Pure. */
export function lfxFromApi(list: LfxProgram[], today: string): Program[] {
    const out: Program[] = [];
    for (const p of list) {
        if (p.status !== "acceptance") continue;
        const term = [...(p.activeTerms ?? []), ...(p.terms ?? [])]
            .find((t) => t.status === "open" && day(t.applicationsCloseAt) >= today);
        if (!term) continue;
        const skills = (p.skills ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
        const repo = githubRepo(p.repositoryUrl);
        out.push({
            id: `lfx-${p.slug}-${slug(term.name)}`,
            kind: "program",
            verification: "official",
            recurring: false,
            name: `${p.name} · LFX ${term.name}`,
            org: p.foundation?.name || p.name,
            url: `https://mentorship.linuxfoundation.org/programs/${p.id}`,
            summary: firstSentences(p.description ?? `${p.name} mentorship on LFX.`),
            tags: ["mentorship", "lfx", ...(p.isPaid ? ["paid"] : []), ...skills.slice(0, 6)],
            eligibility: "Anyone can apply; read the project's tasks and prerequisites first.",
            stipend: p.isPaid ? "Paid stipend" : null,
            rolling: false,
            phases: [
                { name: "Applications", kind: "application", start: day(term.applicationsStartAt), end: day(term.applicationsCloseAt) },
                { name: "Mentorship", kind: "work", start: day(term.startsAt), end: day(term.endsAt) },
            ],
            source: LFX_API,
            checkedAt: today,
            ...(repo ? { repo } : {}),
        });
    }
    return out;
}
