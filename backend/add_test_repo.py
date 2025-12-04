import asyncio
from config.database import db
from models.repository import Repository
from datetime import datetime

async def add_test_repo():
    """Add a test repository with open PRs."""
    print("🔧 Adding Test Repository with Open PRs\n")
    print("=" * 60)
    
    # Get the maintainer user
    maintainer = await db.users.find_one({"username": "CosmicMagnetar"}, {"_id": 0})
    
    if not maintainer:
        print("❌ Maintainer user not found")
        return
    
    # Check if repo already exists
    existing = await db.repositories.find_one({
        "name": "DhanushNehru/Hacktoberfest2025",
        "userId": maintainer['id']
    }, {"_id": 0})
    
    if existing:
        print("✅ Repository already tracked!")
        print(f"   Repo: {existing['name']}")
    else:
        # Add the repository
        repo = Repository(
            githubRepoId=999999999,  # Dummy ID
            name="DhanushNehru/Hacktoberfest2025",
            owner="DhanushNehru",
            userId=maintainer['id']
        )
        
        repo_dict = repo.model_dump()
        repo_dict['createdAt'] = repo_dict['createdAt'].isoformat()
        
        await db.repositories.insert_one(repo_dict)
        print("✅ Added test repository!")
        print(f"   Repo: {repo.name}")
        
        # Update the PR to belong to this repo
        pr = await db.issues.find_one({"number": 943, "isPR": True}, {"_id": 0})
        if pr:
            await db.issues.update_one(
                {"id": pr['id']},
                {"$set": {"repoId": repo.id}}
            )
            print(f"✅ Linked PR #{pr['number']} to this repository")
    
    # Check results
    repos = await db.repositories.find({"userId": maintainer['id']}, {"_id": 0}).to_list(100)
    repo_ids = [r['id'] for r in repos]
    
    open_prs = await db.issues.find({
        "repoId": {"$in": repo_ids},
        "isPR": True,
        "state": "open"
    }, {"_id": 0}).to_list(100)
    
    print(f"\n📊 Results:")
    print(f"   Tracked repos: {len(repos)}")
    print(f"   Open PRs in tracked repos: {len(open_prs)}")
    
    if open_prs:
        print("\n✅ Open PRs you'll now see:")
        for pr in open_prs:
            print(f"   • PR #{pr.get('number')}: {pr.get('title')[:50]}")
    
    print("\n" + "=" * 60)
    print("\n💡 Now refresh your browser to see the PR!")

if __name__ == "__main__":
    asyncio.run(add_test_repo())
