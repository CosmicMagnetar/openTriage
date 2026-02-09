/**
 * BilingualModerationService
 *
 * Threshold-based toxicity detection for English and Hindi/Hinglish
 * text. Designed for a maintainer hub where professionalism matters.
 *
 * Architecture:
 *   1. Language Detection — lightweight heuristic (Devanagari range +
 *      common Hinglish tokens) to classify text as en/hi/hinglish.
 *   2. Rule-Based Pre-Filter — fast regex pass catches obvious slurs
 *      and profanity in both languages before any LLM call.
 *   3. LLM-Based Scoring — for borderline cases, asks the LLM to
 *      score toxicity, profanity, threat, and identity_attack on a
 *      0.0-1.0 scale.
 *   4. Threshold Gate — flag only when ANY score > threshold (default
 *      0.85) to judge *intent*, not just surface words.
 *
 * This replaces the current placeholder (`alert('Feature coming soon')`)
 * in SentimentAlerts.jsx.
 */

import type { ModerationResult, ToxicFragment, LLMCallOptions } from "./types";
import { DEFAULT_MODELS } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1";

// ── Language Detection ───────────────────────────────────────────────

/** Unicode range for Devanagari script */
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

/** Common Hindi/Hinglish tokens that signal non-English */
const HINGLISH_MARKERS = new Set([
    "kya", "hai", "nahi", "hain", "tum", "mujhe", "yaar", "bhai",
    "accha", "theek", "abhi", "kaise", "matlab", "arre", "dekho",
    "chalo", "bohot", "bahut", "bilkul", "sahi", "galat", "kuch",
    "sabko", "karo", "karenge", "hoga", "toh", "lekin", "aur",
    "kyunki", "isliye", "waise", "achha", "bura", "agar", "jab",
]);

type DetectedLanguage = "en" | "hi" | "hinglish" | "unknown";

function detectLanguage(text: string): DetectedLanguage {
    const hasDevanagari = DEVANAGARI_REGEX.test(text);
    const words = text.toLowerCase().split(/\s+/);
    const hinglishCount = words.filter((w) => HINGLISH_MARKERS.has(w)).length;
    const hinglishRatio = words.length > 0 ? hinglishCount / words.length : 0;

    if (hasDevanagari && hinglishRatio > 0.1) return "hi";
    if (hasDevanagari) return "hi";
    if (hinglishRatio > 0.15) return "hinglish";
    if (hinglishRatio > 0.05) return "hinglish";
    if (words.length > 0) return "en";
    return "unknown";
}

// ── Rule-Based Pre-Filter ────────────────────────────────────────────

interface ToxicPattern {
    pattern: RegExp;
    category: string;
    score: number;
    language: "en" | "hi" | "both";
}

/**
 * Patterns for obvious toxicity. These catch the low-hanging fruit
 * before we burn an LLM call. Scores are conservative — a word
 * alone gets 0.7, context pushes it past threshold.
 */
const TOXIC_PATTERNS: ToxicPattern[] = [
    // English profanity / slurs
    { pattern: /\bf+u+c+k+\w*/gi, category: "profanity", score: 0.8, language: "en" },
    { pattern: /\bs+h+i+t+\w*/gi, category: "profanity", score: 0.7, language: "en" },
    { pattern: /\ba+s+s+h+o+l+e*/gi, category: "profanity", score: 0.8, language: "en" },
    { pattern: /\bb+i+t+c+h+\w*/gi, category: "profanity", score: 0.75, language: "en" },
    { pattern: /\bd+a+m+n+\w*/gi, category: "profanity", score: 0.5, language: "en" },
    { pattern: /\bstfu\b|\bgtfo\b|\bstfd\b/gi, category: "profanity", score: 0.8, language: "en" },
    { pattern: /\bkill\s+(your|him|her|them|myself)\w*/gi, category: "threat", score: 0.9, language: "en" },
    { pattern: /\bdie\b.*\bshould\b|\bshould\b.*\bdie\b/gi, category: "threat", score: 0.9, language: "en" },
    { pattern: /\bi['']?ll\s+(hurt|destroy|ruin)\b/gi, category: "threat", score: 0.85, language: "en" },
    { pattern: /\b(retard|idiot|moron|stupid|dumb)\w*/gi, category: "identity_attack", score: 0.65, language: "en" },

    // Hindi / Hinglish profanity (romanised and Devanagari)
    { pattern: /\b(madarchod|mc|bhenchod|bc|bhosdike|chutiya|gaandu|haramkhor|randi|saala|kamina|ullu)\w*/gi, category: "profanity", score: 0.85, language: "hi" },
    { pattern: /(मादरचोद|भेंचोद|चूतिया|गांडू|हरामखोर|रांडी|साला|कमीना)/g, category: "profanity", score: 0.9, language: "hi" },
    { pattern: /\b(maar\s*dunga|jaan\s*se\s*maar|kaat\s*dunga)\b/gi, category: "threat", score: 0.9, language: "hi" },
    { pattern: /(मार\s*दूंगा|जान\s*से\s*मार|काट\s*दूंगा)/g, category: "threat", score: 0.9, language: "hi" },
];

function runPreFilter(text: string): ToxicFragment[] {
    const fragments: ToxicFragment[] = [];
    for (const tp of TOXIC_PATTERNS) {
        let match: RegExpExecArray | null;
        // Reset lastIndex for global regexes
        tp.pattern.lastIndex = 0;
        while ((match = tp.pattern.exec(text)) !== null) {
            fragments.push({
                text: match[0],
                score: tp.score,
                category: tp.category,
                start: match.index,
                end: match.index + match[0].length,
            });
        }
    }
    return fragments;
}

// ── LLM-Based Scoring ───────────────────────────────────────────────

async function llmToxicityScore(
    text: string,
    language: DetectedLanguage,
    apiKey: string
): Promise<ModerationResult["scores"]> {
    const langHint =
        language === "hi"
            ? "The text is in Hindi (may use Devanagari script)."
            : language === "hinglish"
                ? "The text is in Hinglish (Hindi written in Latin script, mixed with English)."
                : "The text is in English.";

    try {
        const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: DEFAULT_MODELS[0],
                messages: [
                    {
                        role: "system",
                        content: `You are a content moderation classifier. ${langHint} Score the following text on four dimensions from 0.0 to 1.0. Output ONLY a JSON object with these exact keys: toxicity, profanity, threat, identity_attack. No explanation.`,
                    },
                    { role: "user", content: text.slice(0, 1500) },
                ],
                temperature: 0,
                max_tokens: 100,
            }),
        });

        if (!response.ok) {
            return { toxicity: 0, profanity: 0, threat: 0, identity_attack: 0 };
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content ?? "{}";
        const match = raw.match(/\{[\s\S]*?\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            return {
                toxicity: clamp(parsed.toxicity ?? 0),
                profanity: clamp(parsed.profanity ?? 0),
                threat: clamp(parsed.threat ?? 0),
                identity_attack: clamp(parsed.identity_attack ?? 0),
            };
        }
    } catch (err) {
        console.error("LLM toxicity scoring failed:", err);
    }

    return { toxicity: 0, profanity: 0, threat: 0, identity_attack: 0 };
}

function clamp(n: number): number {
    return Math.max(0, Math.min(1, Number(n) || 0));
}

// ── Public API ───────────────────────────────────────────────────────

export class BilingualModerationService {
    private apiKey: string;
    private threshold: number;

    /**
     * @param threshold   Flag content when ANY toxicity dimension exceeds
     *                    this value. Default 0.85 — high bar judges *intent*,
     *                    not surface words.
     * @param apiKey      OpenRouter API key. Falls back to env var.
     */
    constructor(threshold: number = 0.85, apiKey?: string) {
        this.threshold = threshold;
        this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    }

    /**
     * Moderate text using a two-stage pipeline:
     *   Stage 1 — Rule-based regex for obvious toxicity (fast, free)
     *   Stage 2 — LLM scoring for borderline cases (1 API call)
     *
     * Only calls the LLM if the pre-filter finds fragments OR if
     * `forceLLM` is true.
     */
    async moderate(
        text: string,
        options?: { forceLLM?: boolean }
    ): Promise<ModerationResult> {
        const language = detectLanguage(text);
        const fragments = runPreFilter(text);

        // Stage 1: rule-based check
        const maxRuleScore = fragments.reduce((m, f) => Math.max(m, f.score), 0);

        // If the pre-filter is very confident (>= threshold), flag immediately
        if (maxRuleScore >= this.threshold && !options?.forceLLM) {
            const scores: ModerationResult["scores"] = {
                toxicity: maxRuleScore,
                profanity: 0,
                threat: 0,
                identity_attack: 0,
            };
            // Map category to the right score key
            for (const f of fragments) {
                const key = f.category as keyof typeof scores;
                if (key in scores) {
                    scores[key] = Math.max(scores[key], f.score);
                }
            }

            return {
                flagged: true,
                scores,
                language,
                threshold: this.threshold,
                details: `Rule-based detection: ${fragments.length} toxic fragment(s) found.`,
                fragments,
            };
        }

        // Stage 2: LLM scoring (for borderline or when forced)
        if (fragments.length > 0 || options?.forceLLM) {
            const llmScores = await llmToxicityScore(text, language, this.apiKey);

            // Merge: take max of rule-based and LLM scores
            const finalScores: ModerationResult["scores"] = {
                toxicity: Math.max(
                    llmScores.toxicity,
                    fragments.filter((f) => f.category === "toxicity").reduce((m, f) => Math.max(m, f.score), 0)
                ),
                profanity: Math.max(
                    llmScores.profanity,
                    fragments.filter((f) => f.category === "profanity").reduce((m, f) => Math.max(m, f.score), 0)
                ),
                threat: Math.max(
                    llmScores.threat,
                    fragments.filter((f) => f.category === "threat").reduce((m, f) => Math.max(m, f.score), 0)
                ),
                identity_attack: Math.max(
                    llmScores.identity_attack,
                    fragments.filter((f) => f.category === "identity_attack").reduce((m, f) => Math.max(m, f.score), 0)
                ),
            };

            const flagged = Object.values(finalScores).some((s) => s > this.threshold);

            return {
                flagged,
                scores: finalScores,
                language,
                threshold: this.threshold,
                details: flagged
                    ? `Content flagged: ${Object.entries(finalScores).filter(([, s]) => s > this.threshold).map(([k, s]) => `${k}=${s.toFixed(2)}`).join(", ")} exceed threshold ${this.threshold}.`
                    : `Content within acceptable limits. Max score: ${Math.max(...Object.values(finalScores)).toFixed(2)}.`,
                fragments,
            };
        }

        // Clean text — no fragments, no LLM needed
        return {
            flagged: false,
            scores: { toxicity: 0, profanity: 0, threat: 0, identity_attack: 0 },
            language,
            threshold: this.threshold,
            details: "No toxic content detected.",
            fragments: [],
        };
    }

    /**
     * Batch moderate multiple texts (e.g. PR comments).
     * Returns results in order, with an aggregate flag.
     */
    async moderateBatch(
        texts: string[]
    ): Promise<{ results: ModerationResult[]; anyFlagged: boolean }> {
        const results = await Promise.all(
            texts.map((t) => this.moderate(t))
        );
        return {
            results,
            anyFlagged: results.some((r) => r.flagged),
        };
    }
}
