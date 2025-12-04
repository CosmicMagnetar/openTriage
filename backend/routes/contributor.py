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
    
    logger.info(f"Fetching latest issues for {user['username']} from GitHub API...")
    data = await github_service.fetch_user_activity(user['username'])
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
