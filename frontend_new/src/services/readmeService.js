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

    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    // GitHub API endpoint to get README
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`,
      { headers },
    );

    if (!response.ok) {
      // If not found, try raw.githubusercontent.com as fallback
      if (response.status === 404) {
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
    console.error(`Failed to fetch README for ${owner}/${repo}:`, error);
    // Fallback to raw GitHub
    return await fetchReadmeFromRaw(owner, repo);
  }
}

/**
 * Fallback: fetch README directly from raw.githubusercontent.com
 * (works for public repos without authentication)
 */
async function fetchReadmeFromRaw(owner, repo) {
  try {
    const filenames = ["README.md", "README.markdown", "README.txt", "README"];

    for (const filename of filenames) {
      const url = `${RAW_GITHUB_BASE}/${owner}/${repo}/main/${filename}`;
      const response = await fetch(url);

      if (response.ok) {
        const content = await response.text();
        return {
          content,
          filename,
          htmlUrl: `https://github.com/${owner}/${repo}/blob/main/${filename}`,
          downloadUrl: url,
        };
      }

      // Try master branch if main doesn't exist
      const masterUrl = `${RAW_GITHUB_BASE}/${owner}/${repo}/master/${filename}`;
      const masterResponse = await fetch(masterUrl);
      if (masterResponse.ok) {
        const content = await masterResponse.text();
        return {
          content,
          filename,
          htmlUrl: `https://github.com/${owner}/${repo}/blob/master/${filename}`,
          downloadUrl: masterUrl,
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`Fallback README fetch failed for ${owner}/${repo}:`, error);
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
