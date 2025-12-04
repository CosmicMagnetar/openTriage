"""
Sync all data from GitHub to database.
This script fetches all issues and PRs for all repositories and users.
"""
import asyncio
import logging
from config.database import db
from services.github_service import github_service
from models.issue import Issue
from models.triage import IssueTriageData, Classification, Sentiment
from services.ai_service import ai_triage_service

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def classify_and_store(issue: Issue):
    """Classify an issue using AI and store the result."""
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
        
        # Check if already exists
        existing = await db.triage_data.find_one({"issueId": issue.id}, {"_id": 0})
        if existing:
            await db.triage_data.update_one(
                {"issueId": issue.id},
                {"$set": triage_dict}
            )
            logger.info(f"Updated triage for {'PR' if issue.isPR else 'Issue'} {issue.number}")
        else:
            await db.triage_data.insert_one(triage_dict)
            logger.info(f"Created triage for {'PR' if issue.isPR else 'Issue'} {issue.number}")
    except Exception as e:
        logger.error(f"Classification error for issue {issue.number}: {e}")


async def sync_repository_data(repo, github_token):
    """Sync all issues and PRs for a single repository."""
    repo_full_name = repo.get('name')
    if not repo_full_name or '/' not in repo_full_name:
        logger.warning(f"Invalid repo name: {repo_full_name}")
        return
    
    try:
        owner, repo_name = repo_full_name.split('/')
        logger.info(f"Syncing {repo_full_name}...")
        
        # Fetch from GitHub
        data = await github_service.fetch_repo_issues(repo_full_name, github_token)
        logger.info(f"Fetched {len(data['issues'])} issues and {len(data['prs'])} PRs from GitHub")
        
        # Process issues
        for gh_item in data.get('issues', []):
            try:
                existing = await db.issues.find_one(
                    {"githubIssueId": gh_item['id']},
                    {"_id": 0}
                )
                
                if existing:
                    # Update existing
                    await db.issues.update_one(
                        {"githubIssueId": gh_item['id']},
                        {"$set": {
                            "title": gh_item['title'],
                            "body": gh_item.get('body') or '',
                            "state": gh_item['state'],
                            "htmlUrl": gh_item.get('html_url', '')
                        }}
                    )
                    logger.info(f"Updated issue #{gh_item['number']}")
                else:
                    # Create new
                    issue = Issue(
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
                        isPR=False
                    )
                    issue_dict = issue.model_dump()
                    issue_dict['createdAt'] = issue_dict['createdAt'].isoformat()
                    await db.issues.insert_one(issue_dict)
                    logger.info(f"Imported new issue #{gh_item['number']}")
                    
                    # Classify in background
                    asyncio.create_task(classify_and_store(issue))
            except Exception as e:
                logger.error(f"Error processing issue #{gh_item.get('number', 'unknown')}: {e}")
        
        # Process PRs
        for gh_item in data.get('prs', []):
            try:
                existing = await db.issues.find_one(
                    {"githubIssueId": gh_item['id']},
                    {"_id": 0}
                )
                
                if existing:
                    # Update existing
                    await db.issues.update_one(
                        {"githubIssueId": gh_item['id']},
                        {"$set": {
                            "title": gh_item['title'],
                            "body": gh_item.get('body') or '',
                            "state": gh_item['state'],
                            "htmlUrl": gh_item.get('html_url', '')
                        }}
                    )
                    logger.info(f"Updated PR #{gh_item['number']}")
                else:
                    # Create new
                    pr = Issue(
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
                        isPR=True
                    )
                    pr_dict = pr.model_dump()
                    pr_dict['createdAt'] = pr_dict['createdAt'].isoformat()
                    await db.issues.insert_one(pr_dict)
                    logger.info(f"Imported new PR #{gh_item['number']}")
                    
                    # Classify in background
                    asyncio.create_task(classify_and_store(pr))
            except Exception as e:
                logger.error(f"Error processing PR #{gh_item.get('number', 'unknown')}: {e}")
        
        logger.info(f"✓ Completed sync for {repo_full_name}")
    except Exception as e:
        logger.error(f"Failed to sync {repo_full_name}: {e}")


async def sync_user_activity(user, github_token):
    """Sync all issues and PRs created by a user."""
    username = user.get('username')
    if not username:
        logger.warning(f"User {user.get('id')} has no username")
        return
    
    try:
        logger.info(f"Syncing activity for user {username}...")
        
        # Fetch from GitHub
        data = await github_service.fetch_user_activity(username, github_token)
        logger.info(f"Fetched {len(data['issues'])} issues and {len(data['prs'])} PRs for {username}")
        
        # Process issues
        for gh_issue in data.get('issues', []):
            try:
                repo_url_parts = gh_issue.get('repository_url', '').split('/')
                repo_name = f"{repo_url_parts[-2]}/{repo_url_parts[-1]}" if len(repo_url_parts) >= 2 else "unknown/unknown"
                owner, repo = repo_name.split('/') if '/' in repo_name else ('unknown', 'unknown')
                
                existing = await db.issues.find_one(
                    {"githubIssueId": gh_issue['id']},
                    {"_id": 0}
                )
                
                if existing:
                    # Update existing
                    await db.issues.update_one(
                        {"githubIssueId": gh_issue['id']},
                        {"$set": {
                            "title": gh_issue['title'],
                            "body": gh_issue.get('body') or '',
                            "state": gh_issue['state'],
                            "htmlUrl": gh_issue.get('html_url', '')
                        }}
                    )
                    logger.info(f"Updated issue #{gh_issue['number']} from {repo_name}")
                else:
                    # Create new
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
                    await db.issues.insert_one(issue_dict)
                    logger.info(f"Imported new issue #{gh_issue['number']} from {repo_name}")
                    
                    # Classify in background
                    asyncio.create_task(classify_and_store(issue))
            except Exception as e:
                logger.error(f"Error processing issue: {e}")
        
        # Process PRs
        for gh_pr in data.get('prs', []):
            try:
                repo_url_parts = gh_pr.get('repository_url', '').split('/')
                repo_name = f"{repo_url_parts[-2]}/{repo_url_parts[-1]}" if len(repo_url_parts) >= 2 else "unknown/unknown"
                owner, repo = repo_name.split('/') if '/' in repo_name else ('unknown', 'unknown')
                
                existing = await db.issues.find_one(
                    {"githubIssueId": gh_pr['id']},
                    {"_id": 0}
                )
                
                if existing:
                    # Update existing
                    await db.issues.update_one(
                        {"githubIssueId": gh_pr['id']},
                        {"$set": {
                            "title": gh_pr['title'],
                            "body": gh_pr.get('body') or '',
                            "state": gh_pr['state'],
                            "htmlUrl": gh_pr.get('html_url', '')
                        }}
                    )
                    logger.info(f"Updated PR #{gh_pr['number']} from {repo_name}")
                else:
                    # Create new
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
                    await db.issues.insert_one(pr_dict)
                    logger.info(f"Imported new PR #{gh_pr['number']} from {repo_name}")
                    
                    # Classify in background
                    asyncio.create_task(classify_and_store(pr))
            except Exception as e:
                logger.error(f"Error processing PR: {e}")
        
        logger.info(f"✓ Completed sync for user {username}")
    except Exception as e:
        logger.error(f"Failed to sync user {username}: {e}")


async def main():
    """Main sync function."""
    logger.info("=" * 60)
    logger.info("Starting full data sync from GitHub...")
    logger.info("=" * 60)
    
    # Get all users
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    logger.info(f"Found {len(users)} users")
    
    # Get all repositories
    repos = await db.repositories.find({}, {"_id": 0}).to_list(1000)
    logger.info(f"Found {len(repos)} repositories")
    
    # Sync all repositories
    logger.info("\n" + "=" * 60)
    logger.info("SYNCING REPOSITORIES")
    logger.info("=" * 60)
    for repo in repos:
        # Get the owner's GitHub token
        user = await db.users.find_one({"id": repo.get('userId')}, {"_id": 0})
        github_token = user.get('githubAccessToken') if user else None
        
        if not github_token:
            logger.warning(f"No GitHub token for repo {repo.get('name')}, skipping...")
            continue
        
        await sync_repository_data(repo, github_token)
        await asyncio.sleep(0.5)  # Rate limiting
    
    # Sync all user activities
    logger.info("\n" + "=" * 60)
    logger.info("SYNCING USER ACTIVITIES")
    logger.info("=" * 60)
    for user in users:
        github_token = user.get('githubAccessToken')
        if not github_token:
            logger.warning(f"No GitHub token for user {user.get('username')}, skipping...")
            continue
        
        await sync_user_activity(user, github_token)
        await asyncio.sleep(0.5)  # Rate limiting
    
    # Wait for background tasks to complete
    logger.info("\n" + "=" * 60)
    logger.info("Waiting for AI classification tasks to complete...")
    logger.info("=" * 60)
    await asyncio.sleep(5)
    
    # Print summary
    total_issues = await db.issues.count_documents({"isPR": False})
    total_prs = await db.issues.count_documents({"isPR": True})
    total_triage = await db.triage_data.count_documents({})
    
    logger.info("\n" + "=" * 60)
    logger.info("SYNC COMPLETE!")
    logger.info("=" * 60)
    logger.info(f"Total Issues in DB: {total_issues}")
    logger.info(f"Total PRs in DB: {total_prs}")
    logger.info(f"Total Triage Data: {total_triage}")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
