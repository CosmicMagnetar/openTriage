// Adds an OpenTriage pill under the issue title on github.com.
// GitHub is a single-page app, so we re-check after in-page navigation.
const DEFAULTS = { api: 'http://localhost:3001', app: 'http://localhost:5173' };
const LABEL = {
  available: ['Available', 'ot-green'],
  claimed: ['Claimed', 'ot-red'],
  claimed_stale: ['Stale claim', 'ot-amber'],
  in_progress: ['PR open', 'ot-red'],
  in_progress_stalled: ['PR stalled', 'ot-amber'],
  likely_done: ['Likely done', 'ot-gray'],
  closed: ['Closed', 'ot-gray'],
};
const REPLY = { responsive: 'replies fast', slow: 'slow to reply', unresponsive: 'rarely replies' };

function parse() {
  const m = location.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/);
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text; // textContent only: nothing from the network becomes HTML
  return e;
}

let current = '';
async function run() {
  const ref = parse();
  const key = ref ? `${ref.owner}/${ref.repo}#${ref.number}` : '';
  if (!ref || key === current) return;
  current = key;
  document.getElementById('opentriage-pill')?.remove();

  const anchor = document.querySelector('[data-testid="issue-header"], .gh-header-show, #partial-discussion-header');
  if (!anchor) return;
  const { app } = await chrome.storage.sync.get(DEFAULTS);
  const pill = el('div', 'ot-pill');
  pill.id = 'opentriage-pill';
  pill.append(el('span', 'ot-brand', 'OpenTriage'), el('span', 'ot-muted', 'checking…'));
  anchor.after(pill);

  const res = await chrome.runtime.sendMessage({ type: 'issue', ...ref }).catch(() => null);
  pill.replaceChildren(el('span', 'ot-brand', 'OpenTriage'));
  const d = res?.data;
  if (d?.configured) {
    const [label, cls] = LABEL[d.availability.status] ?? [d.availability.status, 'ot-gray'];
    pill.append(el('span', `ot-state ${cls}`, label));
    const who = d.claims.map((c) => `@${c.login}${c.stale ? ' (stale)' : ''}`).join(', ');
    if (who) pill.append(el('span', 'ot-muted', `· ${who}`));
    if (d.availability.contested) pill.append(el('span', 'ot-state ot-red', 'more than one person'));
    if (d.responsiveness && REPLY[d.responsiveness.level]) pill.append(el('span', 'ot-muted', `· maintainers ${REPLY[d.responsiveness.level]}`));
  } else {
    pill.append(el('span', 'ot-muted', 'see who is on it and what to do next'));
  }
  const link = el('a', 'ot-link', 'Open in OpenTriage →');
  link.href = `${app}/dashboard?item=${encodeURIComponent(`issue:${ref.owner}/${ref.repo}#${ref.number}`)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  pill.append(link);
}

run();
document.addEventListener('turbo:load', run);
new MutationObserver(() => { if (parse() && !document.getElementById('opentriage-pill')) { current = ''; run(); } })
  .observe(document.body, { childList: true, subtree: true });
