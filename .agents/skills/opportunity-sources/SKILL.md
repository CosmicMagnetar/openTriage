---
name: opportunity-sources
description: Add, fix or remove a source for the Opportunities page (programs, bounties, grants, events). Use when a source is missing, empty, broken, or when adding a new feed such as LFX or a grant list.
---

# Opportunity sources

## How it works
- `backend-ts/src/lib/opportunities/sync.ts` → `collect()` runs every source in parallel through `run(source, replaceAll, fn)`. A source that throws returns `error`, and its previous rows are **kept**.
- Each source is one pure adapter in `lib/opportunities/adapters/<source>.ts` that turns the raw API response into `Program[]` (type in `lib/programs.ts`).
- `normalize.ts` holds the shared rules: `kindOf`, `endsOn`, `rollForward` (recurring programs move to the next cycle, marked "usual timing"), `isExpired` (one-offs are deleted the day after their last date), `SEED_REPLACED_BY` (an official adapter replaces the hand-kept seed row).
- `server.js` triggers `/api/internal/opportunities/sync` 30 s after start and then hourly; the route itself only syncs once a day.

## Live sources (checked 2026-11-25)
| Source | Endpoint | Becomes |
| --- | --- | --- |
| GSoC timeline | `summerofcode.withgoogle.com/api/program/` | opportunity (program) |
| Outreachy | dates page HTML | opportunity (program) |
| LFX Mentorship | `mentorship.linuxfoundation.org/api/programs?status=all&sortBy=accepting_first` (the old `api.mentorship.lfx…` host is dead) | one opportunity per project term accepting applications |
| Bounties | GitHub search on `BOUNTY_LABELS` | one opportunity per repo, newest 5 issues with amounts in `items` |
| CNCF landscape | `landscape.cncf.io/data/full.json` (3.9 MB; has GitHub languages/stars) | projects directory |
| CLOMonitor | `clomonitor.io/api/projects/search?foundation=cncf` (paged by 100) | health + agent-readiness scores on CNCF projects |
| GSoC organisations | `…/api/program/<year>/organizations/` | projects directory |
| up-for-grabs | `up-for-grabs.net/javascripts/projects.json` | projects directory |

Hacktoberfest has no public API; it stays a curated seed entry.

**Two stores.** Dated, actionable things (deadlines, bounties) go to `opportunities`. Long-lived project lists go to the projects directory (`lib/projects/`, table `oss_projects`, `GET /api/projects`), merged by repo, then by name. The projects sync runs daily as its own job (`projects-sync`), started by the same internal route.

## Adding a source
1. Confirm the source has a **public, free, working API or page** and that it is open-source related. If not, don't add it.
2. Write `adapters/<source>.ts` with a pure function (`xFromApi(json, today)` or `xFromHtml(html)`). No fetching inside the adapter.
3. Save a real sample response under `__tests__/opportunities/` and test the adapter against it in `adapters.test.ts`.
4. Add a `run("<source>", replaceAll, …)` call in `collect()`. Use `replaceAll: true` only for sources whose full list is returned every time (like bounties); otherwise `false`.
5. Add the source name to `ACTIVE_SOURCES`. **Rows from sources not in this set are deleted on the next run.**
6. If it replaces a seed entry, add a regex to `SEED_REPLACED_BY`.
7. Add edge cases to `evals/evals.json` if you changed a rule in `normalize.ts`.

## Traps
- **GitHub search uses a server token** (`serverToken()`, least-used of `GITHUB_TOKENS` + `GITHUB_TOKEN`). With none configured, search is heavily rate-limited and bounties come back empty. Check this first when bounties look missing.
- **One run across all instances.** `syncIfDue` runs `syncNow` inside `runExclusive("opportunities-sync", 30 min)`. A second instance gets `{ skipped: "running on another instance" }`. If a run crashes, the lease frees itself after 30 minutes.
- **Bounty filter:** bounty repos are kept only if public, not archived, with a real licence, and with at least `minStars` (20) stars. Only the first 60 repos found are checked. Issues found by two label searches are deduped by URL, so test fixtures need unique `html_url`s.
- **Browser cache:** the programs list is cached in the browser for 30 min (`usePrograms`). After changing what the sync stores, clear `localStorage` keys containing `programs` to see it immediately.
- **Projects deletes are per source:** stale `oss_projects` rows are removed only for sources that answered this run, so one source failing never wipes its rows.
- `linkAlive` treats 403 and 429 as alive (sites that block bots).
- The local replica can be briefly busy; writes go through `retry()` for `SQLITE_BUSY`.
- Dates are ISO days (`YYYY-MM-DD`) compared as strings; always pass `today` in, never call `new Date()` inside a rule.
