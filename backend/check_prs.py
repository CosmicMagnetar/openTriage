import asyncio
from config.database import db

async def check_prs():
    """Check PR status in database."""
    print("🔍 Checking PRs in Database\n")
    print("=" * 60)
    
    # Get all PRs
    all_prs = await db.issues.find({"isPR": True}, {"_id": 0}).to_list(1000)
    print(f"\n📊 Total PRs in database: {len(all_prs)}")
    
    # Count by state
    open_prs = [pr for pr in all_prs if pr.get('state') == 'open']
    closed_prs = [pr for pr in all_prs if pr.get('state') == 'closed']
    
    print(f"  • Open PRs: {len(open_prs)}")
    print(f"  • Closed PRs: {len(closed_prs)}")
    
    print("\n" + "-" * 60)
    
    if open_prs:
        print("\n✅ Open PRs:")
        for pr in open_prs[:5]:  # Show first 5
            print(f"  • PR #{pr.get('number')}: {pr.get('title')[:50]}")
            print(f"    Repo: {pr.get('repoName')}, State: {pr.get('state')}")
    else:
        print("\n⚠️  No open PRs found in database")
        print("   This could mean:")
        print("   1. All PRs in your repos are closed/merged")
        print("   2. PRs haven't been imported yet")
        print("   3. Repository import is needed")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(check_prs())
