/**
 * Shared Types for AI Services
 *
 * Types used across QualityAssessmentService, EfficientRetrievalChain,
 * and BilingualModerationService.
 */

// ── Retrieval Types ──────────────────────────────────────────────────

export interface Document {
    id: string;
    content: string;
    metadata: DocumentMetadata;
}

export interface DocumentMetadata {
    source: "readme" | "contributing" | "issue" | "pr" | "review" | "code" | "docs";
    repo: string;
    title?: string;
    url?: string;
    filePath?: string;
    /** ISO timestamp */
    createdAt?: string;
}

export interface ScoredDocument extends Document {
    /** Combined retrieval score (BM25 + vector) */
    score: number;
    /** Individual scoring breakdown */
    scores: {
        bm25: number;
        vector: number;
        rerank: number;
    };
}

export interface RetrievalResult {
    query: string;
    documents: ScoredDocument[];
    totalCandidates: number;
    strategy: "bm25" | "vector" | "hybrid";
    timing: {
        retrievalMs: number;
        rerankMs: number;
        totalMs: number;
    };
}

// ── Quality Assessment Types ─────────────────────────────────────────

export interface BugRiskScore {
    overall: number; // 1-10
    breakdown: {
        complexity: number;     // 1-10  cyclomatic / cognitive complexity signals
        sensitivity: number;    // 1-10  auth, payments, security files
        changeVolume: number;   // 1-10  lines changed / files touched
        testCoverage: number;   // 1-10  inverse — high = no tests modified
        patternRisk: number;    // 1-10  known anti-patterns in diff
    };
    flags: string[];
    explanation: string;
}

export interface FileRiskProfile {
    filename: string;
    sensitivity: number;
    category: "critical" | "high" | "medium" | "low";
    reason: string;
}

export interface PRAnalysis {
    prNumber: number;
    bugRisk: BugRiskScore;
    verdict: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
    summary: string;
    issues: string[];
    suggestions: string[];
    security: string;
    fewShotContext: string[];
    linkedIssue?: {
        number: number;
        title: string;
        body: string;
    };
}

export interface PRSummary {
    prNumber: number;
    summary: string;
    linkedIssue?: {
        number: number;
        title: string;
        body: string;
    };
}

// ── Map-Reduce Types ─────────────────────────────────────────────────

export interface ChunkSummary {
    chunkIndex: number;
    filename: string;
    summary: string;
    issues: string[];
    riskSignals: string[];
}

export interface MapReduceResult {
    chunkSummaries: ChunkSummary[];
    finalSummary: string;
    totalChunks: number;
    strategy: "direct" | "map-reduce";
}

// ── Moderation Types ─────────────────────────────────────────────────

export interface ModerationResult {
    flagged: boolean;
    scores: {
        toxicity: number;
        profanity: number;
        threat: number;
        identity_attack: number;
    };
    language: "en" | "hi" | "hinglish" | "unknown";
    threshold: number;
    details: string;
    /** The specific toxic fragments detected */
    fragments: ToxicFragment[];
}

export interface ToxicFragment {
    text: string;
    score: number;
    category: string;
    start: number;
    end: number;
}

// ── LLM Call Types ───────────────────────────────────────────────────

export interface LLMCallOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
}

export const DEFAULT_MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-001",
    "arcee-ai/trinity-large-preview:free",
    "liquid/lfm-2.5-1.2b-thinking:free",
] as const;
