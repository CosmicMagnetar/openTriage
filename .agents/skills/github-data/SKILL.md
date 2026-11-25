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
- **Two cache tiers.** `cached()` keeps memory first and copies each value to the shared `cache_entries` table in Turso (`lib/sharedCache.ts`), so other instances and a restarted server reuse it. Values that aren't plain JSON (Map, Set, Date, class instances) silently stay memory-only. Return plain objects if you want them shared. Values over 256 KB are not shared.
- **Shared reads lag.** Turso reads come from the local replica, up to `SYNC_INTERVAL` (60 s) behind. Fine for caches; never use the cache table for anything that must be exact.
- **Rate budget.** `isBudgetLow(token)` tells you when a token has under 100 core requests left. Prefer serving stale data then.
- **Jest can't load `@octokit/rest`** (ESM-only). `lib/github/octokit.ts` requires it lazily inside `createGitHubClient`, so keep new pure helpers out of modules that import Octokit at the top level.
- GitHub Search is limited to 30 requests per minute per token. Prefer one search with several qualifiers over many searches.
- **Scopes:** sign-in asks for `read:org read:project` (`app/api/auth/github/route.ts`). Older sign-ins lack them: `missingScopes()` in `lib/github/access.ts` reads GitHub's `X-OAuth-Scopes` header, and the UI shows a one-time "Re-connect" bar. If you need a new scope, add it to both the auth route and `REQUIRED_SCOPES`.
- **Which repos a user maintains:** use `fetchAccess()` (cached as `access:<userId>`), never `/user/repos` with the default affiliation. The default skips org/team repos and only the first page comes back. Track with `trackRepos()` in `lib/github/track.ts`.
- **Orgs that block OAuth apps** return no repos for that org. Show `requestAccessUrl()` so the user can ask the org to approve OpenTriage.
