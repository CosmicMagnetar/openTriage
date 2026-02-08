/**
 * ORAMA LOCAL SEARCH - QUICK REFERENCE
 *
 * This is a cheat sheet for using Orama in your application.
 * For detailed docs, see ORAMA_GUIDE.md
 */

// ============================================================
// SETUP
// ============================================================

import useOramaIndex from "@/hooks/useOramaIndex";
import { createLocalSearchApi } from "@/services/api";
import OramaSearchPanel from "@/components/ui/OramaSearchPanel";
import useAuthStore from "@/stores/authStore";

// ============================================================
// IN YOUR COMPONENT
// ============================================================

export function MyComponent() {
  // 1. Get the hook
  const oramaIndex = useOramaIndex();
  const { token } = useAuthStore(); // GitHub token

  // 2. INDEX A README (when user selects a repo)
  const handleSelectRepo = async (owner, repo) => {
    const result = await oramaIndex.indexReadme(owner, repo, token);
    if (result.success) {
      console.log(`Indexed ${result.sectionsIndexed} sections`);
    } else {
      console.error(result.error);
    }
  };

  // 3. SEARCH LOCALLY
  const handleSearch = async (query) => {
    const results = await oramaIndex.performSearch(
      query, // search term
      10, // limit (optional, default 10)
      "owner/repo", // filter by repo (optional)
    );
    return results;
  };

  // 4. CLEAR INDEX
  const handleClear = async () => {
    await oramaIndex.clearAllIndices();
  };

  // 5. USE THE UI COMPONENT
  return (
    <OramaSearchPanel
      onSearch={oramaIndex.performSearch}
      isLoading={oramaIndex.isLoading}
      error={oramaIndex.error}
      indexedRepos={oramaIndex.indexedRepos}
      stats={oramaIndex.stats}
    />
  );
}

// ============================================================
// SEARCH RESULTS STRUCTURE
// ============================================================

/*
  results = [
    {
      id: "doc-id",
      title: "Installation",
      content: "To install React...",
      section: "Installation",
      repository: "facebook/react",
      sourceUrl: "https://github.com/facebook/react/blob/main/README.md",
      score: 0.95  // relevance (0-1)
    },
    ...
  ]
*/

// ============================================================
// API REFERENCE
// ============================================================

// useOramaIndex() returns:
// {
//   // Methods
//   performSearch(query, limit?, repo?),    // Search
//   indexReadme(owner, repo, token?),       // Index
//   clearRepository(owner, repo),           // Clear one
//   clearAllIndices(),                      // Clear all
//
//   // State
//   isLoading: boolean,
//   error: string | null,
//   indexedRepos: string[],  // ["owner/repo", ...]
//   stats: { docCount: number },
//
//   // Direct access
//   index: Orama  // if needed
// }

// ============================================================
// EXAMPLES
// ============================================================

// Example 1: Basic Search
async function basicSearch(query) {
  const oramaIndex = useOramaIndex();
  const results = await oramaIndex.performSearch(query);
  console.log(results);
}

// Example 2: Index Multiple Repos
async function indexMultipleRepos(repos, token) {
  const oramaIndex = useOramaIndex();

  for (const [owner, repo] of repos) {
    const result = await oramaIndex.indexReadme(owner, repo, token);
    console.log(`${owner}/${repo}: ${result.sectionsIndexed} sections`);
  }
}

// Example 3: Conditional Backend Fallback
async function smartSearch(query, repo, token) {
  const oramaIndex = useOramaIndex();
  const { ragApi } = useApi();

  // If repo is indexed locally, use Orama
  if (oramaIndex.indexedRepos.includes(repo)) {
    return await oramaIndex.performSearch(query, 10, repo);
  }

  // Otherwise fall back to backend RAG
  return await ragApi.searchDocuments(query, repo);
}

// Example 4: Use Local Search API (mirrors ragApi)
function useLocalOrBackendSearch() {
  const oramaIndex = useOramaIndex();
  const localSearchApi = createLocalSearchApi(oramaIndex);

  // Now you can use localSearchApi like ragApi:
  // await localSearchApi.searchDocuments(query, repo, limit)
  // await localSearchApi.indexRepository(repo, token)
  // localSearchApi.getIndexedRepos()
  // localSearchApi.getStats()

  return localSearchApi;
}

// ============================================================
// PERFORMANCE TIPS
// ============================================================

// 1. Index in background
const handleSelectRepo = async (owner, repo) => {
  // Don't await, let it index in background
  const promise = oramaIndex.indexReadme(owner, repo, token);
  // Show loading UI
  promise.then(() => {
    // Update UI when done
  });
};

// 2. Debounce search
import { useCallback } from "react";
const [query, setQuery] = useState("");
const debouncedSearch = useCallback(
  debounce(async (q) => {
    const results = await oramaIndex.performSearch(q);
    setResults(results);
  }, 300),
  [oramaIndex],
);

// 3. Lazy load Orama (it's only created on first search)
const oramaIndexInstance = useOramaIndex(); // Fast! Doesn't create index yet
// Index is created on first indexReadme() or performSearch() call

// ============================================================
// GOTCHAS & KNOWN LIMITS
// ============================================================

// 1. No delete support in Orama 2.0.6
//    - clearRepository() clears ALL indices
//    - clearAllIndices() resets completely
//    - If you need selective deletion, clear all and re-index others

// 2. GitHub API rate limits
//    - 60/hour unauthenticated
//    - 5,000/hour with token

// 3. No persistence
//    - Data lives in RAM only
//    - Refresh clears everything
//    - Consider localStorage if needed

// 4. Private repos need token
//    const result = await oramaIndex.indexReadme(owner, repo, githubToken);

// ============================================================
// DEBUGGING
// ============================================================

const oramaIndexDebug = useOramaIndex();

// Check if indexed
console.log(oramaIndexDebug.indexedRepos); // ["facebook/react", "vuejs/vue"]

// Check stats
console.log(oramaIndexDebug.stats); // { docCount: 150 }

// Check errors
console.log(oramaIndexDebug.error); // null or error message

// Direct access to Orama (if needed)
console.log(oramaIndexDebug.index); // Raw Orama instance

// ============================================================
// INTEGRATION WITH YOUR APP
// ============================================================

// In ContributorAIChat.jsx, replace:
//   const results = await ragApi.searchDocuments(query, repo);
// With:
//   const results = await oramaIndex.performSearch(query, 10, repo);

// Or use the local API wrapper:
//   const localSearchApi = createLocalSearchApi(oramaIndex);
//   const results = await localSearchApi.searchDocuments(query, repo);

// ============================================================
// FULL WORKING EXAMPLE
// ============================================================

// See: src/components/examples/ExampleOramaIntegration.jsx
