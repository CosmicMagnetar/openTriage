import asyncio
import httpx
from config.database import db
from services.github_service import github_service

async def reimport_flexp():
    """Re-import FleXp repository to get the latest PR."""
    print("🔄 Re-importing FleXp Repository\n")
    print("=" * 60)
    
    # Get the repository
    repo = await db.repositories.find_one({"name": "CosmicMagnetar/FleXp"}, {"_id": 0})
    
    if not repo:
        print("❌ FleXp repository not found")
        return
    
    print(f"📦 Repository: {repo.get('name')}")
    
    # Fetch latest issues and PRs from GitHub
    try:
        data = await github_service.fetch_repo_issues("CosmicMagnetar/FleXp")
        
        print(f"\n📊 Fetched from GitHub:")
        print(f"   Issues: {len(data.get('issues', []))}")
        print(f"   PRs: {len(data.get('prs', []))}")
        
        # Show PR details
        if data.get('prs'):
            print(f"\n✅ PRs found on GitHub:")
            for pr in data['prs']:
                print(f"   • PR #{pr.get('number')}: {pr.get('title')}")
                print(f"     State: {pr.get('state')}")
                print(f"     Author: {pr.get('user', {}).get('login')}")
                
                # Check if exists in database
                existing = await db.issues.find_one({
                    "githubIssueId": pr.get('id'),
                    "isPR": True
                }, {"_id": 0})
                
                if existing:
                    # Update existing
                    await db.issues.update_one(
                        {"id": existing['id']},
                        {"$set": {
                            "state": pr.get('state'),
                            "title": pr.get('title'),
                            "owner": "CosmicMagnetar",
                            "repo": "FleXp",
                            "number": pr.get('number'),
                            "htmlUrl": pr.get('html_url', '')
                        }}
                    )
                    print(f"     ✅ Updated in database")
                else:
                    # Import new PR
                    from models.issue import Issue
                    new_pr = Issue(
                        githubIssueId=pr.get('id'),
                        number=pr.get('number'),
                        title=pr.get('title'),
                        body=pr.get('body') or '',
                        authorName=pr.get('user', {}).get('login'),
                        repoId=repo['id'],
                        repoName=repo['name'],
                        owner="CosmicMagnetar",
                        repo="FleXp",
                        htmlUrl=pr.get('html_url', ''),
                        state=pr.get('state'),
                        isPR=True
                    )
                    pr_dict = new_pr.model_dump()
                    pr_dict['createdAt'] = pr_dict['createdAt'].isoformat()
                    await db.issues.insert_one(pr_dict)
                    print(f"     ✅ Added to database")
        
        print("\n" + "=" * 60)
        print("\n💡 Refresh your browser to see the updated PRs!")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(reimport_flexp())
