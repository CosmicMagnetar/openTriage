from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
import httpx
import asyncio
import logging
from config.database import db
from models.repository import Repository
from models.issue import Issue
from models.triage import IssueTriageData, Classification, Sentiment
from utils.dependencies import get_current_user
from services.github_service import github_service
from services.ai_service import ai_triage_service

logger = logging.getLogger(__name__)
router = APIRouter()


class AddRepoRequest(BaseModel):
    repoFullName: str


async def import_repo_data(repository: Repository, repo_full_name: str, github_access_token: str = None):
    """Background task to import issues and PRs from a repository."""
    try:
        logger.info(f"Starting import for {repo_full_name}...")
        data = await github_service.fetch_repo_issues(repo_full_name, github_access_token)
        logger.info(f"Fetched {len(data['issues'])} issues and {len(data['prs'])} PRs from GitHub")
        
        # Extract owner and repo from full name
        owner, repo = repo_full_name.split('/')
        
        issue_count = 0
        for gh_issue in data['issues']:
            issue = Issue(
                githubIssueId=gh_issue['id'],
                number=gh_issue['number'],
                title=gh_issue['title'],
                body=gh_issue.get('body') or '',
                authorName=gh_issue['user']['login'],
                repoId=repository.id,
                repoName=repository.name,
                owner=owner,
                repo=repo,
                htmlUrl=gh_issue.get('html_url', ''),
                state=gh_issue['state'],
                isPR=False
            )
            issue_dict = issue.model_dump()
            issue_dict['createdAt'] = issue_dict['createdAt'].isoformat()
            existing = await db.issues.find_one({"githubIssueId": issue.githubIssueId}, {"_id": 0})
            if not existing:
                await db.issues.insert_one(issue_dict)
                asyncio.create_task(classify_and_store(issue))
                issue_count += 1
        
        pr_count = 0
        for gh_pr in data['prs']:
            pr = Issue(
                githubIssueId=gh_pr['id'],
                number=gh_pr['number'],
                title=gh_pr['title'],
                body=gh_pr.get('body') or '',
                authorName=gh_pr['user']['login'],
                repoId=repository.id,
                repoName=repository.name,
                owner=owner,
                repo=repo,
                htmlUrl=gh_pr.get('html_url', ''),
                state=gh_pr['state'],
                isPR=True
            )
            pr_dict = pr.model_dump()
            pr_dict['createdAt'] = pr_dict['createdAt'].isoformat()
            existing = await db.issues.find_one({"githubIssueId": pr.githubIssueId}, {"_id": 0})
            if not existing:
                await db.issues.insert_one(pr_dict)
                asyncio.create_task(classify_and_store(pr))
                pr_count += 1
        
        logger.info(f"✓ Imported {issue_count} new issues and {pr_count} new PRs for {repo_full_name}")
    except Exception as e:
        logger.error(f"Import error for {repo_full_name}: {e}", exc_info=True)


async def classify_and_store(issue: Issue):
    """Background task to classify an issue using AI."""
    try:
        result = await ai_triage_service.classify_issue(issue)
        triage = IssueTriageData(
            issueId=issue.id,
            classification=Classification(result['classification']),
            summary=result['summary'],
            suggestedLabel=result['suggestedLabel'],
            sentiment=Sentiment(result['sentiment'])
        )
        triage_dict = triage.model_dump()
        triage_dict['analyzedAt'] = triage_dict['analyzedAt'].isoformat()
        await db.triage_data.insert_one(triage_dict)
        logger.info(f"{'PR' if issue.isPR else 'Issue'} {issue.number} classified")
    except Exception as e:
        logger.error(f"Classification error: {e}")


@router.post("/repositories")
async def add_repository(request: AddRepoRequest, user: dict = Depends(get_current_user)):
    """Add a new repository to track."""
    try:
        parts = request.repoFullName.split('/')
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="Invalid format. Use 'owner/repo'")
        owner, repo_name = parts
        
        # Verify repository exists on GitHub
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(f"https://api.github.com/repos/{request.repoFullName}")
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Repository not found")
            repo_data = response.json()
        
        # Check if already added
        existing = await db.repositories.find_one(
            {"githubRepoId": repo_data['id'], "userId": user['id']},
            {"_id": 0}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Repository already added")
        
        # Create repository record
        repository = Repository(
            githubRepoId=repo_data['id'],
            name=request.repoFullName,
            owner=owner,
            userId=user['id']
        )
        repo_dict = repository.model_dump()
        repo_dict['createdAt'] = repo_dict['createdAt'].isoformat()
        await db.repositories.insert_one(repo_dict)
        
        # Get user's GitHub access token for authenticated requests
        user_doc = await db.users.find_one({"id": user['id']}, {"_id": 0})
        github_token = user_doc.get('githubAccessToken') if user_doc else None
        
        # Start background import with authentication
        asyncio.create_task(import_repo_data(repository, request.repoFullName, github_token))
        
        return {"message": "Repository added!", "repository": repo_dict}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add repo error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/repositories")
async def get_repositories(user: dict = Depends(get_current_user)):
    """Get all repositories for the current user."""
    repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
    for repo in repos:
        if 'createdAt' in repo and isinstance(repo['createdAt'], datetime):
            repo['createdAt'] = repo['createdAt'].isoformat()
    return repos
