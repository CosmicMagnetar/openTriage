import httpx
import logging
from typing import List, Dict, Optional
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class GitHubService:
    """Service for interacting with GitHub API."""
    
    def __init__(self):
        self.base_url = "https://api.github.com"
    
    async def fetch_maintainer_repos(
        self, 
        github_access_token: str, 
        existing_repos: List[str]
    ) -> List[Dict[str, str]]:
        """
        Fetch all repositories where the user has admin, maintain, or push permissions,
        excluding repos already added to the website.
        
        Args:
            github_access_token: GitHub OAuth token
            existing_repos: List of repo full names already added
            
        Returns:
            List of dicts with 'owner' and 'repo' keys
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/user/repos",
                    params={"per_page": 100, "type": "owner,collaborator"},
                    headers={
                        "Authorization": f"Bearer {github_access_token}",
                        "Accept": "application/vnd.github+json"
                    },
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"GitHub API error: {response.status_code} {response.text}"
                    )
                
                repos = response.json()
                
                # Filter repos with required permissions and not in existing_repos
                filtered_repos = []
                for repo in repos:
                    permissions = repo.get('permissions', {})
                    has_permission = (
                        permissions.get('admin') or 
                        permissions.get('maintain') or 
                        permissions.get('push')
                    )
                    
                    if has_permission and repo['full_name'] not in existing_repos:
                        filtered_repos.append({
                            'owner': repo['owner']['login'],
                            'repo': repo['name']
                        })
                
                return filtered_repos
                
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="GitHub API request timed out")
        except Exception as e:
            logger.error(f"Failed to fetch maintainer repos: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch maintainer repos: {str(e)}")
    
    async def fetch_unmerged_pull_requests(
        self, 
        github_access_token: str, 
        owner: str, 
        repo: str
    ) -> List[Dict[str, any]]:
        """
        Fetch only pull requests that are open and not merged.
        
        Args:
            github_access_token: GitHub OAuth token
            owner: Repository owner
            repo: Repository name
            
        Returns:
            List of dicts with 'number' and 'title' keys
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/pulls",
                    params={"state": "open"},
                    headers={
                        "Authorization": f"Bearer {github_access_token}",
                        "Accept": "application/vnd.github+json"
                    },
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"GitHub API error: {response.status_code} {response.text}"
                    )
                
                pulls = response.json()
                
                # Filter only unmerged PRs (merged_at is null)
                unmerged_prs = [
                    {
                        'number': pr['number'],
                        'title': pr['title']
                    }
                    for pr in pulls
                    if pr.get('merged_at') is None
                ]
                
                return unmerged_prs
                
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="GitHub API request timed out")
        except Exception as e:
            logger.error(f"Failed to fetch unmerged PRs for {owner}/{repo}: {e}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to fetch unmerged PRs for {owner}/{repo}: {str(e)}"
            )
    
    async def comment_on_pull_request(
        self,
        github_access_token: str,
        owner: str,
        repo: str,
        pr_number: int,
        comment_text: str
    ) -> Dict:
        """
        Post a comment on a pull request after verifying repo access.
        
        Args:
            github_access_token: GitHub OAuth token
            owner: Repository owner
            repo: Repository name
            pr_number: Pull request number
            comment_text: Comment body text
            
        Returns:
            GitHub API response for the created comment
        """
        try:
            async with httpx.AsyncClient() as client:
                # First, verify repo access
                repo_response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}",
                    headers={
                        "Authorization": f"Bearer {github_access_token}",
                        "Accept": "application/vnd.github+json"
                    },
                    timeout=30.0
                )
                
                if repo_response.status_code != 200:
                    raise HTTPException(
                        status_code=repo_response.status_code,
                        detail=f"Cannot access repository: {repo_response.status_code} {repo_response.text}"
                    )
                
                repo_data = repo_response.json()
                permissions = repo_data.get('permissions', {})
                
                # Check if user has required permissions
                if not (permissions.get('admin') or permissions.get('maintain') or permissions.get('push')):
                    raise HTTPException(
                        status_code=403,
                        detail="Insufficient permissions to comment on this repository"
                    )
                
                # Post the comment
                comment_response = await client.post(
                    f"{self.base_url}/repos/{owner}/{repo}/issues/{pr_number}/comments",
                    json={"body": comment_text},
                    headers={
                        "Authorization": f"Bearer {github_access_token}",
                        "Accept": "application/vnd.github+json",
                        "Content-Type": "application/json"
                    },
                    timeout=30.0
                )
                
                if comment_response.status_code not in [200, 201]:
                    raise HTTPException(
                        status_code=comment_response.status_code,
                        detail=f"Failed to post comment: {comment_response.status_code} {comment_response.text}"
                    )
                
                return comment_response.json()
                
        except HTTPException:
            raise
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="GitHub API request timed out")
        except Exception as e:
            logger.error(f"Failed to comment on PR #{pr_number} in {owner}/{repo}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to comment on PR #{pr_number} in {owner}/{repo}: {str(e)}"
            )
    
    async def comment_on_issue(
        self,
        github_access_token: str,
        owner: str,
        repo: str,
        issue_number: int,
        comment_text: str
    ) -> Dict:
        """
        Post a comment on a GitHub issue after verifying repo access.
        
        Args:
            github_access_token: GitHub OAuth token
            owner: Repository owner
            repo: Repository name
            issue_number: Issue number
            comment_text: Comment body text
            
        Returns:
            GitHub API response for the created comment
        """
        try:
            async with httpx.AsyncClient() as client:
                # First, verify repo access
                repo_response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}",
                    headers={
                        "Authorization": f"Bearer {github_access_token}",
                        "Accept": "application/vnd.github+json"
                    },
                    timeout=30.0
                )
                
                if repo_response.status_code != 200:
                    raise HTTPException(
                        status_code=repo_response.status_code,
                        detail=f"Cannot access repository: {repo_response.status_code} {repo_response.text}"
                    )
                
                repo_data = repo_response.json()
                permissions = repo_data.get('permissions', {})
                
                # Check if user has required permissions
                if not (permissions.get('admin') or permissions.get('maintain') or permissions.get('push')):
                    raise HTTPException(
                        status_code=403,
                        detail="Insufficient permissions to comment on this repository"
                    )
                
                # Post the comment
                comment_response = await client.post(
                    f"{self.base_url}/repos/{owner}/{repo}/issues/{issue_number}/comments",
                    json={"body": comment_text},
                    headers={
                        "Authorization": f"Bearer {github_access_token}",
                        "Accept": "application/vnd.github+json",
                        "Content-Type": "application/json"
                    },
                    timeout=30.0
                )
                
                if comment_response.status_code not in [200, 201]:
                    raise HTTPException(
                        status_code=comment_response.status_code,
                        detail=f"Failed to post comment: {comment_response.status_code} {comment_response.text}"
                    )
                
                return comment_response.json()
                
        except HTTPException:
            raise
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="GitHub API request timed out")
        except Exception as e:
            logger.error(f"Failed to comment on issue #{issue_number} in {owner}/{repo}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to comment on issue #{issue_number} in {owner}/{repo}: {str(e)}"
            )
    
    async def fetch_issue_comments(
        self,
        github_access_token: str,
        owner: str,
        repo: str,
        issue_number: int
    ) -> List[Dict]:
        """
        Fetch all comments for a GitHub issue.
        
        Args:
            github_access_token: GitHub OAuth token
            owner: Repository owner
            repo: Repository name
            issue_number: Issue number
            
        Returns:
            List of comment objects from GitHub API
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/repos/{owner}/{repo}/issues/{issue_number}/comments",
                    headers={
                        "Authorization": f"Bearer {github_access_token}",
                        "Accept": "application/vnd.github+json"
                    },
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Failed to fetch comments: {response.status_code} {response.text}"
                    )
                
                return response.json()
                
        except HTTPException:
            raise
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="GitHub API request timed out")
        except Exception as e:
            logger.error(f"Failed to fetch comments for issue #{issue_number} in {owner}/{repo}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch comments for issue #{issue_number} in {owner}/{repo}: {str(e)}"
            )
    
    async def fetch_repo_issues(self, repo_full_name: str, github_access_token: Optional[str] = None, include_prs: bool = True) -> Dict:

        """Fetch issues and PRs from a GitHub repository."""
        try:
            async with httpx.AsyncClient() as client:
                issues_url = f"{self.base_url}/repos/{repo_full_name}/issues"
                params = {"state": "all", "per_page": 100}
                headers = {"Accept": "application/vnd.github+json"}
                if github_access_token:
                    headers["Authorization"] = f"Bearer {github_access_token}"
                
                response = await client.get(issues_url, params=params, headers=headers, timeout=30.0)
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Failed to fetch from GitHub: {response.text}"
                    )
                
                items = response.json()
                issues = []
                prs = []
                
                for item in items:
                    is_pr = 'pull_request' in item
                    if is_pr:
                        prs.append(item)
                    else:
                        issues.append(item)
                
                return {"issues": issues, "prs": prs if include_prs else []}
                
        except Exception as e:
            logger.error(f"GitHub fetch error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def fetch_user_activity(self, username: str, github_access_token: Optional[str] = None) -> Dict:
        """Fetch a user's GitHub activity (issues and PRs)."""
        try:
            async with httpx.AsyncClient() as client:
                search_url = f"{self.base_url}/search/issues"
                params = {
                    "q": f"author:{username}",
                    "per_page": 100,
                    "sort": "created",
                    "order": "desc"
                }
                headers = {"Accept": "application/vnd.github+json"}
                if github_access_token:
                    headers["Authorization"] = f"Bearer {github_access_token}"
                
                response = await client.get(search_url, params=params, headers=headers, timeout=30.0)
                
                if response.status_code != 200:
                    logger.error(f"GitHub search error: {response.text}")
                    return {"issues": [], "prs": []}
                
                items = response.json().get('items', [])
                issues = []
                prs = []
                
                for item in items:
                    is_pr = 'pull_request' in item
                    if is_pr:
                        prs.append(item)
                    else:
                        issues.append(item)
                
                return {"issues": issues, "prs": prs}
                
        except Exception as e:
            logger.error(f"GitHub user activity fetch error: {e}")
            return {"issues": [], "prs": []}


# Singleton instance
github_service = GitHubService()
