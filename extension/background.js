// Fetches from the OpenTriage backend on behalf of the content script
// (the extension's host permission avoids CORS on github.com).
const DEFAULTS = { api: 'http://localhost:3001', app: 'http://localhost:5173' };

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type !== 'issue') return false;
  chrome.storage.sync.get(DEFAULTS, ({ api }) => {
    const { owner, repo, number } = msg;
    fetch(`${api}/api/public/issue/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${number}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => reply({ ok: true, data }))
      .catch(() => reply({ ok: false }));
  });
  return true; // async reply
});
