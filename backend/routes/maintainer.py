from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging
from config.database import db
from models.triage import Template, Classification
from utils.dependencies import require_maintainer
from services.github_service import github_service

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateTemplateRequest(BaseModel):
    name: str
    body: str
    triggerClassification: Optional[Classification] = None


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None
    triggerClassification: Optional[Classification] = None


class ReplyRequest(BaseModel):
    issueId: str
    message: str


class FetchReposRequest(BaseModel):
    githubAccessToken: str
    existingRepos: List[str]


class FetchPRsRequest(BaseModel):
    githubAccessToken: str
    owner: str
    repo: str


class CommentOnPRRequest(BaseModel):
    githubAccessToken: str
    owner: str
    repo: str
    prNumber: int
    commentText: str


@router.get("/maintainer/dashboard-summary")
async def get_dashboard_summary(user: dict = Depends(require_maintainer)):
    """Get dashboard summary statistics for open issues and PRs."""
    repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
    repo_ids = [r['id'] for r in repos]
    # Only count open issues and PRs
    total_issues = await db.issues.count_documents({
        "repoId": {"$in": repo_ids},
        "state": "open"
    })
    pending_triage = await db.issues.count_documents({
        "repoId": {"$in": repo_ids},
        "state": "open"
    })
    critical_bugs = await db.triage_data.count_documents({"classification": Classification.CRITICAL_BUG.value})
    return {
        "totalIssues": total_issues,
        "pendingTriage": pending_triage,
        "criticalBugs": critical_bugs,
        "avgResponseTime": 2.5,
        "repositoriesCount": len(repos)
    }


@router.get("/maintainer/issues")
async def get_issues(user: dict = Depends(require_maintainer)):
    """Get all open issues and PRs for maintainer's repositories with auto-sync from GitHub."""
    repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
    repo_ids = [r['id'] for r in repos]
    
    # Background task: Sync issue/PR states from GitHub and import new ones
    try:
        for repo in repos:
            # Fetch latest data from GitHub
            repo_full_name = repo.get('name')
            if repo_full_name and '/' in repo_full_name:
                try:
                    owner, repo_name = repo_full_name.split('/')
                    data = await github_service.fetch_repo_issues(repo_full_name)
                    
                    # Process both issues and PRs
                    for gh_item in data.get('issues', []) + data.get('prs', []):
                        is_pr = gh_item.get('pull_request') is not None or gh_item in data.get('prs', [])
                        
                        # Check if exists
                        existing = await db.issues.find_one(
                            {"githubIssueId": gh_item['id']},
                            {"_id": 0}
                        )
                        
                        if existing:
                            # Update existing with all metadata
                            await db.issues.update_one(
                                {"githubIssueId": gh_item['id']},
                                {"$set": {
                                    "title": gh_item['title'],
                                    "body": gh_item.get('body') or '',
                                    "state": gh_item['state'],
                                    "htmlUrl": gh_item.get('html_url', '')
                                }},
                                upsert=False
                            )
                        else:
                            # Import new issue/PR
                            from models.issue import Issue
                            new_item = Issue(
                                githubIssueId=gh_item['id'],
                                number=gh_item['number'],
                                title=gh_item['title'],
                                body=gh_item.get('body') or '',
                                authorName=gh_item['user']['login'],
                                repoId=repo['id'],
                                repoName=repo_full_name,
                                owner=owner,
                                repo=repo_name,
                                htmlUrl=gh_item.get('html_url', ''),
                                state=gh_item['state'],
                                isPR=is_pr
                            )
                            item_dict = new_item.model_dump()
                            item_dict['createdAt'] = item_dict['createdAt'].isoformat()
                            await db.issues.insert_one(item_dict)
                            logger.info(f"Imported new {'PR' if is_pr else 'issue'} #{gh_item['number']} from {repo_full_name}")
                except Exception as e:
                    logger.warning(f"Failed to sync {repo_full_name}: {e}")
                    continue
    except Exception as e:
        logger.error(f"GitHub sync error: {e}")
    
    # Only fetch open issues and PRs
    issues = await db.issues.find({
        "repoId": {"$in": repo_ids},
        "state": "open"
    }, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    for issue in issues:
        triage = await db.triage_data.find_one({"issueId": issue['id']}, {"_id": 0})
        issue['triage'] = triage
    return issues


@router.get("/maintainer/metrics")
async def get_metrics(user: dict = Depends(require_maintainer)):
    """Get analytics metrics for maintainer's repositories."""
    repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
    repo_ids = [r['id'] for r in repos]
    all_issues = await db.issues.find({"repoId": {"$in": repo_ids}}, {"_id": 0}).to_list(1000)
    
    classification_counts = {}
    sentiment_counts = {}
    for issue in all_issues:
        triage = await db.triage_data.find_one({"issueId": issue['id']}, {"_id": 0})
        if triage:
            classification = triage.get('classification', 'NEEDS_INFO')
            sentiment = triage.get('sentiment', 'NEUTRAL')
            classification_counts[classification] = classification_counts.get(classification, 0) + 1
            sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
    
    issues_by_classification = [
        {"name": k.replace('_', ' ').title(), "value": v}
        for k, v in classification_counts.items()
    ]
    sentiment_distribution = [
        {"name": k.title(), "value": v}
        for k, v in sentiment_counts.items()
    ]
    
    issues_by_day = []
    today = datetime.now(timezone.utc)
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        count = sum(1 for issue in all_issues if issue.get('createdAt', '').startswith(day_str))
        issues_by_day.append({"date": day_str, "count": count})
    
    return {
        "issuesByDay": issues_by_day,
        "issuesByClassification": issues_by_classification if issues_by_classification else [{"name": "No Data", "value": 1}],
        "sentimentDistribution": sentiment_distribution if sentiment_distribution else [{"name": "No Data", "value": 1}]
    }


@router.get("/maintainer/templates")
async def get_templates(user: dict = Depends(require_maintainer)):
    """Get all templates for the maintainer."""
    templates = await db.templates.find({"ownerId": user['id']}, {"_id": 0}).to_list(1000)
    return templates


@router.post("/maintainer/templates")
async def create_template(request: CreateTemplateRequest, user: dict = Depends(require_maintainer)):
    """Create a new response template."""
    template = Template(
        name=request.name,
        body=request.body,
        ownerId=user['id'],
        triggerClassification=request.triggerClassification
    )
    template_dict = template.model_dump()
    template_dict['createdAt'] = template_dict['createdAt'].isoformat()
    await db.templates.insert_one(template_dict)
    return template_dict


@router.put("/maintainer/templates/{template_id}")
async def update_template(template_id: str, request: UpdateTemplateRequest, user: dict = Depends(require_maintainer)):
    """Update an existing template."""
    update_data = {k: v for k, v in request.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.templates.update_one(
        {"id": template_id, "ownerId": user['id']},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    return template


@router.delete("/maintainer/templates/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(require_maintainer)):
    """Delete a template."""
    result = await db.templates.delete_one({"id": template_id, "ownerId": user['id']})    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}


@router.post("/maintainer/action/reply")
async def reply_to_issue(request: ReplyRequest, user: dict = Depends(require_maintainer)):
    """Reply to an issue by posting a comment on GitHub."""
    try:
        # Fetch the issue from database
        issue = await db.issues.find_one({"id": request.issueId}, {"_id": 0})
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found")
        
        # Validate issue has required GitHub metadata
        if not issue.get('owner') or not issue.get('repo') or not issue.get('number'):
            raise HTTPException(
                status_code=400, 
                detail="Issue missing GitHub metadata (owner, repo, or number)"
            )
        
        # Get user's GitHub access token
        user_doc = await db.users.find_one({"id": user['id']}, {"_id": 0})
        if not user_doc or not user_doc.get('githubAccessToken'):
            raise HTTPException(
                status_code=400,
                detail="GitHub access token not found. Please reconnect your GitHub account."
            )
        
        # Post comment to GitHub
        comment_result = await github_service.comment_on_issue(
            github_access_token=user_doc['githubAccessToken'],
            owner=issue['owner'],
            repo=issue['repo'],
            issue_number=issue['number'],
            comment_text=request.message
        )
        
        logger.info(f"Posted comment to issue #{issue['number']} in {issue['owner']}/{issue['repo']}")
        
        return {
            "message": "Reply posted successfully",
            "commentId": comment_result.get('id'),
            "commentUrl": comment_result.get('html_url'),
            "createdAt": comment_result.get('created_at')
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error posting reply to issue {request.issueId}: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/maintainer/issues/{issue_id}/comments")
async def get_issue_comments(issue_id: str, user: dict = Depends(require_maintainer)):
    """Fetch all comments for a GitHub issue."""
    try:
        # Fetch the issue from database
        issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found")
        
        # Validate issue has required GitHub metadata
        if not issue.get('owner') or not issue.get('repo') or not issue.get('number'):
            raise HTTPException(
                status_code=400,
                detail="Issue missing GitHub metadata (owner, repo, or number)"
            )
        
        # Get user's GitHub access token
        user_doc = await db.users.find_one({"id": user['id']}, {"_id": 0})
        if not user_doc or not user_doc.get('githubAccessToken'):
            raise HTTPException(
                status_code=400,
                detail="GitHub access token not found. Please reconnect your GitHub account."
            )
        
        # Fetch comments from GitHub
        comments = await github_service.fetch_issue_comments(
            github_access_token=user_doc['githubAccessToken'],
            owner=issue['owner'],
            repo=issue['repo'],
            issue_number=issue['number']
        )
        
        return {
            "issueId": issue_id,
            "comments": comments
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching comments for issue {issue_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# GitHub API endpoints
@router.post("/maintainer/github/repos")
async def fetch_repos(request: FetchReposRequest, user: dict = Depends(require_maintainer)):
    """Fetch repositories where user has maintainer permissions."""
    try:
        repos = await github_service.fetch_maintainer_repos(
            request.githubAccessToken,
            request.existingRepos
        )
        return {"repos": repos}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching repos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/maintainer/github/prs")
async def fetch_prs(request: FetchPRsRequest, user: dict = Depends(require_maintainer)):
    """Fetch unmerged pull requests for a repository."""
    try:
        prs = await github_service.fetch_unmerged_pull_requests(
            request.githubAccessToken,
            request.owner,
            request.repo
        )
        return {"pullRequests": prs}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching PRs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/maintainer/github/comment")
async def comment_on_pr(request: CommentOnPRRequest, user: dict = Depends(require_maintainer)):
    """Post a comment on a pull request."""
    try:
        result = await github_service.comment_on_pull_request(
            request.githubAccessToken,
            request.owner,
            request.repo,
            request.prNumber,
            request.commentText
        )
        return {"message": "Comment posted successfully", "comment": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error commenting on PR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
