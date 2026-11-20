const DEFAULTS = { api: 'http://localhost:3001', app: 'http://localhost:5173' };
const $ = (id) => document.getElementById(id);
chrome.storage.sync.get(DEFAULTS, (v) => { $('api').value = v.api; $('app').value = v.app; });
$('save').onclick = async () => {
  const api = $('api').value.replace(/\/+$/, '');
  const app = $('app').value.replace(/\/+$/, '');
  // A non-localhost backend needs permission to be fetched from the extension.
  if (!api.startsWith('http://localhost')) {
    const ok = await chrome.permissions.request({ origins: [`${new URL(api).origin}/*`] });
    if (!ok) { $('msg').textContent = 'Permission needed for that backend.'; return; }
  }
  chrome.storage.sync.set({ api, app }, () => { $('msg').textContent = 'Saved.'; });
};
