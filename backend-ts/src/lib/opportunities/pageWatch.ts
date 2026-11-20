/**
 * Weekly check of a program's official page: we keep the set of dates printed
 * on it. If that set changes, the program card says "dates on the official
 * page changed" so people check, instead of us guessing new dates.
 * Only dates are compared, so unrelated page edits don't raise false alarms.
 */
import { isoDay, parseHumanDate } from "./dates";

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";
const PATTERNS = [
    new RegExp(`\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+20\\d{2}\\b`, "gi"),   // March 8, 2027
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH},?\\s+20\\d{2}\\b`, "gi"),   // 8 March 2027
    /\b20\d{2}-\d{2}-\d{2}\b/g,                                                      // 2027-03-08
];

/** Sorted, de-duplicated YYYY-MM-DD dates found in the page text. */
export function datesOnPage(html: string): string[] {
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    const out = new Set<string>();
    for (const re of PATTERNS) {
        for (const m of text.match(re) ?? []) {
            const raw = m.replace(/(\d)(st|nd|rd|th)/i, "$1");
            const iso = /^\d{4}-/.test(raw) ? raw
                : parseHumanDate(raw) ?? parseHumanDate(raw.replace(/^(\d{1,2})\s+([A-Za-z.]+),?\s+(\d{4})$/, "$2 $1, $3"));
            if (iso && !Number.isNaN(Date.parse(iso))) out.add(iso);
        }
    }
    return [...out].sort();
}

export interface WatchState { pageDates?: string[]; pageCheckedAt?: string; datesChangedAt?: string | null }

export const WATCH_EVERY_DAYS = 7;

export function watchDue(prev: WatchState, today: string): boolean {
    if (!prev.pageCheckedAt) return true;
    return (Date.parse(today) - Date.parse(prev.pageCheckedAt)) / 86_400_000 >= WATCH_EVERY_DAYS;
}

/** New watch state after reading the page. First reading never counts as a change. */
export function nextWatch(prev: WatchState, found: string[], now: Date): WatchState {
    const today = isoDay(now);
    const changed = Boolean(prev.pageDates) && prev.pageDates!.join() !== found.join() && found.length > 0;
    return {
        pageDates: found.length ? found : prev.pageDates ?? [],
        pageCheckedAt: today,
        datesChangedAt: changed ? today : prev.datesChangedAt ?? null,
    };
}
