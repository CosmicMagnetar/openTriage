/**
 * GitHub API Service
 * Handles direct GitHub API calls for PR management
 */

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Fetch all repositories where the user has maintainer permissions
 * @param {string} githubAccessToken - GitHub OAuth token
 * @param {string[]} existingRepos - Array of repo full names already added
 * @returns {Promise<Array<{owner: string, repo: string}>>}
 */
export async function fetchMaintainerRepos(githubAccessToken, existingRepos = []) {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/user/repos?per_page=100&type=owner,collaborator`, {
      headers: {
        'Authorization': `Bearer ${githubAccessToken}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const repos = await response.json();

    const filteredRepos = repos
      .filter(repo => 
        (repo.permissions?.admin || repo.permissions?.maintain || repo.permissions?.push) &&
        !existingRepos.includes(repo.full_name)
      )
      .map(repo => ({
        owner: repo.owner.login,
        repo: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        isPrivate: repo.private
      }));

    return filteredRepos;
  } catch (error) {
    console.error('Failed to fetch maintainer repos:', error);
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
export async function fetchUnmergedPullRequests(githubAccessToken, owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=open`, {
      headers: {
        'Authorization': `Bearer ${githubAccessToken}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const pulls = await response.json();

    const unmergedPRs = pulls
      .filter(pr => pr.merged_at === null)
      .map(pr => ({
        number: pr.number,
        title: pr.title,
        user: pr.user.login,
        createdAt: pr.created_at,
        htmlUrl: pr.html_url
      }));

    return unmergedPRs;
  } catch (error) {
    console.error(`Failed to fetch unmerged PRs for ${owner}/${repo}:`, error);
    throw new Error(`Failed to fetch unmerged PRs for ${owner}/${repo}: ${error.message}`);
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
export async function commentOnPullRequest(githubAccessToken, owner, repo, prNumber, commentText) {
  try {
    // Verify repo access
    const repoResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${githubAccessToken}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!repoResponse.ok) {
      throw new Error(`Cannot access repository: ${repoResponse.status} ${repoResponse.statusText}`);
    }

    const repoData = await repoResponse.json();

    if (!repoData.permissions?.admin && !repoData.permissions?.maintain && !repoData.permissions?.push) {
      throw new Error('Insufficient permissions to comment on this repository');
    }

    // Post comment
    const commentResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubAccessToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: commentText })
    });

    if (!commentResponse.ok) {
      throw new Error(`Failed to post comment: ${commentResponse.status} ${commentResponse.statusText}`);
    }

    return await commentResponse.json();
  } catch (error) {
    console.error(`Failed to comment on PR #${prNumber} in ${owner}/${repo}:`, error);
    throw new Error(`Failed to comment on PR #${prNumber} in ${owner}/${repo}: ${error.message}`);
  }
}
