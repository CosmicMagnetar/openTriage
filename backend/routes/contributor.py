from fastapi import APIRouter, Depends
import asyncio
import logging
from config.database import db
from utils.dependencies import get_current_user
from services.github_service import github_service
from models.issue import Issue
from models.triage import IssueTriageData, Classification, Sentiment
from services.ai_service import ai_triage_service

logger = logging.getLogger(__name__)
router = APIRouter()


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


@router.get("/contributor/dashboard-summary")
async def get_contributor_dashboard_summary(user: dict = Depends(get_current_user)):
    """Get dashboard summary statistics for contributor."""
    # Get all issues/PRs by this contributor
    all_items = await db.issues.find({"authorName": user['username']}, {"_id": 0}).to_list(1000)
    
    # Calculate metrics
    total_contributions = len(all_items)
    prs = [item for item in all_items if item.get('isPR')]
    issues = [item for item in all_items if not item.get('isPR')]
    
    open_prs = len([pr for pr in prs if pr.get('state') == 'open'])
    merged_prs = len([pr for pr in prs if pr.get('state') == 'closed'])  # Closed PRs are typically merged
    
    open_issues = len([issue for issue in issues if issue.get('state') == 'open'])
    closed_issues = len([issue for issue in issues if issue.get('state') == 'closed'])
    
    # Get unique repositories contributed to
    unique_repos = len(set(item.get('repoName', '') for item in all_items if item.get('repoName')))
    
    return {
        "totalContributions": total_contributions,
        "totalPRs": len(prs),
        "openPRs": open_prs,
        "mergedPRs": merged_prs,
        "totalIssues": len(issues),
        "openIssues": open_issues,
        "closedIssues": closed_issues,
        "repositoriesContributed": unique_repos
    }


@router.get("/contributor/my-issues")
async def get_my_issues(user: dict = Depends(get_current_user)):
    """Get all issues and PRs created by the contributor."""
    issues = await db.issues.find({"authorName": user['username']}, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    logger.info(f"Found {len(issues)} issues in DB for {user['username']}")
    
    # Get user's GitHub access token for authenticated requests
    user_doc = await db.users.find_one({"id": user['id']}, {"_id": 0})
    github_token = user_doc.get('githubAccessToken') if user_doc else None
    
    logger.info(f"Fetching latest issues for {user['username']} from GitHub API...")
    data = await github_service.fetch_user_activity(user['username'], github_token)
    logger.info(f"GitHub API returned {len(data['issues'])} issues and {len(data['prs'])} PRs")
    
    # Import new issues
    for gh_issue in data['issues']:
        try:
            repo_url_parts = gh_issue.get('repository_url', '').split('/')
            repo_name = f"{repo_url_parts[-2]}/{repo_url_parts[-1]}" if len(repo_url_parts) >= 2 else "unknown/unknown"
            owner, repo = repo_name.split('/') if '/' in repo_name else ('unknown', 'unknown')
            
            issue = Issue(
                githubIssueId=gh_issue['id'],
                number=gh_issue['number'],
                title=gh_issue['title'],
                body=gh_issue.get('body') or '',
                authorName=gh_issue['user']['login'],
                repoId="external",
                repoName=repo_name,
                owner=owner,
                repo=repo,
                htmlUrl=gh_issue.get('html_url', ''),
                state=gh_issue['state'],
                isPR=False
            )
            issue_dict = issue.model_dump()
            issue_dict['createdAt'] = issue_dict['createdAt'].isoformat()
            existing = await db.issues.find_one({"githubIssueId": issue.githubIssueId}, {"_id": 0})
            if existing:
                # Update existing issue with latest metadata
                await db.issues.update_one(
                    {"githubIssueId": issue.githubIssueId},
                    {"$set": {
                        "title": gh_issue['title'],
                        "body": gh_issue.get('body') or '',
                        "state": gh_issue['state'],
                        "htmlUrl": gh_issue.get('html_url', '')
                    }},
                    upsert=False
                )
            else:
                await db.issues.insert_one(issue_dict)
                asyncio.create_task(classify_and_store(issue))
                logger.info(f"Imported new issue #{issue.number} from {repo_name}")
        except Exception as e:
            logger.error(f"Error importing issue: {e}")
            continue
    
    # Import new PRs
    for gh_pr in data['prs']:
        try:
            repo_url_parts = gh_pr.get('repository_url', '').split('/')
            repo_name = f"{repo_url_parts[-2]}/{repo_url_parts[-1]}" if len(repo_url_parts) >= 2 else "unknown/unknown"
            owner, repo = repo_name.split('/') if '/' in repo_name else ('unknown', 'unknown')
            
            pr = Issue(
                githubIssueId=gh_pr['id'],
                number=gh_pr['number'],
                title=gh_pr['title'],
                body=gh_pr.get('body') or '',
                authorName=gh_pr['user']['login'],
                repoId="external",
                repoName=repo_name,
                owner=owner,
                repo=repo,
                htmlUrl=gh_pr.get('html_url', ''),
                state=gh_pr['state'],
                isPR=True
            )
            pr_dict = pr.model_dump()
            pr_dict['createdAt'] = pr_dict['createdAt'].isoformat()
            existing = await db.issues.find_one({"githubIssueId": pr.githubIssueId}, {"_id": 0})
            if existing:
                # Update existing PR with latest metadata
                await db.issues.update_one(
                    {"githubIssueId": pr.githubIssueId},
                    {"$set": {
                        "title": gh_pr['title'],
                        "body": gh_pr.get('body') or '',
                        "state": gh_pr['state'],
                        "htmlUrl": gh_pr.get('html_url', '')
                    }},
                    upsert=False
                )
            else:
                await db.issues.insert_one(pr_dict)
                asyncio.create_task(classify_and_store(pr))
                logger.info(f"Imported new PR #{pr.number} from {repo_name}")
        except Exception as e:
            logger.error(f"Error importing PR: {e}")
            continue
    
    # Fetch all issues with triage data
    issues = await db.issues.find({"authorName": user['username']}, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    for issue in issues:
        triage = await db.triage_data.find_one({"issueId": issue['id']}, {"_id": 0})
        issue['triage'] = triage
    
    logger.info(f"Returning {len(issues)} total issues/PRs for {user['username']}")
    return issues


# Pydantic models for request bodies
from pydantic import BaseModel
from typing import Optional


class ContributorReplyRequest(BaseModel):
    issueId: str
    message: str


class ContributorSuggestReplyRequest(BaseModel):
    issueTitle: str
    issueBody: Optional[str] = ""
    context: str
    suggestionType: str = "clarify"  # 'clarify', 'update', 'thank', 'question'


from fastapi import HTTPException


@router.post("/contributor/action/reply")
async def contributor_reply_to_issue(request: ContributorReplyRequest, user: dict = Depends(get_current_user)):
    """Reply to an issue by posting a comment on GitHub (contributor version)."""
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
        
        logger.info(f"Contributor {user['username']} posted comment to issue #{issue['number']} in {issue['owner']}/{issue['repo']}")
        
        return {
            "message": "Reply posted successfully",
            "commentId": comment_result.get('id'),
            "commentUrl": comment_result.get('html_url'),
            "createdAt": comment_result.get('created_at')
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error posting contributor reply to issue {request.issueId}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contributor/issues/{issue_id}/comments")
async def get_contributor_issue_comments(issue_id: str, user: dict = Depends(get_current_user)):
    """Fetch all comments for a GitHub issue (contributor version)."""
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


@router.post("/contributor/suggest-reply")
async def suggest_contributor_reply(request: ContributorSuggestReplyRequest, user: dict = Depends(get_current_user)):
    """Generate an AI-suggested reply for a contributor (friendly, learning-focused tone)."""
    try:
        from services.ai_service import ai_chat_service
        suggestion = await ai_chat_service.generate_contributor_reply_suggestion(
            issue_title=request.issueTitle,
            issue_body=request.issueBody or "",
            context=request.context,
            suggestion_type=request.suggestionType
        )
        
        return {"suggestion": suggestion}
        
    except Exception as e:
        logger.error(f"Error generating contributor reply suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))
