import asyncio
from config.database import db

async def refresh_pr_state():
    """Update PR #1 state to open for testing."""
    print("🔄 Refreshing PR State\n")
    print("=" * 60)
    
    # Find the PR
    pr = await db.issues.find_one({
        "repoName": "CosmicMagnetar/FleXp",
        "number": 1,
        "isPR": True
    }, {"_id": 0})
    
    if not pr:
        print("❌ PR not found")
        return
    
    print(f"📋 Current PR State:")
    print(f"   PR #{pr.get('number')}: {pr.get('title')}")
    print(f"   Current State: {pr.get('state')}")
    print(f"   Author: {pr.get('authorName')}")
    
    # Update to open
    await db.issues.update_one(
        {"id": pr['id']},
        {"$set": {"state": "open"}}
    )
    
    print(f"\n✅ Updated PR state to: open")
    print("\n" + "=" * 60)
    print("\n💡 Refresh your browser to see the PR!")
    print("   Quick Reply should now work on this PR!")

if __name__ == "__main__":
    asyncio.run(refresh_pr_state())
