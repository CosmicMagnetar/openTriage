/**
 * Orama Search Service
 *
 * Wrapper around Orama for client-side full-text search.
 * Enables searching README content and other documents without hitting the backend.
 */

import { create, insert, search } from "orama";

/**
 * Create an Orama instance for searching README content
 * @returns {Promise<import('orama').Orama>}
 */
export async function createReadmeIndex() {
  return await create({
    schema: {
      title: "string",
      content: "string",
      section: "string",
      level: "number",
      repository: "string",
      sourceUrl: "string",
    },
  });
}

/**
 * Index README sections into Orama
 * @param {import('orama').Orama} index - Orama instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Array<{title, content, level}>} sections - README sections
 * @param {string} sourceUrl - URL to the README
 * @returns {Promise<string[]>} - Array of document IDs
 */
export async function indexReadmeSections(
  index,
  owner,
  repo,
  sections,
  sourceUrl,
) {
  const docIds = [];

  for (const section of sections) {
    try {
      const id = await insert(index, {
        title: section.title || "Untitled",
        content: section.content || "",
        section: section.title || "Untitled",
        level: section.level || 0,
        repository: `${owner}/${repo}`,
        sourceUrl: sourceUrl || "",
      });
      docIds.push(id);
    } catch (error) {
      console.error(`Failed to index section "${section.title}":`, error);
    }
  }

  return docIds;
}

/**
 * Search README content using Orama
 * @param {import('orama').Orama} index - Orama instance
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 10)
 * @param {string} repository - Filter by repository (optional)
 * @returns {Promise<Array<{title, content, section, score}>>}
 */
export async function searchReadme(
  index,
  query,
  limit = 10,
  repository = null,
) {
  if (!query || !query.trim()) return [];

  try {
    const searchOptions = {
      term: query,
      limit,
    };

    // If filtering by repo, add where clause
    if (repository) {
      searchOptions.where = {
        repository: {
          eq: repository,
        },
      };
    }

    const results = await search(index, searchOptions);

    // Transform results to a cleaner format
    return (results.hits || []).map((hit) => ({
      id: hit.id,
      title: hit.document?.title || "Untitled",
      content: hit.document?.content || "",
      section: hit.document?.section || "Untitled",
      repository: hit.document?.repository || "",
      sourceUrl: hit.document?.sourceUrl || "",
      score: hit.score || 0,
    }));
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

/**
 * Get list of indexed repositories
 * (Note: Orama 2.0.6 doesn't have a built-in "get all unique values" function,
 *  so we track this separately in the hook)
 */
export async function getIndexedRepositories(index) {
  try {
    const results = await search(index, {
      term: "*",
      limit: 1000,
    });

    const repos = new Set();
    for (const hit of results.hits || []) {
      if (hit.document?.repository) {
        repos.add(hit.document.repository);
      }
    }
    return Array.from(repos);
  } catch (error) {
    console.error("Failed to get indexed repos:", error);
    return [];
  }
}

/**
 * Get index statistics
 * @param {import('orama').Orama} index - Orama instance
 * @returns {Promise<{docCount: number}>}
 */
export async function getIndexStats(index) {
  try {
    // Search for all documents using wildcard
    const results = await search(index, {
      term: "*",
      limit: 1,
    });
    return {
      docCount: results.count || 0,
    };
  } catch (error) {
    console.error("Failed to get index stats:", error);
    return { docCount: 0 };
  }
}
