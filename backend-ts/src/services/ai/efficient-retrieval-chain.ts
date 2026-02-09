/**
 * EfficientRetrievalChain
 *
 * A hybrid retrieval pipeline that combines:
 *   1. BM25 keyword search  — exact function / variable names
 *   2. Vector (semantic) search via OpenRouter embeddings
 *   3. FlashRank-style cross-encoder re-ranking
 *   4. Map-Reduce summarisation for diffs that exceed the context window
 *
 * All heavy LLM work is routed through OpenRouter (same provider the
 * rest of OpenTriage already uses) so there are zero new API keys.
 */

import type {
    Document,
    ScoredDocument,
    RetrievalResult,
    ChunkSummary,
    MapReduceResult,
    LLMCallOptions,
} from "./types";
import { DEFAULT_MODELS } from "./types";

// ── BM25 Implementation ─────────────────────────────────────────────

/** Stop-words stripped before BM25 scoring */
const STOP_WORDS = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "must", "can", "could", "in", "on", "at",
    "to", "for", "of", "with", "by", "from", "as", "into", "through",
    "and", "but", "or", "nor", "not", "no", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more", "most",
    "this", "that", "these", "those", "i", "me", "my", "we", "our",
    "you", "your", "he", "him", "his", "she", "her", "it", "its",
    "they", "them", "their", "what", "which", "who", "whom", "how",
    "when", "where", "why",
]);

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9_.\-/]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Okapi BM25 scorer with tuneable k1 and b parameters.
 *
 * Unlike our earlier raw-TF×IDF, BM25 penalises very long documents
 * (via `b`) and saturates term frequency (via `k1`).
 */
class BM25Index {
    private k1 = 1.5;
    private b = 0.75;
    private avgDL = 0;
    private docs: { tokens: string[]; id: string }[] = [];
    /** term → Set<docIndex> */
    private invertedIndex = new Map<string, Set<number>>();
    /** term → document frequency */
    private df = new Map<string, number>();
    private N = 0;

    constructor(documents: Document[]) {
        this.index(documents);
    }

    private index(documents: Document[]) {
        let totalLength = 0;
        this.N = documents.length;

        for (let i = 0; i < documents.length; i++) {
            const tokens = tokenize(
                `${documents[i].metadata.title ?? ""} ${documents[i].content}`
            );
            this.docs.push({ tokens, id: documents[i].id });
            totalLength += tokens.length;

            const seen = new Set<string>();
            for (const token of tokens) {
                if (!this.invertedIndex.has(token)) {
                    this.invertedIndex.set(token, new Set());
                }
                this.invertedIndex.get(token)!.add(i);
                if (!seen.has(token)) {
                    this.df.set(token, (this.df.get(token) ?? 0) + 1);
                    seen.add(token);
                }
            }
        }
        this.avgDL = this.N > 0 ? totalLength / this.N : 1;
    }

    /**
     * Score every document against `query` and return the top `k`.
     */
    search(query: string, k: number): { id: string; score: number }[] {
        const queryTokens = tokenize(query);
        const scores = new Map<number, number>();

        for (const qt of queryTokens) {
            const docSet = this.invertedIndex.get(qt);
            if (!docSet) continue;

            const dfVal = this.df.get(qt) ?? 0;
            // IDF with floor of 0 to avoid negatives for very common terms
            const idf = Math.max(
                0,
                Math.log((this.N - dfVal + 0.5) / (dfVal + 0.5) + 1)
            );

            for (const docIdx of docSet) {
                const doc = this.docs[docIdx];
                const tf = doc.tokens.filter((t) => t === qt).length;
                const dl = doc.tokens.length;
                const tfNorm =
                    (tf * (this.k1 + 1)) /
                    (tf + this.k1 * (1 - this.b + this.b * (dl / this.avgDL)));
                const score = idf * tfNorm;
                scores.set(docIdx, (scores.get(docIdx) ?? 0) + score);
            }
        }

        return Array.from(scores.entries())
            .map(([idx, score]) => ({ id: this.docs[idx].id, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, k);
    }
}

// ── Vector (Semantic) Search ─────────────────────────────────────────

const OPENROUTER_URL = "https://openrouter.ai/api/v1";

/**
 * Compute a lightweight embedding via OpenRouter's chat completion API.
 *
 * We ask the LLM to produce a fixed-length numeric vector in JSON.
 * This is a pragmatic "poor-man's embeddings" that avoids adding a
 * dedicated embedding provider while still giving sememic similarity.
 *
 * For production, swap this for a real embedding model (e.g. text-embedding-3-small).
 */
async function computeEmbedding(
    text: string,
    apiKey: string,
    dims: number = 64
): Promise<number[]> {
    try {
        const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.3-70b-instruct:free",
                messages: [
                    {
                        role: "system",
                        content: `You are an embedding encoder. Given text, output ONLY a JSON array of exactly ${dims} floating point numbers between -1 and 1 that represent the semantic meaning. No explanation, just the array.`,
                    },
                    { role: "user", content: text.slice(0, 1000) },
                ],
                temperature: 0,
                max_tokens: dims * 8,
            }),
        });

        if (!response.ok) {
            console.warn(`Embedding API returned ${response.status}, falling back to zero vector`);
            return new Array(dims).fill(0);
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content ?? "[]";
        const match = raw.match(/\[[\s\S]*?\]/);
        if (match) {
            const vec = JSON.parse(match[0]) as number[];
            if (vec.length === dims) return vec;
        }
    } catch (err) {
        console.error("Embedding computation failed:", err);
    }
    return new Array(dims).fill(0);
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

// ── FlashRank-style Re-Ranker ────────────────────────────────────────

/**
 * Cross-encoder re-ranking via an LLM judge.
 *
 * Rather than importing a separate model, we use the same OpenRouter
 * free-tier LLM to score each (query, document) pair on a 0-10 scale.
 * This is architecturally equivalent to a cross-encoder — the LLM sees
 * both inputs simultaneously and judges relevance.
 */
async function flashRankRerank(
    query: string,
    candidates: { id: string; content: string; score: number }[],
    apiKey: string,
    topK: number = 5
): Promise<{ id: string; score: number }[]> {
    // Build a single prompt that scores all candidates at once (efficient)
    const candidateList = candidates
        .slice(0, 20)
        .map(
            (c, i) =>
                `[${i}] ${c.content.slice(0, 300)}`
        )
        .join("\n\n");

    try {
        const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.3-70b-instruct:free",
                messages: [
                    {
                        role: "system",
                        content: `You are a relevance judge. Given a QUERY and numbered CANDIDATES, score each candidate's relevance to the query from 0.0 to 1.0. Output ONLY a JSON array of objects: [{"idx": 0, "score": 0.95}, ...]. No explanation.`,
                    },
                    {
                        role: "user",
                        content: `QUERY: ${query}\n\nCANDIDATES:\n${candidateList}`,
                    },
                ],
                temperature: 0,
                max_tokens: 800,
            }),
        });

        if (!response.ok) {
            console.warn(`Rerank API returned ${response.status}, using original scores`);
            return candidates.slice(0, topK).map((c) => ({ id: c.id, score: c.score }));
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content ?? "[]";
        const match = raw.match(/\[[\s\S]*?\]/);
        if (match) {
            const ranked = JSON.parse(match[0]) as { idx: number; score: number }[];
            return ranked
                .filter((r) => r.idx >= 0 && r.idx < candidates.length)
                .sort((a, b) => b.score - a.score)
                .slice(0, topK)
                .map((r) => ({
                    id: candidates[r.idx].id,
                    score: r.score,
                }));
        }
    } catch (err) {
        console.error("Rerank failed, using original scores:", err);
    }

    // Fallback: just keep original order
    return candidates.slice(0, topK).map((c) => ({ id: c.id, score: c.score }));
}

// ── Map-Reduce for Long Diffs ────────────────────────────────────────

/** ~4 000 tokens ≈ 16 000 chars is a safe single-pass limit */
const CHUNK_CHAR_LIMIT = 16_000;

function chunkDiff(diff: string, maxChars: number = CHUNK_CHAR_LIMIT): string[] {
    if (diff.length <= maxChars) return [diff];

    const chunks: string[] = [];
    const lines = diff.split("\n");
    let current = "";

    for (const line of lines) {
        if (current.length + line.length + 1 > maxChars && current.length > 0) {
            chunks.push(current);
            current = "";
        }
        current += (current ? "\n" : "") + line;
    }
    if (current) chunks.push(current);
    return chunks;
}

async function llmCall(
    prompt: string,
    apiKey: string,
    opts: LLMCallOptions = {}
): Promise<string> {
    const model = opts.model ?? DEFAULT_MODELS[0];
    const body = {
        model,
        messages: [
            { role: "system" as const, content: opts.systemPrompt ?? "You are a helpful assistant." },
            { role: "user" as const, content: prompt },
        ],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1000,
    };

    for (const tryModel of [model, ...DEFAULT_MODELS.slice(1)]) {
        try {
            const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ ...body, model: tryModel }),
            });

            if (!response.ok) continue;
            const data = await response.json();
            return data.choices?.[0]?.message?.content ?? "";
        } catch {
            continue;
        }
    }
    return "";
}

// ── Public API ───────────────────────────────────────────────────────

export class EfficientRetrievalChain {
    private apiKey: string;
    private embeddingCache = new Map<string, number[]>();

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    }

    // ── Hybrid Search ────────────────────────────────────────────────

    /**
     * Hybrid retrieve: BM25 (top 20) ∪ Vector (top 20) → deduplicate →
     * merge scores with α weighting → FlashRank re-rank → top K.
     *
     * @param query      Natural-language query
     * @param documents  Corpus of documents to search
     * @param topK       Final number of results after re-ranking (default 5)
     * @param alpha      Weight for BM25 vs vector: 0 = pure vector, 1 = pure BM25 (default 0.5)
     */
    async hybridSearch(
        query: string,
        documents: Document[],
        topK: number = 5,
        alpha: number = 0.5
    ): Promise<RetrievalResult> {
        const t0 = Date.now();

        // ── Stage 1: BM25 keyword retrieval ──
        const bm25 = new BM25Index(documents);
        const bm25Hits = bm25.search(query, 20);

        // ── Stage 2: Vector semantic retrieval ──
        const queryEmbedding = await this.getEmbedding(query);
        const vectorScores: { id: string; score: number }[] = [];

        for (const doc of documents) {
            const docEmbedding = await this.getEmbedding(
                `${doc.metadata.title ?? ""} ${doc.content.slice(0, 500)}`
            );
            const sim = cosineSimilarity(queryEmbedding, docEmbedding);
            vectorScores.push({ id: doc.id, score: sim });
        }
        vectorScores.sort((a, b) => b.score - a.score);
        const vectorHits = vectorScores.slice(0, 20);

        const tRetrieval = Date.now();

        // ── Stage 3: Merge & normalise ──
        const maxBM25 = Math.max(...bm25Hits.map((h) => h.score), 1e-9);
        const maxVec = Math.max(...vectorHits.map((h) => h.score), 1e-9);

        const merged = new Map<string, { bm25: number; vector: number }>();
        for (const h of bm25Hits) {
            merged.set(h.id, { bm25: h.score / maxBM25, vector: 0 });
        }
        for (const h of vectorHits) {
            const existing = merged.get(h.id) ?? { bm25: 0, vector: 0 };
            existing.vector = h.score / maxVec;
            merged.set(h.id, existing);
        }

        const candidates = Array.from(merged.entries())
            .map(([id, s]) => ({
                id,
                content: documents.find((d) => d.id === id)?.content ?? "",
                score: alpha * s.bm25 + (1 - alpha) * s.vector,
                bm25: s.bm25,
                vector: s.vector,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 20);

        // ── Stage 4: FlashRank re-ranking ──
        const reranked = await flashRankRerank(query, candidates, this.apiKey, topK);
        const tRerank = Date.now();

        // ── Assemble final results ──
        const docMap = new Map(documents.map((d) => [d.id, d]));
        const scoredDocs: ScoredDocument[] = reranked.map((r) => {
            const doc = docMap.get(r.id)!;
            const cand = candidates.find((c) => c.id === r.id);
            return {
                ...doc,
                score: r.score,
                scores: {
                    bm25: cand?.bm25 ?? 0,
                    vector: cand?.vector ?? 0,
                    rerank: r.score,
                },
            };
        });

        return {
            query,
            documents: scoredDocs,
            totalCandidates: merged.size,
            strategy: "hybrid",
            timing: {
                retrievalMs: tRetrieval - t0,
                rerankMs: tRerank - tRetrieval,
                totalMs: tRerank - t0,
            },
        };
    }

    // ── Map-Reduce for Large Diffs ───────────────────────────────────

    /**
     * If a diff exceeds ~4 000 tokens, chunk it, summarise each chunk
     * independently (Map), then combine summaries into a final review
     * (Reduce). This ensures no information is silently dropped.
     */
    async mapReduceDiff(
        diff: string,
        prTitle: string,
        prBody: string
    ): Promise<MapReduceResult> {
        const chunks = chunkDiff(diff);

        if (chunks.length <= 1) {
            return {
                chunkSummaries: [],
                finalSummary: diff,
                totalChunks: 1,
                strategy: "direct",
            };
        }

        // ── Map phase: summarise each chunk ──
        const chunkSummaries: ChunkSummary[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const result = await llmCall(
                `You are reviewing part ${i + 1}/${chunks.length} of a PR diff for "${prTitle}".

PR description: ${prBody?.slice(0, 500) || "None"}

DIFF CHUNK:
\`\`\`
${chunks[i]}
\`\`\`

Respond with ONLY a JSON object:
{
  "filename": "primary file in this chunk",
  "summary": "what this chunk changes in 2-3 sentences",
  "issues": ["potential issue 1", ...],
  "riskSignals": ["signal 1", ...]
}`,
                this.apiKey,
                {
                    systemPrompt:
                        "You are a senior code reviewer. Analyze diff chunks and output structured JSON only.",
                    maxTokens: 500,
                    temperature: 0.2,
                }
            );

            try {
                const jsonMatch = result.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    chunkSummaries.push({
                        chunkIndex: i,
                        filename: parsed.filename ?? `chunk_${i}`,
                        summary: parsed.summary ?? "",
                        issues: parsed.issues ?? [],
                        riskSignals: parsed.riskSignals ?? [],
                    });
                    continue;
                }
            } catch { /* parse failed, continue */ }

            chunkSummaries.push({
                chunkIndex: i,
                filename: `chunk_${i}`,
                summary: result.slice(0, 300),
                issues: [],
                riskSignals: [],
            });
        }

        // ── Reduce phase: combine chunk summaries ──
        const combinedContext = chunkSummaries
            .map(
                (cs) =>
                    `[${cs.filename}] ${cs.summary}\n  Issues: ${cs.issues.join("; ") || "none"}\n  Risks: ${cs.riskSignals.join("; ") || "none"}`
            )
            .join("\n\n");

        const finalSummary = await llmCall(
            `You are compiling a final code review from individual chunk analyses.

PR: "${prTitle}"
Description: ${prBody?.slice(0, 500) || "None"}

CHUNK ANALYSES:
${combinedContext}

Write a comprehensive review that:
1. Summarises the overall change
2. Lists all issues found across chunks (deduplicated)
3. Highlights the highest-risk areas
4. Provides a final verdict (APPROVE / REQUEST_CHANGES / COMMENT)

Be specific and actionable.`,
            this.apiKey,
            {
                systemPrompt: "You are a senior staff engineer writing a final PR review.",
                maxTokens: 1500,
                temperature: 0.3,
            }
        );

        return {
            chunkSummaries,
            finalSummary,
            totalChunks: chunks.length,
            strategy: "map-reduce",
        };
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private async getEmbedding(text: string): Promise<number[]> {
        const cacheKey = text.slice(0, 200);
        if (this.embeddingCache.has(cacheKey)) {
            return this.embeddingCache.get(cacheKey)!;
        }
        const embedding = await computeEmbedding(text, this.apiKey);
        this.embeddingCache.set(cacheKey, embedding);
        return embedding;
    }

    /** Expose llmCall for other services */
    async callLLM(prompt: string, opts?: LLMCallOptions): Promise<string> {
        return llmCall(prompt, this.apiKey, opts);
    }

    /** Expose chunkDiff for external use */
    static chunkDiff = chunkDiff;
}
