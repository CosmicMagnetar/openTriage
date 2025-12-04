import asyncio
from config.database import db

async def check_user_prs():
    """Check which PRs belong to user's repositories."""
    print("🔍 Checking User's PRs\n")
    print("=" * 60)
    
    # Get all users
    users = await db.users.find({}, {"_id": 0}).to_list(10)
    
    for user in users:
        print(f"\n👤 User: {user.get('username')} (Role: {user.get('role')})")
        print("-" * 60)
        
        # Get user's repositories
        repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(100)
        print(f"📦 Tracked Repositories: {len(repos)}")
        
        if repos:
            repo_ids = [r['id'] for r in repos]
            for repo in repos:
                print(f"  • {repo.get('name')}")
            
            # Get open PRs for these repos
            open_prs = await db.issues.find({
                "repoId": {"$in": repo_ids},
                "isPR": True,
                "state": "open"
            }, {"_id": 0}).to_list(100)
            
            print(f"\n✅ Open PRs in tracked repos: {len(open_prs)}")
            
            if open_prs:
                for pr in open_prs[:5]:
                    print(f"  • PR #{pr.get('number')}: {pr.get('title')[:50]}")
                    print(f"    Repo: {pr.get('repoName')}")
            else:
                print("  ⚠️  No open PRs found in your tracked repositories")
                print("  💡 Tip: The open PRs might be in other repositories")
        else:
            print("  ⚠️  No repositories tracked yet")
    
    print("\n" + "=" * 60)
    
    # Show all open PRs regardless of user
    all_open_prs = await db.issues.find({
        "isPR": True,
        "state": "open"
    }, {"_id": 0}).to_list(100)
    
    print(f"\n📊 Total Open PRs in Database: {len(all_open_prs)}")
    print("   (These might be from contributor activity, not tracked repos)")

if __name__ == "__main__":
    asyncio.run(check_user_prs())
