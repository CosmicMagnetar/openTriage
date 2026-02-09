/**
 * MCP Tools
 *
 * Each tool is a self-contained function that performs one GitHub or
 * analysis operation. The MCP Server calls these on behalf of the
 * agent. Tools are extracted from quality-assessment.ts's inline
 * Octokit calls so the agent can compose them freely.
 *
 * Every tool:
 *   - Has a JSON-schema parameter definition (MCPToolDefinition)
 *   - Accepts an Octokit instance + typed args
 *   - Returns a plain object (serialisable to JSON)
 *   - Never calls the LLM directly (that's the agent's job)
 */

import { Octokit } from "@octokit/rest";
import type { MCPToolDefinition, MCPToolResult } from "./types";

// ── Tool Type ────────────────────────────────────────────────────────

export interface MCPTool {
    definition: MCPToolDefinition;
    execute: (
        octokit: Octokit,
        args: Record<string, unknown>
    ) => Promise<unknown>;
}

// ── 1. get_pr_details ────────────────────────────────────────────────

const getPRDetails: MCPTool = {
    definition: {
        name: "get_pr_details",
        description:
            "Fetch full metadata for a pull request: title, body, author, " +
            "state, branch info, additions/deletions, mergeable status.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "pr_number", type: "number", description: "PR number", required: true },
        ],
        category: "github",
    },
    async execute(octokit, args) {
        const { data: pr } = await octokit.pulls.get({
            owner: args.owner as string,
            repo: args.repo as string,
            pull_number: args.pr_number as number,
        });
        return {
            number: pr.number,
            title: pr.title,
            body: pr.body ?? "",
            author: pr.user?.login ?? "unknown",
            state: pr.state,
            head: pr.head.ref,
            headSha: pr.head.sha,
            base: pr.base.ref,
            additions: pr.additions,
            deletions: pr.deletions,
            changedFiles: pr.changed_files,
            mergeable: pr.mergeable,
            mergeableState: pr.mergeable_state,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
            labels: pr.labels.map((l) => l.name),
        };
    },
};

// ── 2. get_pr_diff ───────────────────────────────────────────────────

const getPRDiff: MCPTool = {
    definition: {
        name: "get_pr_diff",
        description:
            "Fetch the raw unified diff of a pull request. Returns the " +
            "actual code changes, not just file stats.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "pr_number", type: "number", description: "PR number", required: true },
        ],
        category: "github",
    },
    async execute(octokit, args) {
        try {
            const response = await octokit.pulls.get({
                owner: args.owner as string,
                repo: args.repo as string,
                pull_number: args.pr_number as number,
                mediaType: { format: "diff" },
            });
            const diff = response.data as unknown as string;
            return {
                diff,
                length: diff.length,
                truncated: false,
            };
        } catch {
            // Fallback: assemble from patches
            const { data: files } = await octokit.pulls.listFiles({
                owner: args.owner as string,
                repo: args.repo as string,
                pull_number: args.pr_number as number,
                per_page: 50,
            });
            const diff = files
                .filter((f) => f.patch)
                .map((f) => `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`)
                .join("\n\n");
            return {
                diff,
                length: diff.length,
                truncated: false,
                fallback: true,
            };
        }
    },
};

// ── 3. get_pr_files ──────────────────────────────────────────────────

const getPRFiles: MCPTool = {
    definition: {
        name: "get_pr_files",
        description:
            "List files changed in a PR with per-file stats (additions, " +
            "deletions, status, filename). Does NOT include the diff content.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "pr_number", type: "number", description: "PR number", required: true },
            { name: "limit", type: "number", description: "Max files to return", required: false, default: 50 },
        ],
        category: "github",
    },
    async execute(octokit, args) {
        const { data: files } = await octokit.pulls.listFiles({
            owner: args.owner as string,
            repo: args.repo as string,
            pull_number: args.pr_number as number,
            per_page: Math.min((args.limit as number) ?? 50, 100),
        });
        return {
            totalFiles: files.length,
            files: files.map((f) => ({
                filename: f.filename,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
                changes: f.changes,
            })),
        };
    },
};

// ── 4. get_pr_commits ────────────────────────────────────────────────

const getPRCommits: MCPTool = {
    definition: {
        name: "get_pr_commits",
        description:
            "List commit messages for a PR. Useful for understanding " +
            "intent and the progression of changes.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "pr_number", type: "number", description: "PR number", required: true },
        ],
        category: "github",
    },
    async execute(octokit, args) {
        const { data: commits } = await octokit.pulls.listCommits({
            owner: args.owner as string,
            repo: args.repo as string,
            pull_number: args.pr_number as number,
            per_page: 30,
        });
        return {
            totalCommits: commits.length,
            commits: commits.map((c) => ({
                sha: c.sha.slice(0, 7),
                message: c.commit.message,
                author: c.commit.author?.name ?? c.author?.login ?? "unknown",
                date: c.commit.author?.date,
            })),
        };
    },
};

// ── 5. get_pr_reviews ────────────────────────────────────────────────

const getPRReviews: MCPTool = {
    definition: {
        name: "get_pr_reviews",
        description:
            "Fetch existing code reviews on a PR. Use these as few-shot " +
            "examples to match the project's review style and standards.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "pr_number", type: "number", description: "PR number", required: true },
        ],
        category: "github",
    },
    async execute(octokit, args) {
        const { data: reviews } = await octokit.pulls.listReviews({
            owner: args.owner as string,
            repo: args.repo as string,
            pull_number: args.pr_number as number,
            per_page: 30,
        });
        return {
            totalReviews: reviews.length,
            reviews: reviews.map((r) => ({
                id: r.id,
                user: r.user?.login ?? "unknown",
                state: r.state,
                body: r.body ?? "",
                submittedAt: r.submitted_at,
            })),
        };
    },
};

// ── 6. search_issue_history ──────────────────────────────────────────

const searchIssueHistory: MCPTool = {
    definition: {
        name: "search_issue_history",
        description:
            "Search closed issues in the repository by keyword. Finds " +
            "past bugs, feature requests, and discussions relevant to " +
            "the current PR context.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "query", type: "string", description: "Search keywords", required: true },
            { name: "limit", type: "number", description: "Max results", required: false, default: 10 },
        ],
        category: "search",
    },
    async execute(octokit, args) {
        const q = `repo:${args.owner}/${args.repo} is:issue is:closed ${args.query}`;
        const { data } = await octokit.search.issuesAndPullRequests({
            q,
            per_page: Math.min((args.limit as number) ?? 10, 30),
            sort: "updated",
        });
        return {
            totalCount: data.total_count,
            issues: data.items.map((i) => ({
                number: i.number,
                title: i.title,
                body: (i.body ?? "").slice(0, 500),
                state: i.state,
                labels: i.labels.map((l) =>
                    typeof l === "string" ? l : l.name ?? ""
                ),
                closedAt: i.closed_at,
                url: i.html_url,
            })),
        };
    },
};

// ── 7. get_linked_issue ──────────────────────────────────────────────

const getLinkedIssue: MCPTool = {
    definition: {
        name: "get_linked_issue",
        description:
            "Fetch a specific issue by number. Use after detecting " +
            "'Fixes #N' or 'Closes #N' in the PR body to understand " +
            "the motivation behind the PR.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "issue_number", type: "number", description: "Issue number", required: true },
        ],
        category: "github",
    },
    async execute(octokit, args) {
        const { data: issue } = await octokit.issues.get({
            owner: args.owner as string,
            repo: args.repo as string,
            issue_number: args.issue_number as number,
        });

        // Also fetch comments for full context
        let comments: { user: string; body: string; createdAt: string }[] = [];
        try {
            const { data: rawComments } = await octokit.issues.listComments({
                owner: args.owner as string,
                repo: args.repo as string,
                issue_number: args.issue_number as number,
                per_page: 10,
            });
            comments = rawComments.map((c) => ({
                user: c.user?.login ?? "unknown",
                body: c.body?.slice(0, 300) ?? "",
                createdAt: c.created_at,
            }));
        } catch { /* non-critical */ }

        return {
            number: issue.number,
            title: issue.title,
            body: (issue.body ?? "").slice(0, 1500),
            state: issue.state,
            labels: issue.labels.map((l) =>
                typeof l === "string" ? l : l.name ?? ""
            ),
            author: issue.user?.login ?? "unknown",
            createdAt: issue.created_at,
            closedAt: issue.closed_at,
            comments,
        };
    },
};

// ── 8. fetch_repo_file ───────────────────────────────────────────────

const fetchRepoFile: MCPTool = {
    definition: {
        name: "fetch_repo_file",
        description:
            "Read a file from the repository at a given path. Use to " +
            "fetch README.md, CONTRIBUTING.md, style guides (.eslintrc, " +
            ".prettierrc), or any source file for deeper analysis.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "path", type: "string", description: "File path (e.g. 'README.md', '.eslintrc.json')", required: true },
            { name: "ref", type: "string", description: "Branch or commit SHA", required: false, default: "main" },
        ],
        category: "github",
    },
    async execute(octokit, args) {
        try {
            const { data } = await octokit.repos.getContent({
                owner: args.owner as string,
                repo: args.repo as string,
                path: args.path as string,
                ref: (args.ref as string) ?? "main",
            });

            if ("content" in data && data.encoding === "base64") {
                const content = Buffer.from(data.content, "base64").toString("utf-8");
                return {
                    path: args.path,
                    content: content.slice(0, 10_000),
                    size: data.size,
                    truncated: content.length > 10_000,
                    sha: data.sha,
                };
            }

            // It's a directory — return file listing
            if (Array.isArray(data)) {
                return {
                    path: args.path,
                    type: "directory",
                    entries: data.map((d) => ({
                        name: d.name,
                        type: d.type,
                        size: d.size,
                        path: d.path,
                    })),
                };
            }

            return { path: args.path, error: "Unexpected response format" };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { path: args.path, error: `File not found: ${message}` };
        }
    },
};

// ── 9. search_docs_folder ────────────────────────────────────────────

const searchDocsFolder: MCPTool = {
    definition: {
        name: "search_docs_folder",
        description:
            "Autonomously search the /docs directory (or similar) for " +
            "documentation files. Falls back to searching common doc " +
            "paths if /docs doesn't exist. Use when the README is " +
            "insufficient to answer a question.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "query", type: "string", description: "What to look for", required: true },
        ],
        category: "search",
    },
    async execute(octokit, args) {
        const owner = args.owner as string;
        const repo = args.repo as string;
        const query = args.query as string;

        const docPaths = [
            "docs",
            "documentation",
            ".github",
            "wiki",
            "guides",
        ];

        const foundDocs: { path: string; name: string; type: string }[] = [];

        for (const docPath of docPaths) {
            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: docPath,
                });

                if (Array.isArray(data)) {
                    const matches = data.filter(
                        (f) =>
                            f.type === "file" &&
                            (f.name.toLowerCase().includes(query.toLowerCase()) ||
                                f.name.endsWith(".md") ||
                                f.name.endsWith(".rst") ||
                                f.name.endsWith(".txt"))
                    );
                    foundDocs.push(
                        ...matches.map((m) => ({
                            path: m.path,
                            name: m.name,
                            type: m.type,
                        }))
                    );
                }
            } catch {
                // Directory doesn't exist, skip
            }
        }

        // Also search for common standalone docs
        const standaloneFiles = [
            "CONTRIBUTING.md",
            "CODE_OF_CONDUCT.md",
            "CHANGELOG.md",
            "ARCHITECTURE.md",
            "DEVELOPMENT.md",
            "STYLE_GUIDE.md",
            ".eslintrc.json",
            ".eslintrc.js",
            ".prettierrc",
            ".prettierrc.json",
            "tsconfig.json",
        ];

        for (const file of standaloneFiles) {
            try {
                await octokit.repos.getContent({ owner, repo, path: file });
                foundDocs.push({ path: file, name: file, type: "file" });
            } catch {
                // File doesn't exist, skip
            }
        }

        return {
            query,
            docsFound: foundDocs.length,
            docs: foundDocs.slice(0, 20),
            searchedPaths: docPaths,
        };
    },
};

// ── 10. search_code ──────────────────────────────────────────────────

const searchCode: MCPTool = {
    definition: {
        name: "search_code",
        description:
            "Search for code patterns in the repository using GitHub " +
            "Code Search API. Use to find usages, definitions, or " +
            "related implementations.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "query", type: "string", description: "Code search query", required: true },
            { name: "limit", type: "number", description: "Max results", required: false, default: 10 },
        ],
        category: "search",
    },
    async execute(octokit, args) {
        const q = `repo:${args.owner}/${args.repo} ${args.query}`;
        try {
            const { data } = await octokit.search.code({
                q,
                per_page: Math.min((args.limit as number) ?? 10, 30),
            });
            return {
                totalCount: data.total_count,
                results: data.items.map((item) => ({
                    filename: item.name,
                    path: item.path,
                    url: item.html_url,
                    // GitHub doesn't return content in search; agent can
                    // follow up with fetch_repo_file if needed
                    score: item.score,
                })),
            };
        } catch {
            return { totalCount: 0, results: [], error: "Code search failed" };
        }
    },
};

// ── 11. get_pr_comments ──────────────────────────────────────────────

const getPRComments: MCPTool = {
    definition: {
        name: "get_pr_comments",
        description:
            "Fetch review comments (inline code comments) on a PR. " +
            "These are comments left on specific lines of code.",
        parameters: [
            { name: "owner", type: "string", description: "Repository owner", required: true },
            { name: "repo", type: "string", description: "Repository name", required: true },
            { name: "pr_number", type: "number", description: "PR number", required: true },
        ],
        category: "github",
    },
    async execute(octokit, args) {
        const { data: comments } = await octokit.pulls.listReviewComments({
            owner: args.owner as string,
            repo: args.repo as string,
            pull_number: args.pr_number as number,
            per_page: 50,
        });
        return {
            totalComments: comments.length,
            comments: comments.map((c) => ({
                id: c.id,
                user: c.user?.login ?? "unknown",
                body: c.body.slice(0, 500),
                path: c.path,
                line: c.line,
                side: c.side,
                createdAt: c.created_at,
            })),
        };
    },
};

// ── 12. request_guidance (HITL) ──────────────────────────────────────

/**
 * Human-in-the-Loop tool.
 *
 * When the agent is uncertain — e.g. conflicting information, ambiguous
 * requirements, or a decision that requires domain expertise — it can
 * call this tool to pause and ask the human for input.
 *
 * The actual blocking/waiting logic lives in OpenTriageAgent.  The
 * execute() here is a no-op placeholder; the agent intercepts this
 * tool name before it reaches execute().
 */
const requestGuidance: MCPTool = {
    definition: {
        name: "request_guidance",
        description:
            "Pause the analysis and ask the human reviewer a question. " +
            "Use when you encounter ambiguity, conflicting signals, or a " +
            "decision that requires domain-specific knowledge. The human " +
            "will reply and you can continue. Use sparingly — only when " +
            "truly stuck.",
        parameters: [
            {
                name: "question",
                type: "string",
                description:
                    "A clear, specific question for the human. Include " +
                    "context about what you've found so far and why you " +
                    "need input.",
                required: true,
            },
            {
                name: "options",
                type: "array",
                description:
                    "Optional array of suggested answers/choices to speed " +
                    "up the human's response.",
                required: false,
            },
        ],
        category: "analysis",
    },
    async execute(_octokit, args) {
        // Placeholder — the agent intercepts this tool before execution.
        // If we somehow reach here, return the question as-is.
        return {
            status: "guidance_requested",
            question: args.question,
            options: args.options ?? [],
            note: "Waiting for human reply...",
        };
    },
};

// ── Tool Registry ────────────────────────────────────────────────────

export const MCP_TOOLS: MCPTool[] = [
    getPRDetails,
    getPRDiff,
    getPRFiles,
    getPRCommits,
    getPRReviews,
    searchIssueHistory,
    getLinkedIssue,
    fetchRepoFile,
    searchDocsFolder,
    searchCode,
    getPRComments,
    requestGuidance,
];

/** Map for O(1) lookup by name */
export const TOOL_MAP = new Map<string, MCPTool>(
    MCP_TOOLS.map((t) => [t.definition.name, t])
);

/** Return the schema array for injection into agent prompts */
export function getToolSchemas(): MCPToolDefinition[] {
    return MCP_TOOLS.map((t) => t.definition);
}
