"""
Add CosmicMagnetar/FleXp repository and sync its data.
"""
import asyncio
from config.database import db
from models.repository import Repository
from models.issue import Issue
from services.github_service import github_service
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def main():
    logger.info("Adding CosmicMagnetar/FleXp repository...")
    
    # Get the user
    user = await db.users.find_one({"username": "CosmicMagnetar"}, {"_id": 0})
    if not user:
        logger.error("User CosmicMagnetar not found!")
        return
    
    github_token = user.get('githubAccessToken')
    if not github_token:
        logger.error("No GitHub token for user!")
        return
    
    # Check if repo already exists
    existing = await db.repositories.find_one(
        {"name": "CosmicMagnetar/FleXp", "userId": user['id']},
        {"_id": 0}
    )
    
    if existing:
        logger.info("Repository already exists, will just sync data...")
        repo = existing
    else:
        # Create repository record
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get("https://api.github.com/repos/CosmicMagnetar/FleXp")
            if response.status_code != 200:
                logger.error(f"Repository not found on GitHub: {response.status_code}")
                return
            repo_data = response.json()
        
        repository = Repository(
            githubRepoId=repo_data['id'],
            name="CosmicMagnetar/FleXp",
            owner="CosmicMagnetar",
            userId=user['id']
        )
        repo_dict = repository.model_dump()
        repo_dict['createdAt'] = repo_dict['createdAt'].isoformat()
        await db.repositories.insert_one(repo_dict)
        logger.info("✓ Repository added to database")
        repo = repo_dict
    
    # Sync data
    logger.info("Syncing issues and PRs from GitHub...")
    data = await github_service.fetch_repo_issues("CosmicMagnetar/FleXp", github_token)
    logger.info(f"Fetched {len(data['issues'])} issues and {len(data['prs'])} PRs")
    
    # Process issues
    for gh_item in data.get('issues', []):
        existing = await db.issues.find_one({"githubIssueId": gh_item['id']}, {"_id": 0})
        
        if existing:
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
            issue = Issue(
                githubIssueId=gh_item['id'],
                number=gh_item['number'],
                title=gh_item['title'],
                body=gh_item.get('body') or '',
                authorName=gh_item['user']['login'],
                repoId=repo['id'],
                repoName="CosmicMagnetar/FleXp",
                owner="CosmicMagnetar",
                repo="FleXp",
                htmlUrl=gh_item.get('html_url', ''),
                state=gh_item['state'],
                isPR=False
            )
            issue_dict = issue.model_dump()
            issue_dict['createdAt'] = issue_dict['createdAt'].isoformat()
            await db.issues.insert_one(issue_dict)
            logger.info(f"Imported new issue #{gh_item['number']}")
    
    # Process PRs
    for gh_item in data.get('prs', []):
        existing = await db.issues.find_one({"githubIssueId": gh_item['id']}, {"_id": 0})
        
        if existing:
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
            pr = Issue(
                githubIssueId=gh_item['id'],
                number=gh_item['number'],
                title=gh_item['title'],
                body=gh_item.get('body') or '',
                authorName=gh_item['user']['login'],
                repoId=repo['id'],
                repoName="CosmicMagnetar/FleXp",
                owner="CosmicMagnetar",
                repo="FleXp",
                htmlUrl=gh_item.get('html_url', ''),
                state=gh_item['state'],
                isPR=True
            )
            pr_dict = pr.model_dump()
            pr_dict['createdAt'] = pr_dict['createdAt'].isoformat()
            await db.issues.insert_one(pr_dict)
            logger.info(f"Imported new PR #{gh_item['number']}")
    
    # Show summary
    total_issues = await db.issues.count_documents({"repoName": "CosmicMagnetar/FleXp", "isPR": False})
    total_prs = await db.issues.count_documents({"repoName": "CosmicMagnetar/FleXp", "isPR": True})
    
    logger.info("\n" + "=" * 60)
    logger.info("SYNC COMPLETE!")
    logger.info("=" * 60)
    logger.info(f"Repository: CosmicMagnetar/FleXp")
    logger.info(f"Total Issues: {total_issues}")
    logger.info(f"Total PRs: {total_prs}")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
