/**
 * README badge: "OpenTriage | 8 starter issues · replies ~2d".
 * Shields-style flat SVG, no external fonts or images.
 */

export interface BadgeData {
    starterIssues: number | null;
    medianResponseDays: number | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
// Rough Verdana 11px width; good enough for a badge.
const width = (s: string) => Math.round([...s].reduce((w, c) => w + (/[ilj.,:|·]/.test(c) ? 3.5 : /[mwMW]/.test(c) ? 9.5 : /[A-Z0-9~]/.test(c) ? 7.5 : 6.5), 0)) + 12;

export function badgeText(d: BadgeData): { value: string; color: string } {
    const parts: string[] = [];
    if (d.starterIssues !== null) parts.push(`${d.starterIssues} starter issue${d.starterIssues === 1 ? "" : "s"}`);
    if (d.medianResponseDays !== null) parts.push(`replies ${d.medianResponseDays < 1 ? "<1d" : `~${Math.round(d.medianResponseDays)}d`}`);
    const value = parts.length ? parts.join(" · ") : "see repo";
    const color = d.starterIssues ? (d.medianResponseDays !== null && d.medianResponseDays > 14 ? "#d29922" : "#2ea043") : "#6e7681";
    return { value, color };
}

export function badgeSvg(d: BadgeData, label = "OpenTriage"): string {
    const { value, color } = badgeText(d);
    return svgBadge(label, value, color);
}

/** Context badge: "OpenTriage context | ready" (green), "basic" (amber), "none" (gray). */
export function contextBadgeSvg(level: "ready" | "basic" | "none" | "private"): string {
    const color = level === "ready" ? "#2ea043" : level === "basic" ? "#d29922" : "#6e7681";
    const value = level === "ready" ? "ready" : level === "basic" ? "basic" : level === "private" ? "private repo" : "not yet";
    return svgBadge("OpenTriage context", value, color);
}

/** Shields-style two-part badge. */
export function svgBadge(label: string, value: string, color: string): string {
    const lw = width(label);
    const vw = width(value);
    const w = lw + vw;
    const title = esc(`${label}: ${value}`);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${title}"><title>${title}</title>`
        + `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`
        + `<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>`
        + `<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#30363d"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/><rect width="${w}" height="20" fill="url(#s)"/></g>`
        + `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`
        + `<text x="${lw / 2}" y="14">${esc(label)}</text><text x="${lw + vw / 2}" y="14">${esc(value)}</text></g></svg>`;
}
