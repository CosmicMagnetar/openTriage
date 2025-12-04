import asyncio
from config.database import db

async def check_flexp_prs():
    """Check PRs in FleXp repository."""
    print("🔍 Checking FleXp Repository PRs\n")
    print("=" * 60)
    
    # Find FleXp repo
    flexp_repo = await db.repositories.find_one({"name": "CosmicMagnetar/FleXp"}, {"_id": 0})
    
    if not flexp_repo:
        print("❌ FleXp repository not found in database")
        return
    
    print(f"📦 Repository: {flexp_repo.get('name')}")
    print(f"   Repo ID: {flexp_repo.get('id')}")
    
    # Find all issues/PRs in this repo
    items = await db.issues.find({"repoId": flexp_repo['id']}, {"_id": 0}).to_list(100)
    
    prs = [i for i in items if i.get('isPR')]
    issues = [i for i in items if not i.get('isPR')]
    
    print(f"\n📊 Statistics:")
    print(f"   Total Issues: {len(issues)}")
    print(f"   Total PRs: {len(prs)}")
    
    if prs:
        print(f"\n✅ PRs in FleXp:")
        for pr in prs:
            print(f"\n   PR #{pr.get('number')}: {pr.get('title')}")
            print(f"   Author: {pr.get('authorName')}")
            print(f"   State: {pr.get('state')}")
            print(f"   Owner: {pr.get('owner')}")
            print(f"   Repo: {pr.get('repo')}")
            print(f"   Has metadata: {'✅' if pr.get('owner') and pr.get('repo') else '❌'}")
    else:
        print("\n⚠️  No PRs found in FleXp repository")
        print("   The PR might not have been imported yet")
    
    print("\n" + "=" * 60)
    print("\n💡 If you have a PR in FleXp on GitHub:")
    print("   1. Go to your dashboard")
    print("   2. Remove and re-add the FleXp repository")
    print("   3. This will import the PR with correct metadata")
    print("   4. Quick Reply will then work!")

if __name__ == "__main__":
    asyncio.run(check_flexp_prs())
