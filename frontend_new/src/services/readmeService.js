/**
 * GitHub README Fetcher Service
 *
 * Fetches repository README files directly from GitHub using OAuth tokens.
 * Supports both public and private repos when authenticated.
 */

const GITHUB_API_BASE = "https://api.github.com";
const RAW_GITHUB_BASE = "https://raw.githubusercontent.com";

/** Cache repos confirmed to have no README — avoid repeat requests */
const noReadmeCache = new Set();

/**
 * Fetch README content from a repository
 * @param {string} owner - Repository owner (username or org)
 * @param {string} repo - Repository name
 * @param {string} githubToken - GitHub OAuth token (optional, for private repos)
 * @returns {Promise<{content: string, filename: string, htmlUrl: string} | null>}
 */
export async function fetchReadme(owner, repo, githubToken = null) {
  const repoKey = `${owner}/${repo}`;

  // Skip if we already know this repo has no README
  if (noReadmeCache.has(repoKey)) {
    return null;
  }

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

    // GitHub API endpoint to get README — this checks ALL branches & filenames
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`,
      { headers },
    );

    if (!response.ok) {
      if (response.status === 404) {
        // GitHub API 404 is definitive — repo has no README on any branch
        console.warn(`No README found for ${repoKey}`);
        noReadmeCache.add(repoKey);
        return null;
      }
      // For auth errors (no token / bad token), try raw (works for public repos)
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
    // Network error — try raw fallback once
    console.warn(
      `README fetch via API failed for ${repoKey}, trying raw fallback`,
    );
    return await fetchReadmeFromRaw(owner, repo);
  }
}

/**
 * Fallback: fetch README directly from raw.githubusercontent.com
 * (works for public repos without authentication)
 */
async function fetchReadmeFromRaw(owner, repo) {
  const repoKey = `${owner}/${repo}`;
  try {
    // Only try main branch + README.md first (covers ~90% of repos)
    const primaryUrl = `${RAW_GITHUB_BASE}/${owner}/${repo}/main/README.md`;
    const primaryRes = await fetch(primaryUrl);
    if (primaryRes.ok) {
      const content = await primaryRes.text();
      return {
        content,
        filename: "README.md",
        htmlUrl: `https://github.com/${owner}/${repo}/blob/main/README.md`,
        downloadUrl: primaryUrl,
      };
    }

    // One more try: master branch
    const masterUrl = `${RAW_GITHUB_BASE}/${owner}/${repo}/master/README.md`;
    const masterRes = await fetch(masterUrl);
    if (masterRes.ok) {
      const content = await masterRes.text();
      return {
        content,
        filename: "README.md",
        htmlUrl: `https://github.com/${owner}/${repo}/blob/master/README.md`,
        downloadUrl: masterUrl,
      };
    }

    // Neither worked — cache and give up
    console.warn(`No README found for ${repoKey} via raw fallback`);
    noReadmeCache.add(repoKey);
    return null;
  } catch (error) {
    console.warn(`Raw README fetch failed for ${repoKey}`);
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
