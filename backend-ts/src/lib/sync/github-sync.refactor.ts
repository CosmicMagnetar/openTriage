/**
 * REFACTORED: Sync Engine Enhancement
 *
 * This snippet shows the enhanced reconciliation logic with SHA/updated_at checking.
 * Replace the existing reconciliation section in syncRepository() with this.
 *
 * KEY IMPROVEMENT:
 * - Before expensive field-level comparisons, check GitHub's updated_at timestamp
 * - If the timestamp hasn't changed, skip the update entirely
 * - For PRs, also track headSha to detect force-pushes
 */

export {};

/*
// ============================================================================
// Enhanced Reconciliation: SHA/Updated_at Checks (REFACTORED)
// ============================================================================

// In the process open items loop, replace the update logic with this:

for (const ghItem of openItems) {
    openNumbers.add(ghItem.number);
    checkMentorStatus(ghItem);
    
    if (!shouldIncludeItem(ghItem)) {
        continue;
    }
    
    const isPR = !!ghItem.pull_request;
    const existingIssue = dbIssuesByNumber.get(ghItem.number);

    if (existingIssue) {
        // ✅ REFACTORED: Skip update if GitHub's updated_at hasn't changed
        const ghUpdatedAt = ghItem.updated_at;
        const dbUpdatedAt = existingIssue.updatedAt;
        
        // For PRs, also check the head SHA for force-push detection
        const ghHeadSha = isPR ? ghItem.pull_request?.head?.sha : null;
        const dbHeadSha = existingIssue.headSha;
        
        // If the item hasn't been updated on GitHub and SHA is the same, skip entirely
        const isSameTimestamp = ghUpdatedAt && dbUpdatedAt && 
            new Date(ghUpdatedAt).getTime() === new Date(dbUpdatedAt).getTime();
        const isSameSha = !isPR || (ghHeadSha === dbHeadSha);
        
        if (isSameTimestamp && isSameSha) {
            console.log(`[Sync] ${repoName}#${ghItem.number}: Skipped (no changes on GitHub)`);
            continue;  // ✅ Skip this item entirely
        }
        
        // Only update if actual field changes detected
        if (existingIssue.state !== ghItem.state ||
            existingIssue.title !== ghItem.title ||
            existingIssue.authorAssociation !== ghItem.author_association ||
            ghHeadSha !== dbHeadSha) {  // Force-push detected
            
            // Generate body summary if body changed
            const newBodySummary = ghItem.body 
                ? ghItem.body.substring(0, 200) 
                : existingIssue.bodySummary;
            
            await db.update(issues)
                .set({
                    state: ghItem.state,
                    title: ghItem.title,
                    body: ghItem.body || null,
                    bodySummary: newBodySummary,
                    authorAssociation: ghItem.author_association,
                    headSha: ghHeadSha,  // Track SHA for PRs
                    updatedAt: ghUpdatedAt || new Date().toISOString(),
                })
                .where(eq(issues.id, existingIssue.id));
            updated++;

            if (isAblyConfigured()) {
                await publishIssueUpdated({
                    id: existingIssue.id,
                    githubIssueId: ghItem.id,
                    number: ghItem.number,
                    title: ghItem.title,
                    repoName,
                    owner,
                    repo,
                    isPR,
                    state: ghItem.state,
                });
            }
        }
    } else {
        // Create new issue with all fields populated
        const newId = uuidv4();
        const bodySummary = ghItem.body 
            ? ghItem.body.substring(0, 200) 
            : null;
        
        await db.insert(issues).values({
            id: newId,
            githubIssueId: ghItem.id,
            number: ghItem.number,
            title: ghItem.title,
            body: ghItem.body || null,
            bodySummary,
            authorName: ghItem.user.login,
            repoId,
            repoName,
            owner,
            repo,
            htmlUrl: ghItem.html_url,
            state: ghItem.state,
            isPR,
            authorAssociation: ghItem.author_association,
            headSha: isPR ? ghItem.pull_request?.head?.sha : null,
            updatedAt: ghItem.updated_at || new Date().toISOString(),
            createdAt: new Date().toISOString(),
        }).onConflictDoNothing();
        created++;

        if (isAblyConfigured()) {
            await publishIssueCreated({
                id: newId,
                githubIssueId: ghItem.id,
                number: ghItem.number,
                title: ghItem.title,
                repoName,
                owner,
                repo,
                isPR,
                state: ghItem.state,
            });
        }
    }
}
*/
