---
name: ranking
description: Change how OpenTriage ranks repos, opportunities or issues for a contributor (scores, reasons, goals, feedback). Use when a result is ranked wrong, a reason reads badly, or a new signal or goal is added.
---

# Personal ranking

## Where
- `backend-ts/src/lib/ranking/index.ts`: pure scoring. `scoreProject` / `rankProjects`, `scoreOpportunity`, `issueGoalBoost`, `sanitizeGoals`, `applyFeedback`.
- `lib/ranking/store.ts`: goals and feedback per user (`user_goals` table).
- `lib/ranking/me.ts`: `rankingContext()` = GitHub signals (languages, topics, contributed, starred) + goals + feedback.
- Routes:
  - `GET/PUT/POST /api/me/goals` (goals, feedback).
  - `GET /api/me/recommendations/repos` and `GET /api/me/recommendations/opportunities`.
  - `/api/work/opportunities` re-ranks the cached issue list with `issueGoalBoost`.
- UI: `frontend_new/src/components/workspace/forYou.jsx`, which holds the goals editor, the "Tuned for" strip, Find → Repos, and the Opportunities "For you" order.

## Rules
- **Every point needs a reason.** A part of the score is `[points, reason | null]`, and `topReasons` shows the 3 biggest. If you add a signal that changes order, give it a reason people understand ("GSoC 2026 org", "Paid bounty"), not a number.
- **Caps keep parts honest.**
  - Repos: fit 40, welcome 20, health 20, goals 20, familiar 10, feedback ±12, minus 20 if quiet for a year.
  - Opportunities: goals 30, urgency 20, fit 20, reward 10, familiar 10.
- **Hidden and "not for me" never show.** "Not for me" also lowers that item's tags (affinity −1 each, floor −3). "Save" raises them.
- **Goals re-rank cached lists.** Never put goals in a GitHub-search cache key. Re-rank after the cache instead, as `/api/work/opportunities` does.
- **Display names** go through `titleCase`/`DISPLAY` ("Go", not "GO"; "CNCF"). Tests check reason text exactly.

## When you change scoring
- Add or adjust a case in `src/__tests__/lib/ranking.test.ts` that describes the behaviour in words ("paid goal puts bounties first").
- Check a real account. The first `/api/me/recommendations/repos` call fetches signals (~2 s); warm calls take ~200 ms.

## Traps
- `fetchSignals` cache key is `sig2:` because its shape gained `topics`. Bump the version if you change the shape again, or old shared-cache entries come back without the new field.
- After a sync writes to Turso, call `syncReplica()` before clearing any in-memory list. Otherwise the next read re-caches old rows from the local replica for a minute.
