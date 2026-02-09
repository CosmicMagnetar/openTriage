/**
 * QualityAssessmentService
 *
 * Provides:
 *   1. Bug Risk Scoring — static heuristic score (1-10) computed from
 *      file sensitivity, change volume, complexity signals, and test
 *      coverage indicators in the diff.
 *   2. Few-Shot PR Review — fetches the 3 most relevant past reviews
 *      from the retrieval chain to inject as examples before generating
 *      a new review.
 *   3. Linked Issue Cross-Referencing — resolves issue references
 *      (#NNN) in the PR body and injects the issue context into the
 *      review prompt.
 *
 * All LLM calls go through OpenRouter via EfficientRetrievalChain.callLLM().
 */

import { Octokit } from "@octokit/rest";
import { EfficientRetrievalChain } from "./efficient-retrieval-chain";
import type {
    BugRiskScore,
    FileRiskProfile,
    PRAnalysis,
    PRSummary,
    Document,
    ScoredDocument,
} from "./types";

// ── File Sensitivity Patterns ────────────────────────────────────────

interface SensitivityPattern {
    pattern: RegExp;
    sensitivity: number;
    category: FileRiskProfile["category"];
    reason: string;
}

const SENSITIVITY_PATTERNS: SensitivityPattern[] = [
    // Critical — auth, secrets, payments, infra
    { pattern: /auth|token|secret|credential|password|jwt|oauth/i, sensitivity: 10, category: "critical", reason: "Authentication / secrets" },
    { pattern: /payment|billing|stripe|checkout|invoice/i, sensitivity: 10, category: "critical", reason: "Payment processing" },
    { pattern: /\.env|docker-compose|Dockerfile|k8s|helm/i, sensitivity: 9, category: "critical", reason: "Infrastructure / deployment" },
    { pattern: /migration|schema\.prisma|drizzle.*schema/i, sensitivity: 9, category: "critical", reason: "Database schema migration" },
    { pattern: /middleware|route\.ts|api\//i, sensitivity: 8, category: "critical", reason: "API route / middleware" },

    // High — security, data access
    { pattern: /security|crypto|encrypt|decrypt|hash/i, sensitivity: 8, category: "high", reason: "Security / cryptography" },
    { pattern: /model|schema|entity|repository/i, sensitivity: 7, category: "high", reason: "Data model" },
    { pattern: /service|controller/i, sensitivity: 7, category: "high", reason: "Business logic" },
    { pattern: /config|settings/i, sensitivity: 6, category: "high", reason: "Configuration" },

    // Medium — core application
    { pattern: /component|page|view|layout/i, sensitivity: 5, category: "medium", reason: "UI component" },
    { pattern: /hook|store|context|provider/i, sensitivity: 5, category: "medium", reason: "State management" },
    { pattern: /util|helper|lib/i, sensitivity: 4, category: "medium", reason: "Utility" },

    // Low — docs, tests, config
    { pattern: /test|spec|__test__|\.test\.|\.spec\./i, sensitivity: 2, category: "low", reason: "Test file" },
    { pattern: /readme|changelog|license|\.md$/i, sensitivity: 1, category: "low", reason: "Documentation" },
    { pattern: /\.css|\.scss|\.less|tailwind/i, sensitivity: 2, category: "low", reason: "Styling" },
];

// ── Complexity Signals in Diffs ──────────────────────────────────────

interface ComplexitySignal {
    pattern: RegExp;
    weight: number;
    label: string;
}

const COMPLEXITY_SIGNALS: ComplexitySignal[] = [
    { pattern: /if\s*\(|else\s*{|switch\s*\(|case\s+/g, weight: 1, label: "branching" },
    { pattern: /try\s*{|catch\s*\(|\.catch\s*\(/g, weight: 1.5, label: "error handling" },
    { pattern: /await\s+|\.then\s*\(|Promise\.|async\s+/g, weight: 1.2, label: "async operations" },
    { pattern: /eval\s*\(|Function\s*\(|innerHTML|dangerouslySetInnerHTML/g, weight: 3, label: "unsafe patterns" },
    { pattern: /TODO|FIXME|HACK|XXX|WORKAROUND/g, weight: 1.5, label: "tech debt markers" },
    { pattern: /console\.log|debugger|alert\s*\(/g, weight: 0.8, label: "debug artifacts" },
    { pattern: /process\.env|import\.meta\.env/g, weight: 1, label: "environment access" },
    { pattern: /\.query\(|\.execute\(|\.raw\(|sql`/g, weight: 2, label: "raw SQL" },
    { pattern: /\bany\b.*[:=]|as\s+any\b|@ts-ignore|@ts-expect-error/g, weight: 1.5, label: "type escape hatches" },
    { pattern: /new\s+RegExp|\.replace\(\/|\.match\(\/|\.exec\(/g, weight: 0.5, label: "regex operations" },
];

// ── Anti-Pattern Flags ───────────────────────────────────────────────

const ANTI_PATTERNS: { pattern: RegExp; flag: string }[] = [
    { pattern: /console\.log|debugger\b/g, flag: "Debug statements left in code" },
    { pattern: /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/g, flag: "Unresolved TODO/FIXME markers" },
    { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g, flag: "Empty catch block swallows errors" },
    { pattern: /as\s+any\b|:\s*any\b/g, flag: "TypeScript `any` type usage" },
    { pattern: /@ts-ignore|@ts-expect-error/g, flag: "TypeScript error suppression" },
    { pattern: /eval\s*\(|new\s+Function\s*\(/g, flag: "Dynamic code execution (eval/Function)" },
    { pattern: /innerHTML\s*=|dangerouslySetInnerHTML/g, flag: "Raw HTML injection risk (XSS)" },
    { pattern: /password|secret|api_key|apikey/i, flag: "Possible hardcoded credential" },
    { pattern: /setTimeout\(\s*function|setInterval\(\s*function/g, flag: "Non-arrow function in timer (possible this-binding bug)" },
    { pattern: /\.then\(.*\.then\(/g, flag: "Nested .then() chains — consider async/await" },
];

// ── QualityAssessmentService ─────────────────────────────────────────

export class QualityAssessmentService {
    private chain: EfficientRetrievalChain;

    constructor(chain?: EfficientRetrievalChain) {
        this.chain = chain ?? new EfficientRetrievalChain();
    }

    // ── Bug Risk Scoring ─────────────────────────────────────────────

    /**
     * Compute a deterministic Bug Risk Score (1-10) from the diff and
     * file list.  This is a pure heuristic — no LLM call required.
     *
     * Breakdown:
     *   complexity   — cognitive complexity signals in the diff
     *   sensitivity  — how critical the touched files are
     *   changeVolume — total additions + deletions + file count
     *   testCoverage — inverse signal: did the PR touch tests?
     *   patternRisk  — known anti-patterns detected in the diff
     */
    computeBugRisk(
        files: { filename: string; additions: number; deletions: number; patch?: string }[],
        diff: string
    ): BugRiskScore {
        // ── 1. Complexity ──
        let complexityRaw = 0;
        for (const signal of COMPLEXITY_SIGNALS) {
            const matches = diff.match(signal.pattern);
            if (matches) complexityRaw += matches.length * signal.weight;
        }
        // Normalise: 0 → 1, 50+ → 10
        const complexity = Math.min(10, Math.round(1 + (complexityRaw / 50) * 9));

        // ── 2. Sensitivity ──
        const fileProfiles = this.profileFiles(files);
        const maxSensitivity = fileProfiles.reduce((m, f) => Math.max(m, f.sensitivity), 1);
        const avgSensitivity =
            fileProfiles.reduce((s, f) => s + f.sensitivity, 0) /
            Math.max(fileProfiles.length, 1);
        // Weighted: 60 % max + 40 % avg
        const sensitivity = Math.min(
            10,
            Math.round(maxSensitivity * 0.6 + avgSensitivity * 0.4)
        );

        // ── 3. Change Volume ──
        const totalAdd = files.reduce((s, f) => s + f.additions, 0);
        const totalDel = files.reduce((s, f) => s + f.deletions, 0);
        const totalLines = totalAdd + totalDel;
        const fileCount = files.length;
        // Normalise: ≤10 lines in 1 file → 1, ≥500 lines or ≥20 files → 10
        const volumeScore = Math.min(
            10,
            Math.round(1 + ((totalLines / 500) * 5 + (fileCount / 20) * 4))
        );

        // ── 4. Test Coverage (inverse) ──
        const testFiles = files.filter((f) =>
            /test|spec|__test__|\.test\.|\.spec\./i.test(f.filename)
        );
        const hasTests = testFiles.length > 0;
        const testRatio = fileCount > 0 ? testFiles.length / fileCount : 0;
        // High score = bad (no tests)
        const testCoverage = hasTests
            ? Math.max(1, Math.round(10 - testRatio * 20))
            : 8;

        // ── 5. Pattern Risk ──
        const flags: string[] = [];
        let patternCount = 0;
        for (const ap of ANTI_PATTERNS) {
            const matches = diff.match(ap.pattern);
            if (matches && matches.length > 0) {
                flags.push(`${ap.flag} (×${matches.length})`);
                patternCount += matches.length;
            }
        }
        const patternRisk = Math.min(10, Math.round(1 + (patternCount / 10) * 9));

        // ── Overall (weighted average) ──
        const overall = Math.min(
            10,
            Math.max(
                1,
                Math.round(
                    complexity * 0.25 +
                    sensitivity * 0.25 +
                    volumeScore * 0.15 +
                    testCoverage * 0.15 +
                    patternRisk * 0.20
                )
            )
        );

        const explanation = this.buildRiskExplanation(
            overall,
            { complexity, sensitivity, changeVolume: volumeScore, testCoverage, patternRisk },
            flags,
            fileProfiles
        );

        return {
            overall,
            breakdown: {
                complexity,
                sensitivity,
                changeVolume: volumeScore,
                testCoverage,
                patternRisk,
            },
            flags,
            explanation,
        };
    }

    /** Classify each file by sensitivity */
    private profileFiles(
        files: { filename: string; additions: number; deletions: number }[]
    ): FileRiskProfile[] {
        return files.map((f) => {
            for (const sp of SENSITIVITY_PATTERNS) {
                if (sp.pattern.test(f.filename)) {
                    return {
                        filename: f.filename,
                        sensitivity: sp.sensitivity,
                        category: sp.category,
                        reason: sp.reason,
                    };
                }
            }
            return {
                filename: f.filename,
                sensitivity: 3,
                category: "medium" as const,
                reason: "General source file",
            };
        });
    }

    private buildRiskExplanation(
        overall: number,
        breakdown: BugRiskScore["breakdown"],
        flags: string[],
        profiles: FileRiskProfile[]
    ): string {
        const level =
            overall <= 3 ? "LOW" : overall <= 6 ? "MEDIUM" : overall <= 8 ? "HIGH" : "CRITICAL";

        const criticalFiles = profiles
            .filter((p) => p.category === "critical")
            .map((p) => p.filename);

        let explanation = `Risk ${level} (${overall}/10). `;
        explanation += `Complexity ${breakdown.complexity}/10, Sensitivity ${breakdown.sensitivity}/10, Volume ${breakdown.changeVolume}/10, Test gap ${breakdown.testCoverage}/10, Anti-patterns ${breakdown.patternRisk}/10.`;

        if (criticalFiles.length > 0) {
            explanation += ` Critical files touched: ${criticalFiles.slice(0, 5).join(", ")}.`;
        }
        if (flags.length > 0) {
            explanation += ` Flags: ${flags.slice(0, 5).join("; ")}.`;
        }
        return explanation;
    }

    // ── Few-Shot PR Review ───────────────────────────────────────────

    /**
     * Generate a PR review using few-shot examples from past reviews.
     *
     * Flow:
     *   1. Fetch the actual diff from GitHub
     *   2. Compute bug risk score (pure heuristic)
     *   3. Resolve linked issue (#NNN) from PR body
     *   4. Retrieve 3 similar past reviews via hybrid search
     *   5. Build a prompt with few-shot examples + full context
     *   6. If diff > context window, use map-reduce first
     *   7. Send to LLM → parse structured response
     */
    async analyzePR(
        octokit: Octokit,
        owner: string,
        repo: string,
        prNumber: number,
        pastReviews?: Document[]
    ): Promise<PRAnalysis> {
        // ── Fetch PR data ──
        const { data: pr } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        const { data: files } = await octokit.pulls.listFiles({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 50,
        });

        // ── Fetch actual diff ──
        let diff = "";
        try {
            const diffResponse = await octokit.pulls.get({
                owner,
                repo,
                pull_number: prNumber,
                mediaType: { format: "diff" },
            });
            diff = diffResponse.data as unknown as string;
        } catch {
            // Fallback: build diff from patches
            diff = files
                .filter((f) => f.patch)
                .map((f) => `--- ${f.filename}\n${f.patch}`)
                .join("\n\n");
        }

        // ── Compute bug risk (heuristic, no LLM) ──
        const bugRisk = this.computeBugRisk(files, diff);

        // ── Resolve linked issue ──
        const linkedIssue = await this.resolveLinkedIssue(
            octokit, owner, repo, pr.body ?? ""
        );

        // ── Few-shot: retrieve 3 past reviews ──
        let fewShotContext: string[] = [];
        if (pastReviews && pastReviews.length > 0) {
            const retrieval = await this.chain.hybridSearch(
                `PR review for: ${pr.title} - ${files.slice(0, 5).map((f) => f.filename).join(", ")}`,
                pastReviews,
                3,
                0.6 // Slightly favour BM25 for code identifiers
            );
            fewShotContext = retrieval.documents.map(
                (d: ScoredDocument) =>
                    `--- EXAMPLE REVIEW (relevance: ${d.score.toFixed(2)}) ---\n${d.content.slice(0, 800)}`
            );
        }

        // ── Handle large diffs via map-reduce ──
        let diffContext: string;
        let mapReduceUsed = false;

        if (diff.length > 16_000) {
            const mr = await this.chain.mapReduceDiff(diff, pr.title, pr.body ?? "");
            diffContext = mr.finalSummary;
            mapReduceUsed = true;
        } else {
            diffContext = diff;
        }

        // ── Build the prompt ──
        const filesSummary = files
            .slice(0, 20)
            .map((f) => `  ${f.filename} (+${f.additions}/-${f.deletions}) [${f.status}]`)
            .join("\n");

        const fewShotSection =
            fewShotContext.length > 0
                ? `\n\nHere are ${fewShotContext.length} examples of past high-quality reviews for similar PRs in this project. Match their style and depth:\n\n${fewShotContext.join("\n\n")}`
                : "";

        const linkedIssueSection = linkedIssue
            ? `\n\n**Linked Issue #${linkedIssue.number}: ${linkedIssue.title}**\n${linkedIssue.body.slice(0, 500)}`
            : "";

        const riskSection = `\n\n**Automated Bug Risk Score: ${bugRisk.overall}/10**\n${bugRisk.explanation}`;

        const prompt = `Review this pull request thoroughly.${fewShotSection}${linkedIssueSection}${riskSection}

**PR #${prNumber}: ${pr.title}**
Author: ${pr.user?.login}
Description: ${pr.body?.slice(0, 800) || "No description"}
Files Changed: ${files.length} | +${pr.additions}/-${pr.deletions}
${mapReduceUsed ? "(Note: Diff was large and has been pre-summarised via map-reduce)" : ""}

**Modified Files:**
${filesSummary}

**${mapReduceUsed ? "Summarised " : ""}Diff:**
\`\`\`
${diffContext.slice(0, 20_000)}
\`\`\`

Provide a JSON response:
{
  "verdict": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "qualityScore": 1-10,
  "summary": "2-3 sentence summary of the PR and its purpose",
  "issues": ["specific issue 1", "specific issue 2", ...],
  "suggestions": ["actionable suggestion 1", ...],
  "security": "security analysis or 'No issues detected'"
}`;

        const aiResponse = await this.chain.callLLM(prompt, {
            systemPrompt:
                "You are a senior staff engineer performing a thorough code review. Be specific, reference file names and line patterns, and provide actionable feedback. Match the style of the example reviews if provided.",
            maxTokens: 1500,
            temperature: 0.3,
        });

        // ── Parse response ──
        let analysis: {
            verdict: string;
            qualityScore: number;
            summary: string;
            issues: string[];
            suggestions: string[];
            security: string;
        };

        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            analysis = jsonMatch
                ? JSON.parse(jsonMatch[0])
                : {
                    verdict: "COMMENT",
                    qualityScore: 5,
                    summary: aiResponse.slice(0, 500),
                    issues: [],
                    suggestions: [],
                    security: "Unable to parse",
                };
        } catch {
            analysis = {
                verdict: "COMMENT",
                qualityScore: 5,
                summary: aiResponse.slice(0, 500),
                issues: [],
                suggestions: [],
                security: "Unable to parse",
            };
        }

        return {
            prNumber,
            bugRisk,
            verdict: analysis.verdict as PRAnalysis["verdict"],
            summary: analysis.summary,
            issues: analysis.issues ?? [],
            suggestions: analysis.suggestions ?? [],
            security: analysis.security ?? "No issues detected",
            fewShotContext,
            linkedIssue: linkedIssue ?? undefined,
        };
    }

    // ── PR Summarise with Issue Cross-Reference ──────────────────────

    /**
     * Generate a PR summary that includes the linked issue context —
     * something the old route never did.
     */
    async summarizePR(
        octokit: Octokit,
        owner: string,
        repo: string,
        prNumber: number
    ): Promise<PRSummary> {
        const { data: pr } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        const { data: files } = await octokit.pulls.listFiles({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 30,
        });

        const { data: commits } = await octokit.pulls.listCommits({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 20,
        });

        // ── Fetch actual diff ──
        let diff = "";
        try {
            const diffResponse = await octokit.pulls.get({
                owner,
                repo,
                pull_number: prNumber,
                mediaType: { format: "diff" },
            });
            diff = diffResponse.data as unknown as string;
        } catch {
            diff = files
                .filter((f) => f.patch)
                .map((f) => `--- ${f.filename}\n${f.patch}`)
                .join("\n\n");
        }

        // ── Resolve linked issue ──
        const linkedIssue = await this.resolveLinkedIssue(
            octokit, owner, repo, pr.body ?? ""
        );

        // ── Handle large diffs ──
        let diffSection: string;
        if (diff.length > 16_000) {
            const mr = await this.chain.mapReduceDiff(diff, pr.title, pr.body ?? "");
            diffSection = `(Map-reduced from ${mr.totalChunks} chunks)\n${mr.finalSummary}`;
        } else {
            diffSection = diff.slice(0, 16_000);
        }

        const filesSummary = files
            .slice(0, 15)
            .map((f) => `- ${f.filename}: +${f.additions}/-${f.deletions}`)
            .join("\n");

        const commitsSummary = commits
            .slice(0, 10)
            .map((c) => `- ${c.commit.message.split("\n")[0]}`)
            .join("\n");

        const linkedIssueSection = linkedIssue
            ? `\n\n**Linked Issue #${linkedIssue.number}: ${linkedIssue.title}**\nDescription: ${linkedIssue.body.slice(0, 500)}\n\nThis PR was created to address the above issue. Include its context in your summary.`
            : "";

        const prompt = `Generate a concise, well-formatted summary of this pull request:${linkedIssueSection}

**Title:** ${pr.title}
**Description:** ${pr.body || "No description provided"}
**Author:** ${pr.user?.login}
**Branch:** ${pr.head.ref} → ${pr.base.ref}
**Stats:** +${pr.additions}/-${pr.deletions} across ${files.length} files

**Recent Commits:**
${commitsSummary}

**Files Changed:**
${filesSummary}

**Diff:**
\`\`\`
${diffSection}
\`\`\`

Write a summary that:
1. Explains what the PR does and WHY (reference the linked issue if present)
2. Lists the main changes as bullet points
3. Notes important technical details
4. Mentions potential impact areas

Format with headers and bullet points.`;

        const summary = await this.chain.callLLM(prompt, {
            systemPrompt: "You are a technical writer creating clear, accurate PR summaries.",
            maxTokens: 1200,
            temperature: 0.3,
        });

        return {
            prNumber,
            summary,
            linkedIssue: linkedIssue ?? undefined,
        };
    }

    // ── Linked Issue Resolution ──────────────────────────────────────

    /**
     * Parse issue references (#NNN, Fixes #NNN, Closes #NNN, etc.)
     * from the PR body and fetch the first matched issue.
     */
    private async resolveLinkedIssue(
        octokit: Octokit,
        owner: string,
        repo: string,
        prBody: string
    ): Promise<{ number: number; title: string; body: string } | null> {
        // Match patterns: #123, fixes #123, closes #123, resolves #123
        const issuePattern =
            /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*#(\d+)|(?:^|\s)#(\d+)/gim;
        const matches = [...prBody.matchAll(issuePattern)];

        if (matches.length === 0) return null;

        const issueNumber = parseInt(matches[0][1] || matches[0][2], 10);
        if (isNaN(issueNumber)) return null;

        try {
            const { data: issue } = await octokit.issues.get({
                owner,
                repo,
                issue_number: issueNumber,
            });
            return {
                number: issue.number,
                title: issue.title,
                body: issue.body ?? "",
            };
        } catch {
            console.warn(`Failed to fetch linked issue #${issueNumber}`);
            return null;
        }
    }
}
