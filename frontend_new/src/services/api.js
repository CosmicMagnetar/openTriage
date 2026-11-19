/**
 * OpenTriage API Service
 * Centralized API client for all backend calls
 */

// Use VITE_BACKEND_URL for backend-ts (port 3001)
const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

/**
 * Make an authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: response.statusText }));
      const errorMessage = error.detail || error.error || "API request failed";
      console.error(
        `API Error [${response.status}] ${endpoint}:`,
        errorMessage,
      );
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    // Network errors or fetch failures
    if (error instanceof TypeError) {
      console.error("Network error:", error.message);
      throw new Error(
        "Network connection failed. Please check your connection.",
      );
    }
    throw error;
  }
}

// ============ RAG Chatbot API ============

export const ragApi = {
  askQuestion: (
    question,
    repoName = null,
    topK = 5,
    githubAccessToken = null,
    sessionId = null,
  ) =>
    apiRequest("/api/rag/chat", {
      method: "POST",
      body: JSON.stringify({
        question,
        repo_name: repoName,
        top_k: topK,
        github_access_token: githubAccessToken,
        session_id: sessionId,
      }),
    }),

  searchDocuments: (query, repoName = null, limit = 10) =>
    apiRequest("/api/rag/search", {
      method: "POST",
      body: JSON.stringify({ query, repo_name: repoName, limit }),
    }),

  indexRepository: (repoName) =>
    apiRequest("/api/rag/index", {
      method: "POST",
      body: JSON.stringify({ repo_name: repoName }),
    }),

  getSuggestedQuestions: (repoName = null) =>
    apiRequest(
      `/api/rag/suggestions${repoName ? `?repo_name=${repoName}` : ""}`,
    ),
};

// ============ Local Search API (using Orama) ============

/**
 * Local search wrapper that integrates with Orama indices.
 * Use this to search README content indexed in the browser without hitting the backend.
 *
 * @param {Object} oramaIndex - Orama index object with `performSearch`, `indexReadme` methods
 * @returns {Object} search API similar to ragApi.searchDocuments but local
 */
export function createLocalSearchApi(oramaIndex) {
  if (!oramaIndex) {
    console.warn("Orama index not provided to createLocalSearchApi");
    return null;
  }

  return {
    /**
     * Search indexed README content locally
     * @param {string} query - Search query
     * @param {string} repoName - Repository name (owner/repo format, optional)
     * @param {number} limit - Max results
     * @returns {Promise<Array>}
     */
    searchDocuments: async (query, repoName = null, limit = 10) => {
      const results = await oramaIndex.performSearch(query, limit, repoName);
      return results;
    },

    /**
     * Index a repository's README locally
     * @param {string} repoName - Repository name (owner/repo format)
     * @param {string} githubToken - Optional GitHub token for private repos
     * @returns {Promise<Object>}
     */
    indexRepository: async (repoName, githubToken = null) => {
      const [owner, repo] = repoName.split("/");
      if (!owner || !repo) {
        throw new Error("Repository name must be in format: owner/repo");
      }

      const result = await oramaIndex.indexReadme(owner, repo, githubToken);
      return result;
    },

    /**
     * Clear a repository from the local index
     * @param {string} repoName - Repository name (owner/repo format)
     * @returns {Promise<boolean>}
     */
    clearRepository: async (repoName) => {
      const [owner, repo] = repoName.split("/");
      if (!owner || !repo) {
        throw new Error("Repository name must be in format: owner/repo");
      }
      return await oramaIndex.clearRepository(owner, repo);
    },

    /**
     * Get indexed repositories
     * @returns {Array<string>}
     */
    getIndexedRepos: () => oramaIndex.indexedRepos,

    /**
     * Get index statistics
     * @returns {Object}
     */
    getStats: () => oramaIndex.stats,
  };
}

// ============ Sync API ============

export const syncApi = {
  // Sync user's GitHub data
  syncUserData: () => apiRequest("/api/sync/user-data", { method: "POST" }),

  getSyncStatus: () => apiRequest("/api/sync/user-data"),
};

// ============ Repository API ============

export const repositoryApi = {
  getAllRepositories: () => apiRequest("/api/repositories"),

  getMaintainerRepos: () => apiRequest("/api/repositories/maintainer"),

  getContributorRepos: () => apiRequest("/api/repositories/contributor"),

  addRepository: (repoFullName) =>
    apiRequest("/api/repositories", {
      method: "POST",
      body: JSON.stringify({ repoFullName }),
    }),
};

export default {
  ragApi,
  syncApi,
  repositoryApi,
};
