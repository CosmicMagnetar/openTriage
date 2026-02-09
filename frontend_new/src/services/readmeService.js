/**
 * GitHub README Fetcher Service
 *
 * Fetches repository README files directly from GitHub using OAuth tokens.
 * Supports both public and private repos when authenticated.
 */

const GITHUB_API_BASE = "https://api.github.com";
const RAW_GITHUB_BASE = "https://raw.githubusercontent.com";

/**
 * Fetch README content from a repository
 * @param {string} owner - Repository owner (username or org)
 * @param {string} repo - Repository name
 * @param {string} githubToken - GitHub OAuth token (optional, for private repos)
 * @returns {Promise<{content: string, filename: string, htmlUrl: string} | null>}
 */
export async function fetchReadme(owner, repo, githubToken = null) {
  try {
    // Try to get the README via GitHub API (more reliable, gives us metadata)
    const headers = {
      Accept: "application/vnd.github+json",
    };

    // Only attach token if it looks like a GitHub token (starts with ghp_, gho_, github_pat_, etc.)
    // Avoid sending non-GitHub tokens (e.g. app JWTs) which cause 401
    if (
      githubToken &&
      /^(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)/.test(githubToken)
    ) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    // GitHub API endpoint to get README
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`,
      { headers },
    );

    if (!response.ok) {
      // If not found via API, try raw.githubusercontent.com as fallback
      if (response.status === 404) {
        return await fetchReadmeFromRaw(owner, repo);
      }
      // For auth errors, skip and try raw (works for public repos)
      if (response.status === 401 || response.status === 403) {
        return await fetchReadmeFromRaw(owner, repo);
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    // The API returns base64-encoded content
    const content = atob(data.content);
    return {
      content,
      filename: data.name || "README",
      htmlUrl: data.html_url,
      downloadUrl: data.download_url,
    };
  } catch (error) {
    // Only log once, not for every fallback attempt
    console.warn(
      `README fetch via API failed for ${owner}/${repo}, trying raw fallback`,
    );
    return await fetchReadmeFromRaw(owner, repo);
  }
}

/**
 * Fallback: fetch README directly from raw.githubusercontent.com
 * (works for public repos without authentication)
 */
async function fetchReadmeFromRaw(owner, repo) {
  try {
    // Try the most common filename first (README.md covers ~95% of repos)
    // Only fall back to other names if main/master branches exist but the file doesn't
    const branches = ["main", "master"];
    const filenames = ["README.md", "readme.md"];

    for (const branch of branches) {
      for (const filename of filenames) {
        try {
          const url = `${RAW_GITHUB_BASE}/${owner}/${repo}/${branch}/${filename}`;
          const response = await fetch(url);
          if (response.ok) {
            const content = await response.text();
            return {
              content,
              filename,
              htmlUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${filename}`,
              downloadUrl: url,
            };
          }
        } catch {
          // Network error for this attempt, try next
        }
      }
    }

    // Repo likely has no README at all
    return null;
  } catch (error) {
    console.warn(`Fallback README fetch failed for ${owner}/${repo}`);
    return null;
  }
}

/**
 * Parse markdown sections from README
 * Breaks README into logical sections for better indexing
 */
export function parseReadmeToSections(readmeContent, maxSectionLength = 1000) {
  if (!readmeContent) return [];

  const sections = [];
  const lines = readmeContent.split("\n");
  let currentSection = {
    title: "Introduction",
    content: [],
    level: 0,
  };

  for (const line of lines) {
    // Detect headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save current section if it has content
      if (currentSection.content.length > 0) {
        sections.push({
          ...currentSection,
          content: currentSection.content.join("\n").trim(),
        });
      }

      // Start new section
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      currentSection = {
        title,
        content: [],
        level,
      };
    } else if (currentSection.content.join("\n").length < maxSectionLength) {
      currentSection.content.push(line);
    }
  }

  // Save final section
  if (currentSection.content.length > 0) {
    sections.push({
      ...currentSection,
      content: currentSection.content.join("\n").trim(),
    });
  }

  return sections;
}
