import asyncio
from config.database import db

async def show_contributor_prs():
    """Show PRs for contributor view."""
    print("🔍 Contributor PRs Check\n")
    print("=" * 60)
    
    # Get contributor user
    contributor = await db.users.find_one({"role": "CONTRIBUTOR"}, {"_id": 0})
    
    if contributor:
        print(f"👤 Contributor: {contributor.get('username')}")
        print("-" * 60)
        
        # Get PRs by this contributor
        contributor_prs = await db.issues.find({
            "authorName": contributor.get('username'),
            "isPR": True,
            "state": "open"
        }, {"_id": 0}).to_list(100)
        
        print(f"\n✅ Open PRs by {contributor.get('username')}: {len(contributor_prs)}")
        
        if contributor_prs:
            for pr in contributor_prs:
                print(f"  • PR #{pr.get('number')}: {pr.get('title')[:50]}")
                print(f"    Repo: {pr.get('repoName')}, State: {pr.get('state')}")
        else:
            print("  ⚠️  No open PRs found for this contributor")
    
    print("\n" + "=" * 60)
    
    # Also check what the API would return for contributor
    print("\n📊 All issues/PRs for contributor (what API returns):")
    if contributor:
        all_items = await db.issues.find({
            "authorName": contributor.get('username')
        }, {"_id": 0}).to_list(100)
        
        open_items = [i for i in all_items if i.get('state') == 'open']
        open_prs = [i for i in open_items if i.get('isPR')]
        open_issues = [i for i in open_items if not i.get('isPR')]
        
        print(f"  • Total open items: {len(open_items)}")
        print(f"  • Open PRs: {len(open_prs)}")
        print(f"  • Open Issues: {len(open_issues)}")

if __name__ == "__main__":
    asyncio.run(show_contributor_prs())
