import asyncio
from config.database import db

async def fix_pr_metadata():
    """Fix PR #943 metadata for quick reply."""
    print("🔧 Fixing PR Metadata\n")
    print("=" * 60)
    
    # Find PR #943
    pr = await db.issues.find_one({"number": 943, "isPR": True}, {"_id": 0})
    
    if not pr:
        print("❌ PR #943 not found")
        return
    
    print(f"📋 Current PR #943 metadata:")
    print(f"   Title: {pr.get('title')}")
    print(f"   Owner: {pr.get('owner')}")
    print(f"   Repo: {pr.get('repo')}")
    print(f"   Number: {pr.get('number')}")
    print(f"   RepoName: {pr.get('repoName')}")
    
    # Update with correct metadata
    update_data = {
        "owner": "DhanushNehru",
        "repo": "Hacktoberfest2025",
        "number": 943,
        "htmlUrl": "https://github.com/DhanushNehru/Hacktoberfest2025/pull/943"
    }
    
    await db.issues.update_one(
        {"id": pr['id']},
        {"$set": update_data}
    )
    
    print(f"\n✅ Updated PR #943 with correct metadata:")
    print(f"   Owner: {update_data['owner']}")
    print(f"   Repo: {update_data['repo']}")
    print(f"   Number: {update_data['number']}")
    print(f"   URL: {update_data['htmlUrl']}")
    
    print("\n" + "=" * 60)
    print("\n💡 Quick Reply should now work for this PR!")

if __name__ == "__main__":
    asyncio.run(fix_pr_metadata())
