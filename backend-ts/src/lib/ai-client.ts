/**
 * AI Engine Client
 * 
 * Helper to proxy requests to the external Python AI Engine.
 * Configure AI_ENGINE_URL in .env.local
 */

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || "http://localhost:7860";
const AI_ENGINE_API_KEY = process.env.AI_ENGINE_API_KEY || "";

interface AIResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Call the AI Engine with type safety
 */
export async function callAIEngine<T = unknown>(
    endpoint: string,
    body: object,
    options?: { timeout?: number; token?: string }
): Promise<AIResponse<T>> {
    const url = `${AI_ENGINE_URL}${endpoint}`;
    const timeout = options?.timeout || 30000;

    // Check if AI engine URL is configured
    if (!AI_ENGINE_URL || AI_ENGINE_URL === "http://localhost:7860") {
        console.warn("AI_ENGINE_URL not configured or using default. Make sure AI engine is running.");
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        // Add API key authentication if configured
        if (AI_ENGINE_API_KEY) {
            headers["X-API-Key"] = AI_ENGINE_API_KEY;
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`AI Engine error [${response.status}]:`, errorText);
            
            if (response.status === 401) {
                return {
                    success: false,
                    error: "Authentication failed with AI engine. Please ensure AI_ENGINE_URL and authentication are correctly configured."
                };
            }

            if (response.status === 503 || response.status === 502) {
                return { 
                    success: false, 
                    error: `AI service unavailable (${response.status}). The AI engine may not be running. Check if the service is started.` 
                };
            }
            
            return { success: false, error: `AI Engine error: ${response.status} - ${errorText}` };
        }

        const data = await response.json();
        return { success: true, data: data as T };
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return { success: false, error: "AI Engine request timed out" };
        }
        return { success: false, error: `Failed to reach AI Engine: ${error}` };
    }
}

// Pre-configured helpers for each service

export async function triageIssue(issue: {
    title: string;
    body?: string;
    authorName?: string;
    isPR?: boolean;
}) {
    return callAIEngine("/triage", {
        title: issue.title,
        body: issue.body || "",
        authorName: issue.authorName || "unknown",
        isPR: issue.isPR || false,
    });
}

export async function chat(message: string, history?: { role: string; content: string }[], context?: object) {
    return callAIEngine("/chat", { message, history, context });
}

export async function ragQuery(question: string, repoName?: string) {
    return callAIEngine("/rag/chat", { question, repo_name: repoName });
}

export async function findMentorMatches(userId: string, username: string, limit = 5) {
    return callAIEngine("/mentor-match", { user_id: userId, username, limit });
}

export async function generateHype(pr: {
    title: string;
    body?: string;
    filesChanged?: string[];
    additions?: number;
    deletions?: number;
}) {
    return callAIEngine("/hype", {
        pr_title: pr.title,
        pr_body: pr.body || "",
        files_changed: pr.filesChanged || [],
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
    });
}

export async function ragChat(question: string, repoName?: string, topK = 5) {
    return callAIEngine("/rag/chat", { question, repo_name: repoName, top_k: topK });
}

export async function ragIndex(repoName: string, githubAccessToken?: string) {
    return callAIEngine("/rag/index", { repo_name: repoName, github_access_token: githubAccessToken });
}

export async function ragSearch(query: string, repoName?: string, limit = 10) {
    return callAIEngine("/rag/search", { query, repo_name: repoName, limit });
}

