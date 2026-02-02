/**
 * GitHub API Service
 * Handles direct GitHub API calls for PR management
 */

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Fetch all repositories where the user has maintainer permissions
 * @param {string} githubAccessToken - GitHub OAuth token
 * @param {string[]} existingRepos - Array of repo full names already added
 * @returns {Promise<Array<{owner: string, repo: string}>>}
 */
export async function fetchMaintainerRepos(
  githubAccessToken,
  existingRepos = [],
) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/user/repos?per_page=100&type=owner,collaborator`,
      {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`,
      );
    }

    const repos = await response.json();

    const filteredRepos = repos
      .filter(
        (repo) =>
          (repo.permissions?.admin ||
            repo.permissions?.maintain ||
            repo.permissions?.push) &&
          !existingRepos.includes(repo.full_name),
      )
      .map((repo) => ({
        owner: repo.owner.login,
        repo: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        isPrivate: repo.private,
      }));

    return filteredRepos;
  } catch (error) {
    console.error("Failed to fetch maintainer repos:", error);
    throw new Error(`Failed to fetch maintainer repos: ${error.message}`);
  }
}

/**
 * Fetch unmerged pull requests for a repository
 * @param {string} githubAccessToken - GitHub OAuth token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Array<{number: number, title: string}>>}
 */
export async function fetchUnmergedPullRequests(
  githubAccessToken,
  owner,
  repo,
) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=open`,
      {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`,
      );
    }

    const pulls = await response.json();

    const unmergedPRs = pulls
      .filter((pr) => pr.merged_at === null)
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        user: pr.user.login,
        createdAt: pr.created_at,
        htmlUrl: pr.html_url,
      }));

    return unmergedPRs;
  } catch (error) {
    console.error(`Failed to fetch unmerged PRs for ${owner}/${repo}:`, error);
    throw new Error(
      `Failed to fetch unmerged PRs for ${owner}/${repo}: ${error.message}`,
    );
  }
}

/**
 * Post a comment on a pull request
 * @param {string} githubAccessToken - GitHub OAuth token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @param {string} commentText - Comment body text
 * @returns {Promise<Object>} GitHub API response
 */
export async function commentOnPullRequest(
  githubAccessToken,
  owner,
  repo,
  prNumber,
  commentText,
) {
  try {
    // Verify repo access
    const repoResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!repoResponse.ok) {
      throw new Error(
        `Cannot access repository: ${repoResponse.status} ${repoResponse.statusText}`,
      );
    }

    const repoData = await repoResponse.json();

    if (
      !repoData.permissions?.admin &&
      !repoData.permissions?.maintain &&
      !repoData.permissions?.push
    ) {
      throw new Error("Insufficient permissions to comment on this repository");
    }

    // Post comment
    const commentResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: commentText }),
      },
    );

    if (!commentResponse.ok) {
      throw new Error(
        `Failed to post comment: ${commentResponse.status} ${commentResponse.statusText}`,
      );
    }

    return await commentResponse.json();
  } catch (error) {
    console.error(
      `Failed to comment on PR #${prNumber} in ${owner}/${repo}:`,
      error,
    );
    throw new Error(
      `Failed to comment on PR #${prNumber} in ${owner}/${repo}: ${error.message}`,
    );
  }
}

/**
 * Merge a pull request
 * @param {string} githubAccessToken - GitHub OAuth token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @param {string} mergeMethod - Merge method: 'merge', 'squash', or 'rebase'
 * @returns {Promise<Object>} GitHub API response
 */
export async function mergePullRequest(
  githubAccessToken,
  owner,
  repo,
  prNumber,
  mergeMethod = "merge",
) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ merge_method: mergeMethod }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message ||
          `Failed to merge PR: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      `Failed to merge PR #${prNumber} in ${owner}/${repo}:`,
      error,
    );
    throw new Error(`Failed to merge PR: ${error.message}`);
  }
}

/**
 * Close a pull request or issue
 * @param {string} githubAccessToken - GitHub OAuth token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} number - Issue/PR number
 * @param {boolean} isPR - Whether this is a pull request
 * @returns {Promise<Object>} GitHub API response
 */
export async function closeIssueOrPR(
  githubAccessToken,
  owner,
  repo,
  number,
  isPR = false,
) {
  try {
    const endpoint = isPR
      ? `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${number}`
      : `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${number}`;

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state: "closed" }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message ||
          `Failed to close: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to close #${number} in ${owner}/${repo}:`, error);
    throw new Error(`Failed to close: ${error.message}`);
  }
}

/**
 * Fetch the raw diff for a pull request
 * @param {string} githubAccessToken - GitHub OAuth token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @returns {Promise<string>} Raw diff content
 */
export async function fetchPullRequestDiff(
  githubAccessToken,
  owner,
  repo,
  prNumber,
) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: "application/vnd.github.v3.diff",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch diff: ${response.status} ${response.statusText}`,
      );
    }

    return await response.text();
  } catch (error) {
    console.error(
      `Failed to fetch diff for PR #${prNumber} in ${owner}/${repo}:`,
      error,
    );
    throw new Error(`Failed to fetch diff: ${error.message}`);
  }
}

/**
 * Fetch changed files for a pull request
 * @param {string} githubAccessToken - GitHub OAuth token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @returns {Promise<Array>} List of changed files with patches
 */
export async function fetchPullRequestFiles(
  githubAccessToken,
  owner,
  repo,
  prNumber,
) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch files: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      `Failed to fetch files for PR #${prNumber} in ${owner}/${repo}:`,
      error,
    );
    throw new Error(`Failed to fetch files: ${error.message}`);
  }
}

/**
 * Submit a review on a pull request
 * @param {string} githubAccessToken - GitHub OAuth token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - Pull request number
 * @param {string} event - Review event: 'APPROVE', 'REQUEST_CHANGES', or 'COMMENT'
 * @param {string} body - Review comment body
 * @returns {Promise<Object>} GitHub API response
 */
export async function submitPullRequestReview(
  githubAccessToken,
  owner,
  repo,
  prNumber,
  event,
  body = "",
) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body,
          event, // APPROVE, REQUEST_CHANGES, or COMMENT
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message ||
          `Failed to submit review: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      `Failed to submit review for PR #${prNumber} in ${owner}/${repo}:`,
      error,
    );
    throw new Error(`Failed to submit review: ${error.message}`);
  }
}
