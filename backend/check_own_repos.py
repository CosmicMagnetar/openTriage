import asyncio
from config.database import db

async def setup_own_repo():
    """Setup user's own repository for testing."""
    print("🔧 Setting Up Your Own Repository\n")
    print("=" * 60)
    
    # Get maintainer
    maintainer = await db.users.find_one({"username": "CosmicMagnetar"}, {"_id": 0})
    
    if not maintainer:
        print("❌ User not found")
        return
    
    # Get user's existing repos
    repos = await db.repositories.find({"userId": maintainer['id']}, {"_id": 0}).to_list(100)
    
    print(f"📦 Your tracked repositories:")
    for repo in repos:
        print(f"   • {repo.get('name')}")
        
        # Check for open issues/PRs in this repo
        repo_issues = await db.issues.find({
            "repoId": repo['id'],
            "state": "open"
        }, {"_id": 0}).to_list(100)
        
        issues = [i for i in repo_issues if not i.get('isPR')]
        prs = [i for i in repo_issues if i.get('isPR')]
        
        print(f"     - Open Issues: {len(issues)}")
        print(f"     - Open PRs: {len(prs)}")
        
        if issues:
            print(f"     ✅ You can use Quick Reply on these issues!")
        if prs:
            print(f"     ✅ You can use Quick Reply on these PRs!")
    
    print("\n" + "=" * 60)
    print("\n💡 To test Quick Reply:")
    print("   1. Go to GitHub and create a test issue in one of your repos")
    print("   2. Or create a test PR in one of your repos")
    print("   3. Re-import the repository in OpenTriage")
    print("   4. The issue/PR will appear with Quick Reply enabled")
    print("\n   You can only comment on repositories you have write access to!")

if __name__ == "__main__":
    asyncio.run(setup_own_repo())
