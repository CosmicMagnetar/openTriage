---
name: repo-context
description: Change how OpenTriage reads and scores a repo's context files (AGENTS.md map, skills, evals, CODEOWNERS), builds the no-AI "How this repo works" map, the starter AGENTS.md, the Change card or the PR test run.
---

# Repo context

## Where
- `backend-ts/src/lib/context/index.ts` (pure; tests in `__tests__/lib/context.test.ts`, which also parse OpenTriage's own AGENTS.md):
  - `findContextFiles`, `parseAgentsMd` (audit stamp, map table, commands), `parseSkill`, `generatedPatterns`.
  - `buildRepoMap`: per top-level folder: purpose, languages, tests, owners, generated, entry points.
  - `freshness`, `contextScore` (with recommendations), `starterAgentsMd`, `changeCard`.
- `lib/context/fetch.ts`: `buildRepoContext` (cached 6 h; public repos shared, private per viewer), `buildChangeCard`, `dispatchTestRun`.
- Routes:
  - `GET /api/context/:owner/:repo`.
  - `GET/POST /api/context/change-card` (card / test run; author or maintainer only).
  - `GET /api/badge/context/:owner/:repo.svg`.
- UI: `repoContext.jsx`. `RepoContext` sits in Repo lens at `#context`; `ChangeCardBlock` shows on your own open PRs in the item panel.

## Rules
- **No AI here.** Everything comes from files the repo has and its tree. Folder purposes come from the repo's own AGENTS.md first; otherwise from the folder name, labelled "(guessed from name)".
- **Map tables:** a row for the folder itself wins; rows for sub-folders are combined ("k8s: … · go: …").
- **The Change card is a draft.** Edge cases and AI use stay TODO, because only the author knows them. It never blocks anything.
- **Test run** dispatches a workflow only if the PR's head repo has one with `workflow_dispatch` whose name or path looks like tests/CI. Otherwise it explains and links to the checks.
- **Context-ready promotion in Find** uses CLOMonitor's agent-readiness (≥ 60) from the projects directory. It's not computed per repo on the fly (too costly for ~2k repos).

## Traps
- `CLAUDE.md` that only says `@AGENTS.md` is a pointer, not a map. The map is parsed only when the file contains a table.
- Freshness counts commits since the audit SHA. Repos without a SHA in the stamp get no count.
