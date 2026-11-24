---
name: github-data
description: Add an API route in backend-ts that reads GitHub for the signed-in user, with the right token, caching and errors. Use for any new GitHub-backed endpoint.
---

# GitHub data

## Route pattern
```ts
const gh = await withGitHub(request);          // lib/github/route-helpers.ts
if ("error" in gh) return gh.error;
const data = await cached(`key:${owner}/${repo}`, 5 * MINUTE,
  () => buildSomething(gh.octokit, owner, repo), wantsFresh(request));
```
- `withGitHub` = auth + an Octokit client on **the user's own token**. Use it for anything personal.
- `validRepo(owner, repo)` before using route params.
- `cached(key, ttlMs, fn, fresh)` and `peekCached` in `lib/github/services.ts`; `?fresh=1` (`wantsFresh`) skips the cache for a manual refresh. `invalidateRepo` after writes.
- `githubError(err, what)` turns Octokit errors into a clean JSON response.
- `resolveRepos(request, userId)` reads `?repos=a/b,c/d` or falls back to the user's tracked repos.

## Traps
- **Cache keys:** keys without the user in them (`resp:`, `lens:`) are shared across users. Only put data there that is the same for everyone (public repo facts). Anything personal must include the user id or login.
- Caches are in-process today, so they are lost on restart and not shared between instances. (Moving them to Turso is planned.)
- GitHub Search is limited to 30 requests per minute per token. Prefer one search with several qualifiers over many searches.
- The OAuth scope currently has no `read:org`; org-only data needs that scope (planned).
