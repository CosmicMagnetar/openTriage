"""
Quick script to check database contents.
"""
import asyncio
from config.database import db


async def main():
    print("=" * 60)
    print("DATABASE CONTENTS")
    print("=" * 60)
    
    # Count documents
    users_count = await db.users.count_documents({})
    repos_count = await db.repositories.count_documents({})
    issues_count = await db.issues.count_documents({"isPR": False})
    prs_count = await db.issues.count_documents({"isPR": True})
    open_issues = await db.issues.count_documents({"isPR": False, "state": "open"})
    open_prs = await db.issues.count_documents({"isPR": True, "state": "open"})
    triage_count = await db.triage_data.count_documents({})
    
    print(f"\nUsers: {users_count}")
    print(f"Repositories: {repos_count}")
    print(f"Issues: {issues_count} (Open: {open_issues})")
    print(f"PRs: {prs_count} (Open: {open_prs})")
    print(f"Triage Data: {triage_count}")
    
    # Show sample issues
    print("\n" + "=" * 60)
    print("SAMPLE ISSUES (First 5)")
    print("=" * 60)
    issues = await db.issues.find({"isPR": False}, {"_id": 0}).limit(5).to_list(5)
    for issue in issues:
        print(f"\n#{issue.get('number')} - {issue.get('title')}")
        print(f"  Repo: {issue.get('repoName')}")
        print(f"  State: {issue.get('state')}")
        print(f"  Author: {issue.get('authorName')}")
    
    # Show sample PRs
    print("\n" + "=" * 60)
    print("SAMPLE PRs (First 5)")
    print("=" * 60)
    prs = await db.issues.find({"isPR": True}, {"_id": 0}).limit(5).to_list(5)
    for pr in prs:
        print(f"\n#{pr.get('number')} - {pr.get('title')}")
        print(f"  Repo: {pr.get('repoName')}")
        print(f"  State: {pr.get('state')}")
        print(f"  Author: {pr.get('authorName')}")
    
    # Show repositories
    print("\n" + "=" * 60)
    print("REPOSITORIES")
    print("=" * 60)
    repos = await db.repositories.find({}, {"_id": 0}).to_list(100)
    for repo in repos:
        print(f"  - {repo.get('name')}")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
