---
name: maintainer-hub
description: Change the maintainer side, meaning Repo to-do items, Funding & programs eligibility, rising contributors, workload, away mode, built-in saved replies. Use when a to-do is wrong or missing, a funding rule changes, or a maintainer goal is added.
---

# Maintainer hub

## Where
- **Repo to-do:** `backend-ts/src/lib/maintainer/todo.ts`.
  - `fetchRepoFacts()` collects facts: repo meta, docs checklist, private vulnerability reporting, Dependabot alerts, OpenSSF Scorecard, latest release + commits since, stale bot PRs, Actions runs, open good first issues.
  - `buildTodo()` (pure) turns them into items.
  - Route: `GET /api/maintainer/todo?repo=`.
  - UI: `DocsPage.jsx` (the "Repo to-do" page; path `/dashboard/docs` kept).
- **Funding & programs:** `lib/maintainer/funding.ts`.
  - `RULES` per opportunity id; `eligibilityFor()` and `maintainerOpportunities()` are pure.
  - The entries live in the opportunities seed/store, tagged `maintainers`.
  - Route: `GET /api/maintainer/funding`. UI: `FundingPage.jsx`.
- **Rising contributors:** `aggregateCommunity()` in `lib/maintainer/community.ts`.
- **Built-in replies and away reply:** `lib/maintainer/replies.ts`, merged into `GET /api/maintainer/templates`.
- **Maintainer goals and away mode:** `goals.maintainer` in `lib/ranking` (same `user_goals` row as contributor goals). UI: `maintainerHub.jsx`.

## Priority (P5)
- `lib/coordination/priority.ts` (pure, tested in `__tests__/coordination/priority.test.ts`):
  - `itemPriority(item, action, { reactions, board })` returns score 0–100, band P0–P4 (Kubernetes `priority/*` names in `BAND_LABEL`), and up to 3 reasons.
  - `prQuality(pr)` is the anti-slop signal: description, linked issue, testing note, AI disclosure, checks, first-timer context.
- `maintainerToday()` adds `score/band/why/quality` to each action. Reactions and Projects board "Priority"/"Status" come from `fetchItemExtras()`, which retries without board fields when the sign-in lacks `read:project`.
- "Since you were away" (`useSinceLastVisit` in `maintainerHub.jsx`) stores seen action ids per user in localStorage. First visit shows nothing new on purpose.

## Rules
- **Every to-do item has exactly one action.** Either `create-doc` (existing PR-from-template flow) or a link. Never add an item the maintainer can't act on in one click.
- **Facts are cached per viewer** (`facts:<login>:<repo>`), because alerts and private repos must never be shared. Public-only items are skipped for private repos; archived repos have no to-do.
- **The route checks the repo is tracked and the viewer has write-level access** before fetching. Keep that when adding new fact sources.
- **Eligibility only claims what GitHub shows:** public, OSI licence, star count. Anything else goes in `manual` ("check yourself"). Don't state amounts or dates a program doesn't publish.
- **Goal weights:** a goal (35) outweighs one step of eligibility certainty (30), so funds lead for someone who asked for funding.
- **Goals PUT merges over stored goals,** so the contributor editor (no `maintainer` key) and the maintainer editor (only `maintainer`) never wipe each other.
- **New seed entries only show after a sync** (`npx` the internal sync with force, or wait for the daily run).

## Traps
- `/api/maintainer/*` requires the MAINTAINER role (middleware). When testing as a contributor you get 403 "MAINTAINER role required".
- `fetchViewerPermissions` returns booleans (TRIAGE counts as true), not role names.
- The first to-do load per repo makes about 10 GitHub calls (2–4 s); after that it's cached for an hour.
