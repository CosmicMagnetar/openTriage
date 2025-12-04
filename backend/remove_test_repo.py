import asyncio
from config.database import db

async def remove_test_repo():
    """Remove the test repository."""
    maintainer = await db.users.find_one({"username": "CosmicMagnetar"}, {"_id": 0})
    
    if maintainer:
        result = await db.repositories.delete_one({
            "name": "DhanushNehru/Hacktoberfest2025",
            "userId": maintainer['id']
        })
        
        if result.deleted_count > 0:
            print("✅ Removed test repository")
        else:
            print("ℹ️  Repository not found or already removed")

if __name__ == "__main__":
    asyncio.run(remove_test_repo())
