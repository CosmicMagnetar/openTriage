/**
 * Orama Search Service
 *
 * Wrapper around Orama for client-side full-text search.
 * Enables searching README content and other documents without hitting the backend.
 *
 * NOTE: Currently stubbed - the orama npm package is a charting library, not search.
 * Update this when migrating to @orama/core or an alternative search solution.
 */

// import { create as createIndex, insert as insertDoc, search as searchDocs } from "orama";

/**
 * Create an Orama instance for searching README content
 * @returns {Promise<import('orama').Orama>}
 */
export async function createReadmeIndex() {
  // Stubbed - returns a dummy index
  return { schema: {} };
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
  // Stubbed - returns dummy IDs
  console.log(`📝 Orama indexing stubbed for ${owner}/${repo}`);
  return sections.map((_, i) => `doc-${i}`);
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
  // Stubbed - returns empty results
  console.log(`🔎 Orama search stubbed for query: "${query}"`);
  return [];
}

/**
 * Get list of indexed repositories
 * (Note: Orama 2.0.6 doesn't have a built-in "get all unique values" function,
 *  so we track this separately in the hook)
 */
export async function getIndexedRepositories(index) {
  // Stubbed - returns empty array
  return [];
}

/**
 * Get index statistics
 * @param {import('orama').Orama} index - Orama instance
 * @returns {Promise<{docCount: number}>}
 */
export async function getIndexStats(index) {
  // Stubbed - returns empty stats
  return { docCount: 0 };
}
