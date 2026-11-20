/** confs.tech open data: conferences with open calls for talks (and diversity/travel help). */
import type { Program } from "@/lib/programs";
import { isoDay, slugify } from "../dates";

export interface Conf {
    name: string; url: string; startDate: string; endDate?: string; city?: string; country?: string;
    online?: boolean; cfpUrl?: string; cfpEndDate?: string; offersSignLanguageOrCC?: boolean;
}

export function confsToPrograms(list: Conf[], topic: string, today: string): Program[] {
    return list.filter((c) => c.cfpUrl && c.cfpEndDate && c.cfpEndDate >= today).map((c) => ({
        id: `cfp-${slugify(`${c.name}-${c.startDate}`)}`,
        kind: "cfp" as const,
        verification: "official" as const,
        recurring: false,
        name: `${c.name}: call for talks`,
        org: c.name,
        url: c.cfpUrl!,
        summary: `Speak at ${c.name} (${c.online ? "online" : [c.city, c.country].filter(Boolean).join(", ")}, ${c.startDate}). Talking about your open-source work is a contribution too.`,
        tags: ["talks", topic, ...(c.online ? ["remote"] : [])],
        eligibility: "Anyone can submit a talk proposal.",
        stipend: null,
        rolling: false,
        phases: [
            { name: "Talk proposals", kind: "application" as const, start: today, end: c.cfpEndDate! },
            { name: "Conference", kind: "event" as const, start: c.startDate, end: c.endDate ?? c.startDate },
        ],
        source: "https://confs.tech/",
        checkedAt: isoDay(new Date()),
    }));
}
