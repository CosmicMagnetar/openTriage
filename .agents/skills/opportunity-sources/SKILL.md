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

## Adding a source
1. Confirm the source has a **public, free, working API or page** and that it is open-source related. If not, don't add it.
2. Write `adapters/<source>.ts` with a pure function (`xFromApi(json, today)` or `xFromHtml(html)`). No fetching inside the adapter.
3. Save a real sample response under `__tests__/opportunities/` and test the adapter against it in `adapters.test.ts`.
4. Add a `run("<source>", replaceAll, …)` call in `collect()`. Use `replaceAll: true` only for sources whose full list is returned every time (like bounties); otherwise `false`.
5. Add the source name to `ACTIVE_SOURCES`. **Rows from sources not in this set are deleted on the next run.**
6. If it replaces a seed entry, add a regex to `SEED_REPLACED_BY`.
7. Add edge cases to `evals/evals.json` if you changed a rule in `normalize.ts`.

## Traps
- **GitHub search uses the shared `GITHUB_TOKEN`.** Without it, search is heavily rate-limited and bounties come back empty. Check this first when bounties look missing.
- **Bounty filter:** bounty repos are kept only if public, not archived, with a real licence, and with at least `minStars` (100) stars (`bountiesToPrograms`). Only the first 30 repos are checked for stars. This can make the list look empty.
- `linkAlive` treats 403 and 429 as alive (sites that block bots).
- The local replica can be briefly busy; writes go through `retry()` for `SQLITE_BUSY`.
- Dates are ISO days (`YYYY-MM-DD`) compared as strings; always pass `today` in, never call `new Date()` inside a rule.
