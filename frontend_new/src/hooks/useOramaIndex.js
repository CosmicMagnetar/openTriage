/**
 * useOramaIndex
 *
 * React hook for managing client-side README search with Orama.
 * Creates and manages an Orama index, handles indexing and searching.
 *
 * Usage:
 *   const {
 *     index,
 *     isLoading,
 *     error,
 *     indexReadme,
 *     performSearch,
 *     clearIndex,
 *   } = useOramaIndex();
 *
 *   // Index a README
 *   await indexReadme("owner", "repo-name", readmeContent, githubToken);
 *
 *   // Search
 *   const results = await performSearch("how to install");
 */

import { useState, useRef, useCallback } from "react";
import {
  createReadmeIndex,
  indexReadmeSections,
  searchReadme,
  getIndexStats,
} from "@/services/oramaService";
import { parseReadmeToSections, fetchReadme } from "@/services/readmeService";

export default function useOramaIndex() {
  const indexRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [indexedRepos, setIndexedRepos] = useState(new Set());
  const [stats, setStats] = useState({ docCount: 0 });

  // Initialize the Orama index (lazy on first use)
  const ensureIndexInitialized = useCallback(async () => {
    if (!indexRef.current) {
      try {
        indexRef.current = await createReadmeIndex();
      } catch (err) {
        console.error("Failed to initialize Orama index:", err);
        throw err;
      }
    }
    return indexRef.current;
  }, []);

  /**
   * Fetch a README from GitHub and index it in Orama
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} githubToken - Optional GitHub token for private repos
   */
  const indexReadme = useCallback(
    async (owner, repo, githubToken = null) => {
      setIsLoading(true);
      setError(null);

      try {
        const index = await ensureIndexInitialized();
        const repoKey = `${owner}/${repo}`;

        console.log(`🔄 Starting index process for ${repoKey}...`);

        // Note: Orama 2.0.6 doesn't have a remove/delete function,
        // so we don't clear old entries. Multiple repos can coexist in the index.

        // Fetch README
        console.log(`📥 Fetching README for ${repoKey}...`);
        const readmeData = await fetchReadme(owner, repo, githubToken);
        if (!readmeData) {
          throw new Error(`Could not find README for ${owner}/${repo}`);
        }
        console.log(
          `✅ README fetched: ${readmeData.filename} (${readmeData.content.length} chars)`,
        );

        // Parse into sections
        console.log(`📑 Parsing sections...`);
        const sections = parseReadmeToSections(readmeData.content);
        if (sections.length === 0) {
          throw new Error(
            `README is empty or could not be parsed: ${readmeData.filename}`,
          );
        }
        console.log(`✅ Parsed ${sections.length} sections`);

        // Index sections
        console.log(`🗂️ Indexing sections into Orama...`);
        await indexReadmeSections(
          index,
          owner,
          repo,
          sections,
          readmeData.htmlUrl,
        );

        // Update state
        setIndexedRepos((prev) => new Set(prev).add(repoKey));
        const newStats = await getIndexStats(index);
        setStats(newStats);
        console.log(`📊 Index stats:`, newStats);

        return {
          success: true,
          sectionsIndexed: sections.length,
          repoKey,
          filename: readmeData.filename,
        };
      } catch (err) {
        const errorMsg = err.message || String(err);
        setError(errorMsg);
        console.error("Error indexing README:", err);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [ensureIndexInitialized],
  );

  /**
   * Search the indexed content
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @param {string} repository - Optional: filter by repository
   * @returns {Promise<Array>}
   */
  const performSearch = useCallback(
    async (query, limit = 10, repository = null) => {
      if (!indexRef.current) {
        console.warn("Search index not initialized");
        return [];
      }

      try {
        setError(null);
        const docCount = indexRef.current.docCount ?? 0;
        console.log(
          `🔍 Searching: "${query}", repo: "${repository}", docs: ${docCount}`,
        );
        const results = await searchReadme(
          indexRef.current,
          query,
          limit,
          repository,
        );
        console.log(`✅ Search returned ${results.length} results`);

        if (results.length > 0) {
          console.log("📌 Top result:", {
            section: results[0].section,
            score: results[0].score?.toFixed(2),
          });
        }
        return results;
      } catch (err) {
        setError(err.message || String(err));
        console.error("Search error:", err);
        return [];
      }
    },
    [],
  );

  /**
   * Clear a specific repository from the index
   */
  const clearRepository = useCallback(async (owner, repo) => {
    const repoKey = `${owner}/${repo}`;

    try {
      setError(null);
      if (indexRef.current) {
        // Selectively remove docs for this repo only
        indexRef.current.removeByRepo(repoKey);
        const newStats = await getIndexStats(indexRef.current);
        setStats(newStats);
      }

      setIndexedRepos((prev) => {
        const next = new Set(prev);
        next.delete(repoKey);
        return next;
      });

      return true;
    } catch (err) {
      setError(err.message || String(err));
      console.error("Clear error:", err);
      return false;
    }
  }, []);

  /**
   * Clear all indexed content
   */
  const clearAllIndices = useCallback(async () => {
    if (!indexRef.current) return false;

    try {
      setError(null);
      // Recreate the index (clears everything)
      indexRef.current = await createReadmeIndex();
      setIndexedRepos(new Set());
      setStats({ docCount: 0 });
      return true;
    } catch (err) {
      setError(err.message || String(err));
      return false;
    }
  }, []);

  return {
    // Search functionality
    performSearch,
    indexReadme,
    clearRepository,
    clearAllIndices,

    // State
    isLoading,
    error,
    indexedRepos: Array.from(indexedRepos),
    stats,

    // Direct access (if needed)
    index: indexRef.current,
  };
}
