import asyncio
from config.database import db

async def check_database():
    """Check database collections and counts."""
    print("🔍 OpenTriage Database Status\n")
    print("=" * 50)
    
    # Get all collections
    collections = await db.list_collection_names()
    print(f"\n📦 Collections: {len(collections)}")
    print("-" * 50)
    
    for collection_name in collections:
        count = await db[collection_name].count_documents({})
        print(f"  • {collection_name}: {count} documents")
    
    print("\n" + "=" * 50)
    print("\n✅ Database check complete!")

if __name__ == "__main__":
    asyncio.run(check_database())
