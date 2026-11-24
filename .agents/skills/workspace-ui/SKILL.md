---
name: workspace-ui
description: Add or change a workspace screen in frontend_new so it matches the existing design and never shows needless loading. Use for any new page, panel, tab or widget.
---

# Workspace UI

The UI must stay consistent and uncluttered. Every new screen reuses what exists.

## Adding a page
1. Create `frontend_new/src/components/workspace/<Name>Page.jsx`.
2. Register it lazily in `WorkspaceLayout.jsx` with `lazyRetry(loaders.<name>)` and wrap it like the others (`PageBoundary`, `PageFallback` from `PageShell.jsx`).
3. Add it to `NAV` in `nav.js` under the right role (`contributor` / `maintainer`) with an icon from `lucide-react` and a hue from `HUES`. Nav is shared by the sidebar, ⌘K palette, page headers and Settings → Sidebar.

## Building blocks (`ui.jsx`)
- Layout and motion: `Stagger`, `StaggerItem`, `Ambient`, `useMotionOn` (respects reduced motion).
- Status: `Dot`, `Pulse`, `Tag`, `Baton`, and the shared maps `STATE`, `AVAILABILITY`, `VERDICT`, `RESPONSIVENESS`, `ACTION`, `CHECKS`, `REVIEW`.
- Inputs: `Button`, `Input`, `Textarea`, `Kbd`.
- Numbers: `LiveNumber`, `CountUp`.
- Colours and radius come from `theme.css` tokens (`--panel`, `--line`, `--text-2`, `--accent`, `--radius`, …). Never hard-code a new colour.

## Data
- Use `useQuery(key, fetcher, { staleMs })` from `src/lib/query.js`. It returns cached data instantly and refreshes in the background.
- Show a skeleton **only** when there is no cached data at all. Never replace visible data with a spinner.

## Keep it uncluttered
- One primary action per row or card. Secondary details behind a click or hover.
- Lists default to the top few items with "show all".
- Check every new screen at desktop and phone width before the PR.
