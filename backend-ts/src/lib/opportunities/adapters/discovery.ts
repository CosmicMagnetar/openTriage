/** Discovery only: program names + links from community lists. Never trusted for dates. */
import type { Program } from "@/lib/programs";
import { isoDay, slugify } from "../dates";

/** Markdown table rows like "| [Name](url) | Yes | [timeline](...) |". */
export function parseProgramTable(md: string): Array<{ name: string; url: string; paid: boolean | null }> {
    const out: Array<{ name: string; url: string; paid: boolean | null }> = [];
    for (const line of md.split("\n")) {
        const m = line.match(/^\|\s*\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\s*\|\s*([^|]*)\|/);
        if (!m) continue;
        const paid = /yes/i.test(m[3]) ? true : /no/i.test(m[3]) ? false : null;
        out.push({ name: m[1].trim(), url: m[2].trim(), paid });
    }
    return out;
}

export function discoveredProgram(name: string, url: string, paid: boolean | null): Program {
    return {
        id: `found-${slugify(name)}`,
        kind: "program",
        verification: "discovered",
        recurring: true,
        name,
        org: new URL(url).hostname.replace(/^www\./, ""),
        url,
        summary: "Found in a community list of open-source programs. Its page is live; check it for current dates.",
        tags: ["mentorship", ...(paid ? ["paid"] : [])],
        eligibility: "See the program page.",
        stipend: paid ? "Paid (see program page)" : null,
        rolling: true,
        phases: [],
        source: "https://github.com/tapaswenipathak/Open-Source-Programs",
        checkedAt: isoDay(new Date()),
    };
}
