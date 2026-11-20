/** Small date helpers shared by adapters. All dates are UTC YYYY-MM-DD. */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** "Aug. 31, 2026", "March 8, 2027", "Nov 11, 2026" → "2026-08-31". */
export function parseHumanDate(s: string): string | null {
    const m = s.trim().match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    if (!m) return null;
    const mon = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon === undefined) return null;
    const d = new Date(Date.UTC(Number(m[3]), mon, Number(m[2])));
    return isNaN(d.getTime()) ? null : isoDay(d);
}

/** Shift a YYYY-MM-DD by whole years (Feb 29 → Feb 28). */
export function addYears(iso: string, years: number): string {
    const [y, m, d] = iso.split("-").map(Number);
    const out = new Date(Date.UTC(y + years, m - 1, d));
    if (out.getUTCMonth() !== m - 1) out.setUTCDate(0);
    return isoDay(out);
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
