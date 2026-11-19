/**
 * Triage that works without AI (labels + keywords), plus a strict parser for
 * AI output so a malformed model reply can never be saved as a real verdict.
 */

export const CLASSIFICATIONS = [
    "CRITICAL_BUG", "BUG", "FEATURE_REQUEST", "QUESTION",
    "DOCS", "DUPLICATE", "NEEDS_INFO", "SPAM",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export interface TriageResult {
    classification: Classification;
    summary: string;
    suggestedLabel: string;
    confidence: number;
    source: "heuristic" | "ai";
    reasons: string[];
}

const LABEL_MAP: Array<[RegExp, Classification]> = [
    [/^(critical|p0|sev[- ]?[01]|security|regression|blocker)$/i, "CRITICAL_BUG"],
    [/^(type: ?)?(bug|defect|kind\/bug)$/i, "BUG"],
    [/^(type: ?)?(feature|enhancement|feature request|kind\/feature)$/i, "FEATURE_REQUEST"],
    [/^(type: ?)?(question|support|help)$/i, "QUESTION"],
    [/^(type: ?)?(docs?|documentation)$/i, "DOCS"],
    [/^(duplicate)$/i, "DUPLICATE"],
    [/^(needs[- ]info|more info needed|awaiting[- ]response|needs[- ]repro)$/i, "NEEDS_INFO"],
    [/^(spam|invalid)$/i, "SPAM"],
];

const KEYWORDS: Array<[RegExp, Classification, string]> = [
    [/\b(security|vulnerab|cve-\d|data loss|crash(es|ing)? on (start|launch)|production (is )?down|regression)\b/i, "CRITICAL_BUG", "mentions severe impact"],
    [/\b(error|exception|traceback|stack ?trace|crash|fails?|failing|broken|doesn'?t work|not working|unexpected|incorrect|wrong)\b/i, "BUG", "describes a failure"],
    [/\b(feature request|would be (nice|great)|it would be|add (an? )?(option|ability|support)|allow (users|us) to|proposal|enhancement)\b/i, "FEATURE_REQUEST", "asks for new behaviour"],
    [/\b(docs?|documentation|readme|typo|tutorial|example in the guide)\b/i, "DOCS", "about documentation"],
    [/^(how|what|why|is it possible|can i|does)\b|\?\s*$/i, "QUESTION", "phrased as a question"],
];

const SUGGESTED_LABEL: Record<Classification, string> = {
    CRITICAL_BUG: "critical",
    BUG: "bug",
    FEATURE_REQUEST: "enhancement",
    QUESTION: "question",
    DOCS: "documentation",
    DUPLICATE: "duplicate",
    NEEDS_INFO: "needs-info",
    SPAM: "invalid",
};

export function heuristicTriage(input: { title: string; body?: string | null; labels?: string[] }): TriageResult {
    const labels = input.labels ?? [];
    for (const label of labels) {
        for (const [re, cls] of LABEL_MAP) {
            if (re.test(label.trim())) {
                return {
                    classification: cls,
                    summary: input.title,
                    suggestedLabel: label,
                    confidence: 0.95,
                    source: "heuristic",
                    reasons: [`already labelled "${label}"`],
                };
            }
        }
    }

    const body = (input.body ?? "").trim();
    const text = `${input.title}\n${body.slice(0, 4000)}`;

    if (body.length < 30 && !/\?\s*$/.test(input.title)) {
        return {
            classification: "NEEDS_INFO",
            summary: input.title,
            suggestedLabel: SUGGESTED_LABEL.NEEDS_INFO,
            confidence: 0.6,
            source: "heuristic",
            reasons: ["description is nearly empty"],
        };
    }

    for (const [re, cls, why] of KEYWORDS) {
        // Questions are judged on the title only, to avoid every "?" in a body counting.
        const haystack = cls === "QUESTION" ? input.title : text;
        if (re.test(haystack)) {
            const reasons = [why];
            let confidence = cls === "CRITICAL_BUG" ? 0.6 : 0.55;
            if ((cls === "BUG" || cls === "CRITICAL_BUG") && /steps to reproduce|expected behaviou?r|actual behaviou?r/i.test(body)) {
                reasons.push("has reproduction steps");
                confidence += 0.15;
            } else if (cls === "BUG" && body.length < 200) {
                reasons.push("but has no reproduction details");
            }
            return {
                classification: cls,
                summary: input.title,
                suggestedLabel: SUGGESTED_LABEL[cls],
                confidence: Math.min(0.85, confidence),
                source: "heuristic",
                reasons,
            };
        }
    }

    return {
        classification: "NEEDS_INFO",
        summary: input.title,
        suggestedLabel: "needs-triage",
        confidence: 0.3,
        source: "heuristic",
        reasons: ["no clear signal"],
    };
}

/**
 * Pull the first JSON object out of a model reply (handles ```json fences and
 * prose around it). Returns null if nothing parseable is found.
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [fenced?.[1], text];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const start = candidate.indexOf("{");
        const end = candidate.lastIndexOf("}");
        if (start === -1 || end <= start) continue;
        try {
            const parsed = JSON.parse(candidate.slice(start, end + 1));
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
        } catch {
            // try next candidate
        }
    }
    return null;
}

/** Validate an AI reply; returns null if it isn't a usable verdict. */
export function parseAiTriage(text: string, fallbackTitle: string): TriageResult | null {
    const obj = extractJsonObject(text);
    if (!obj) return null;
    const cls = String(obj.classification ?? "").toUpperCase();
    if (!(CLASSIFICATIONS as readonly string[]).includes(cls)) return null;
    const conf = Number(obj.confidence);
    return {
        classification: cls as Classification,
        summary: typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim() : fallbackTitle,
        suggestedLabel: typeof obj.suggestedLabel === "string" && obj.suggestedLabel.trim()
            ? obj.suggestedLabel.trim()
            : SUGGESTED_LABEL[cls as Classification],
        confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
        source: "ai",
        reasons: ["AI classification"],
    };
}
