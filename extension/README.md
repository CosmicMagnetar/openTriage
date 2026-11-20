# OpenTriage for GitHub (browser extension)

Shows a small OpenTriage line under the title of any GitHub issue: whether it is
free, who claimed it (and whether that claim went stale), and how fast the
maintainers usually reply. One click opens the issue in OpenTriage.

## Install (Chrome, Edge, Brave)
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. Open any issue on github.com.

## Settings
Right-click the extension icon → **Options** to point it at your OpenTriage
backend and app (defaults: `http://localhost:3001` and `http://localhost:5173`).

## Status data
The backend needs a `GITHUB_TOKEN` (a fine-grained token with public read access
is enough) in `backend-ts/.env.local` to look up issue status for the extension.
Without it the extension still shows the **Open in OpenTriage** link.
Private repositories are never served by this public endpoint.
