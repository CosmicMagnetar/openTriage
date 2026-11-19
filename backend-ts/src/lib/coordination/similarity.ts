/**
 * Duplicate-effort detection without AI: token similarity between issues/PRs.
 * Used for "possible duplicate issue" and "someone already opened a similar PR".
 */

const STOPWORDS = new Set(
    ("a an and are as at be but by can do does for from has have how i if in into is it its " +
        "of on or should so that the their there this to was we what when where which while " +
        "will with would you your not no when after before error issue bug feature request " +
        "add support please fix using use")
        .split(" ")
);

export function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[^a-z0-9_.\-/ ]+/g, " ")
        .split(/\s+/)
        .map((t) => t.replace(/^[.\-/]+|[.\-/]+$/g, ""))
        .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function termSet(text: string): Set<string> {
    return new Set(tokenize(text));
}

/** Jaccard similarity of token sets, 0..1 */
export function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / (a.size + b.size - inter);
}

export interface SimilarityDoc {
    id: string | number;
    title: string;
    body?: string;
}

export interface SimilarMatch<T extends SimilarityDoc> {
    item: T;
    score: number;
    sharedTerms: string[];
}

/**
 * Title similarity weighs most (titles are short and specific); body adds support.
 * Returns matches above `threshold`, best first.
 */
export function findSimilar<T extends SimilarityDoc>(
    target: SimilarityDoc,
    candidates: T[],
    { threshold = 0.3, limit = 5 }: { threshold?: number; limit?: number } = {}
): SimilarMatch<T>[] {
    const tTitle = termSet(target.title);
    const tBody = termSet(`${target.title} ${(target.body ?? "").slice(0, 2000)}`);

    const matches: SimilarMatch<T>[] = [];
    for (const c of candidates) {
        if (c.id === target.id) continue;
        const cTitle = termSet(c.title);
        const cBody = termSet(`${c.title} ${(c.body ?? "").slice(0, 2000)}`);
        const score = 0.65 * jaccard(tTitle, cTitle) + 0.35 * jaccard(tBody, cBody);
        if (score >= threshold) {
            const shared = [...tTitle].filter((t) => cTitle.has(t));
            matches.push({ item: c, score: Math.round(score * 100) / 100, sharedTerms: shared.slice(0, 6) });
        }
    }
    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Extract search keywords for GitHub search from an issue (most specific first). */
export function keywords(text: string, max = 6): string[] {
    const counts = new Map<string, number>();
    for (const t of tokenize(text)) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()]
        // Prefer identifiers (paths, dotted names, snake/camel case) and repeated terms.
        .map(([t, n]) => [t, n + (/[._/]/.test(t) ? 2 : 0) + Math.min(t.length, 12) / 12] as const)
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([t]) => t);
}

/** File paths and code identifiers mentioned in free text (for "likely files"). */
export function extractCodeRefs(text: string): { paths: string[]; symbols: string[] } {
    const paths = new Set<string>();
    const symbols = new Set<string>();
    const pathRe = /(?:^|[\s`'"(])((?:[\w.-]+\/)+[\w.-]+\.[a-z0-9]{1,6})(?::\d+)?/gi;
    const symbolRe = /`([A-Za-z_][\w.]*(?:\(\))?)`/g;
    let m: RegExpExecArray | null;
    while ((m = pathRe.exec(text))) paths.add(m[1].replace(/^\.\//, ""));
    while ((m = symbolRe.exec(text))) {
        const s = m[1].replace(/\(\)$/, "");
        if (s.length > 2 && !s.includes("/")) symbols.add(s);
    }
    return { paths: [...paths].slice(0, 15), symbols: [...symbols].slice(0, 15) };
}
