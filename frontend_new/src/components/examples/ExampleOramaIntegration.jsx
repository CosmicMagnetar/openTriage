/**
 * INTEGRATION GUIDE: Using Orama for Local README Search
 *
 * This file provides a working example of how to integrate Orama into your React app
 * for client-side README searching without backend calls.
 *
 * === QUICK START ===
 *
 * 1. In your component:
 *
 *    import useOramaIndex from '@/hooks/useOramaIndex';
 *    import { createLocalSearchApi } from '@/services/api';
 *    import OramaSearchPanel from '@/components/ui/OramaSearchPanel';
 *
 * 2. Create the hook and API:
 *
 *    const oramaIndex = useOramaIndex();
 *    const localSearchApi = createLocalSearchApi(oramaIndex);
 *
 * 3. Index a README when user selects a repo:
 *
 *    const handleSelectRepo = async (repoName) => {
 *      const result = await oramaIndex.indexReadme(owner, repo, githubToken);
 *      if (result.success) {
 *        toast.success(`Indexed ${result.sectionsIndexed} sections`);
 *      }
 *    };
 *
 * 4. Use for local searches (no backend):
 *
 *    const results = await oramaIndex.performSearch("how to install");
 *
 * 5. Display results:
 *
 *    <OramaSearchPanel
 *      onSearch={oramaIndex.performSearch}
 *      isLoading={oramaIndex.isLoading}
 *      error={oramaIndex.error}
 *      indexedRepos={oramaIndex.indexedRepos}
 *      stats={oramaIndex.stats}
 *    />
 *
 * === FULL EXAMPLE ===
 *
 * Here's a minimal component showing the complete workflow:
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import useOramaIndex from "@/hooks/useOramaIndex";
import { createLocalSearchApi } from "@/services/api";
import OramaSearchPanel from "@/components/ui/OramaSearchPanel";
import useAuthStore from "@/stores/authStore";

/**
 * ExampleOramaIntegration
 *
 * Demonstrates full Orama integration:
 * - Fetch README from GitHub
 * - Index into Orama in browser RAM
 * - Search without backend
 */
export function ExampleOramaIntegration() {
  const { token } = useAuthStore();
  const oramaIndex = useOramaIndex();
  const localSearchApi = createLocalSearchApi(oramaIndex);

  const [selectedRepo, setSelectedRepo] = useState(null);
  const [repoInput, setRepoInput] = useState("");

  // Example: Index a repository when user enters owner/repo
  const handleIndexRepo = async () => {
    if (!repoInput) {
      toast.error("Please enter repo in format: owner/repo");
      return;
    }

    const [owner, repo] = repoInput.split("/");
    if (!owner || !repo) {
      toast.error("Invalid format. Use: owner/repo");
      return;
    }

    const toastId = toast.loading(`Indexing ${owner}/${repo} README...`);

    try {
      const result = await oramaIndex.indexReadme(owner, repo, token);

      if (result.success) {
        setSelectedRepo(`${owner}/${repo}`);
        toast.success(
          `Indexed ${result.sectionsIndexed} README sections!`,
          { id: toastId }
        );
        setRepoInput("");
      } else {
        toast.error(result.error || "Failed to index", { id: toastId });
      }
    } catch (error) {
      toast.error(String(error), { id: toastId });
    }
  };

  // Example: Clear a repository
  const handleClearRepo = async (repo) => {
    const toastId = toast.loading("Clearing index...");
    const success = await oramaIndex.clearRepository(
      repo.split("/")[0],
      repo.split("/")[1]
    );

    if (success) {
      toast.success("Cleared from index", { id: toastId });
      if (selectedRepo === repo) {
        setSelectedRepo(null);
      }
    } else {
      toast.error("Failed to clear", { id: toastId });
    }
  };

  return (
    <div className="space-y-6 p-6 bg-gradient-to-b from-[hsl(220,13%,10%)] to-[hsl(220,13%,8%)] rounded-lg border border-[hsl(220,13%,18%)]">
      {/* Title & Info */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-[hsl(210,11%,90%)]">
          📚 Local README Search with Orama
        </h2>
        <p className="text-sm text-[hsl(210,11%,60%)]">
          Index any GitHub repository's README and search it in your browser—no backend required!
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,18%)] rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-[hsl(210,11%,85%)]">
          Index a Repository
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/repo (e.g., facebook/react)"
            className="flex-1 px-3 py-2 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)]"
          />
          <button
            onClick={handleIndexRepo}
            disabled={oramaIndex.isLoading}
            className="px-4 py-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:opacity-50 text-white rounded font-medium text-sm transition-colors"
          >
            Index
          </button>
        </div>
      </div>

      {/* Indexed Repos */}
      {oramaIndex.indexedRepos.length > 0 && (
        <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,18%)] rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-[hsl(210,11%,85%)]">
            Indexed Repositories ({oramaIndex.indexedRepos.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {oramaIndex.indexedRepos.map((repo) => (
              <div
                key={repo}
                className="flex items-center gap-2 bg-[hsl(142,70%,45%,0.15)] border border-[hsl(142,70%,45%,0.3)] rounded px-3 py-2"
              >
                <span className="text-sm text-[hsl(210,11%,85%)]">{repo}</span>
                <button
                  onClick={() => handleClearRepo(repo)}
                  className="text-xs text-[hsl(210,11%,60%)] hover:text-[hsl(217,91%,65%)] transition-colors"
                  title="Remove from index"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {oramaIndex.stats.docCount > 0 && (
            <p className="text-xs text-[hsl(210,11%,50%)]">
              {oramaIndex.stats.docCount} sections indexed in memory
            </p>
          )}
        </div>
      )}

      {/* Search Panel */}
      <OramaSearchPanel
        onSearch={oramaIndex.performSearch}
        isLoading={oramaIndex.isLoading}
        results={[]}
        error={oramaIndex.error}
        indexedRepos={oramaIndex.indexedRepos}
        stats={oramaIndex.stats}
      />

      {/* Features */}
      <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,18%)] rounded-lg p-4 space-y-2">
        <h3 className="font-semibold text-[hsl(210,11%,85%)]">✨ Features</h3>
        <ul className="text-sm text-[hsl(210,11%,70%)] space-y-1">
          <li>✓ Full-text search on README content</li>
          <li>✓ Indexed entirely in browser RAM—instant searches</li>
          <li>✓ Works with private repos (requires GitHub token)</li>
          <li>✓ No backend load, no API calls for searches</li>
          <li>✓ Relevance scoring built-in</li>
          <li>✓ Filter results by repository</li>
        </ul>
      </div>
    </div>
  );
}

export default ExampleOramaIntegration;
