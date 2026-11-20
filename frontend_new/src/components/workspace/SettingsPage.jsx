/**
 * Settings: account, appearance, sidebar, Today widgets, tracked repositories
 * (maintainer), saved replies, AI.
 */
import { useState } from 'react';
import { Check, Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { disableNotify, enableNotify, notifyEnabled, notifySupported } from '../../lib/notify';
import useAuthStore from '../../stores/authStore';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { invalidate, useQuery } from '../../lib/query';
import AISettingsPanel from '../settings/AISettingsPanel';
import { Reorder } from 'framer-motion';
import usePrefs, { ACCENTS, DEFAULT_ACCENT, TODAY_WIDGETS, arrangeNav, widgetsFor } from '../../stores/prefsStore';
import { NAV } from './nav';
import { InterestsEditor } from './opportunities';
import { Block, Button, Input, Page, Segments, Textarea } from './ui';

function TrackedRepos() {
  const repos = useQuery(keys.repos(), () => workApi.trackedRepos(), { staleMs: 60_000 });
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const changed = () => { repos.refresh(); invalidate('today:'); invalidate('inbox'); invalidate('prs:'); };

  const add = async (e) => {
    e.preventDefault();
    const ref = parseGitHubRef(value);
    if (!ref) return toast.error('Use owner/repo or a GitHub URL');
    setBusy(true);
    try {
      await workApi.addRepo(ref.owner, ref.repo);
      setValue('');
      changed();
      toast.success(`Tracking ${ref.owner}/${ref.repo}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (full) => {
    try {
      await workApi.untrackRepo(full);
      changed();
      toast.success(`Stopped tracking ${full}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Block title="Repositories you maintain">
      <p className="fs-12 text-[var(--muted)] mb-2">Used by Today, Inbox and Pull requests in the maintainer workspace. Untracking doesn't change anything on GitHub.</p>
      <ul className="mb-2">
        {(repos.data?.repos ?? []).map((r) => (
          <li key={r} className="flex items-center h-8 border-b border-[var(--line-soft)]">
            <span className="mono text-[var(--text-2)] flex-1">{r}</span>
            <Button variant="subtle" size="sm" onClick={() => remove(r)} aria-label={`Untrack ${r}`}><Trash2 className="w-3.5 h-3.5" /></Button>
          </li>
        ))}
        {repos.data && repos.data.repos.length === 0 && <li className="fs-12-5 text-[var(--faint)] py-1">None yet.</li>}
      </ul>
      <form onSubmit={add} className="flex items-center gap-1.5">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner/repo" className="w-56" />
        <Button disabled={busy || !value}>Track</Button>
      </form>
    </Block>
  );
}

function SavedReplies() {
  const replies = useQuery(keys.replies(), () => workApi.savedReplies(), { staleMs: 5 * 60_000 });
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const list = Array.isArray(replies.data) ? replies.data : [];

  const add = async (e) => {
    e.preventDefault();
    try {
      await workApi.saveReply(name, body);
      setName('');
      setBody('');
      replies.refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await workApi.deleteReply(id);
      replies.refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Block title="Saved replies">
      <p className="fs-12 text-[var(--muted)] mb-2">Insert them from the reply box in any issue or PR.</p>
      <ul className="mb-3">
        {list.map((r) => (
          <li key={r.id} className="flex items-start gap-2 py-2 border-b border-[var(--line-soft)]">
            <div className="flex-1 min-w-0">
              <p className="fs-12-5 text-[var(--text)]">{r.name}</p>
              <p className="fs-12 text-[var(--muted)] line-clamp-2 whitespace-pre-wrap">{r.body}</p>
            </div>
            <Button variant="subtle" size="sm" onClick={() => remove(r.id)} aria-label={`Delete ${r.name}`}><Trash2 className="w-3.5 h-3.5" /></Button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="space-y-2 max-w-xl">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Needs reproduction)" className="w-full" />
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply text" />
        <Button disabled={!name.trim() || !body.trim()}>Save reply</Button>
      </form>
    </Block>
  );
}

const TEXT_SIZES = [{ value: '14', label: 'Small' }, { value: '15', label: 'Default' }, { value: '16', label: 'Large' }, { value: '17', label: 'Larger' }];

const WIDGET_LABELS = {
  next: 'Next actions', journey: 'Your journey', picks: 'Picked for you', deadlines: 'Program deadlines', prs: 'Your pull requests',
  queue: 'Action queue', health: 'Repo health', stale: 'Stale claims', newcomers: 'Newcomers waiting',
};

function Field({ label, hint, children }) {
  return (
    <div>
      <p className="fs-12-5 text-[var(--text-2)] mb-1.5">{label}</p>
      {children}
      {hint && <p className="fs-11-5 text-[var(--faint)] mt-1">{hint}</p>}
    </div>
  );
}

function Appearance({ ws }) {
  const prefs = usePrefs();
  const current = prefs.accent?.[ws] ?? DEFAULT_ACCENT[ws];
  return (
    <Block title="Appearance">
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Text size" hint="Scales all text in the workspace.">
          <Segments value={prefs.textSize} onChange={(v) => prefs.set({ textSize: v })} options={TEXT_SIZES} />
        </Field>
        <Field label="Density">
          <Segments value={prefs.density} onChange={(v) => prefs.set({ density: v })}
            options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
        </Field>
        <Field label={`Accent for the ${ws} workspace`} hint="Each workspace keeps its own colour so you always know where you are.">
          <div className="flex gap-2">
            {Object.entries(ACCENTS).map(([name, a]) => (
              <button key={name} onClick={() => prefs.set({ accent: { ...prefs.accent, [ws]: name } })} aria-label={`${name} accent`} aria-pressed={current === name} title={name}
                className="w-8 h-8 rounded-full inline-flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: a.hex, boxShadow: current === name ? `0 0 0 2px var(--bg), 0 0 0 4px ${a.hex}` : 'none' }}>
                {current === name && <Check className="w-4 h-4" style={{ color: a.ink }} />}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Motion" hint="Number changes, board drag, small celebrations.">
          <Segments value={prefs.motion ? 'on' : 'off'} onChange={(v) => prefs.set({ motion: v === 'on' })}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
        </Field>
      </div>
    </Block>
  );
}

/** Drag to reorder within each group, eye to hide. Home can't be hidden. */
function SidebarSettings({ ws }) {
  const prefs = usePrefs();
  const hidden = new Set(prefs.navHidden?.[ws] ?? []);
  const all = NAV[ws].flatMap((g) => g.items);
  const arranged = arrangeNav(all, { ...prefs, navHidden: { [ws]: [] } }, ws);
  const setGroupOrder = (gid, list) => {
    const order = NAV[ws].flatMap((g) => (g.id === gid ? list : arranged.filter((n) => g.items.some((i) => i.path === n.path))));
    prefs.set({ navOrder: { ...prefs.navOrder, [ws]: order.map((n) => n.path) } });
  };
  const toggle = (path) => {
    const next = hidden.has(path) ? [...hidden].filter((p) => p !== path) : [...hidden, path];
    prefs.set({ navHidden: { ...prefs.navHidden, [ws]: next } });
  };
  return (
    <Block title="Sidebar" right={<Button size="sm" variant="subtle" onClick={() => prefs.set({ navOrder: { ...prefs.navOrder, [ws]: [] }, navHidden: { ...prefs.navHidden, [ws]: [] } })}>Reset</Button>}>
      <p className="fs-12-5 text-[var(--muted)] mb-3">Drag to reorder pages inside a group. Hidden pages stay reachable from ⌘K.</p>
      <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
        {NAV[ws].map((g) => {
          const items = arranged.filter((n) => g.items.some((i) => i.path === n.path));
          return (
            <div key={g.id}>
              <p className="fs-12 font-semibold text-[var(--muted)] mb-1.5">{g.title}</p>
              <Reorder.Group axis="y" values={items} onReorder={(list) => setGroupOrder(g.id, list)} className="space-y-1">
                {items.map((n) => {
                  const Icon = n.icon;
                  const off = hidden.has(n.path);
                  return (
                    <Reorder.Item key={n.path} value={n} className="ctl-lg flex items-center gap-2.5 px-2.5 rounded-md border border-[var(--line)] bg-[var(--panel)] cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-3.5 h-3.5 text-[var(--faint)]" />
                      <Icon className="w-4 h-4 text-[var(--muted)]" />
                      <span className={`flex-1 fs-13 ${off ? 'text-[var(--faint)] line-through' : 'text-[var(--text)]'}`}>{n.label}</span>
                      {n.path !== '/dashboard' && (
                        <button onClick={() => toggle(n.path)} aria-label={off ? `Show ${n.label}` : `Hide ${n.label}`} className="p-1 text-[var(--muted)] hover:text-[var(--text)]">
                          {off ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            </div>
          );
        })}
      </div>
    </Block>
  );
}

function TodayWidgets({ ws }) {
  const prefs = usePrefs();
  const all = TODAY_WIDGETS[ws];
  const shown = widgetsFor(prefs, ws);
  const ordered = [...shown, ...all.filter((w) => !shown.includes(w))];
  const save = (list, vis) => prefs.set({ widgets: { ...prefs.widgets, [ws]: list.filter((w) => vis.includes(w)) } });
  return (
    <Block title="Today page">
      <p className="fs-12 text-[var(--muted)] mb-2">Choose what Today shows and in which order.</p>
      <Reorder.Group axis="y" values={ordered} onReorder={(list) => save(list, shown)} className="max-w-sm space-y-1">
        {ordered.map((w) => (
          <Reorder.Item key={w} value={w} className="flex items-center gap-2.5 h-9 px-2.5 rounded-md border border-[var(--line-soft)] bg-[var(--panel)] cursor-grab active:cursor-grabbing">
            <GripVertical className="w-3.5 h-3.5 text-[var(--faint)]" />
            <label className="flex-1 flex items-center gap-2 fs-13 text-[var(--text-2)]">
              <input type="checkbox" checked={shown.includes(w)} className="accent-[var(--accent)]"
                onChange={(e) => save(ordered, e.target.checked ? [...shown, w] : shown.filter((x) => x !== w))} />
              {WIDGET_LABELS[w]}
            </label>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </Block>
  );
}

function Suggestions() {
  const prefs = usePrefs();
  return (
    <Block title="Suggestions">
      <div className="space-y-4">
        <Segments value={prefs.newcomer ? 'new' : 'any'} onChange={(v) => prefs.set({ newcomer: v === 'new' })}
          options={[{ value: 'new', label: 'Newcomer-friendly' }, { value: 'any', label: 'Any issue' }]} />
        <InterestsEditor />
        <Button variant="subtle" size="sm" onClick={() => prefs.set({ onboarded: false })}>Show the welcome again</Button>
      </div>
    </Block>
  );
}

function NotifySettings() {
  const [on, setOn] = useState(notifyEnabled());
  const denied = notifySupported() && Notification.permission === 'denied';
  const toggle = async () => {
    if (on) { disableNotify(); setOn(false); return; }
    const ok = await enableNotify();
    setOn(ok);
    if (!ok) toast.error('Notifications are blocked for this site in your browser settings.');
  };
  return (
    <Block title="Notifications">
      <div className="flex items-center gap-3">
        <p className="flex-1 fs-13 text-[var(--text-2)]">
          Tell me when something new is waiting on me (changes requested, CI failing, a question for me).
          <span className="block fs-12 text-[var(--muted)]">Works while OpenTriage is open in a tab, even in the background.</span>
        </p>
        <Button size="sm" variant={on ? 'subtle' : 'ghost'} aria-pressed={on} onClick={toggle} disabled={!notifySupported() || denied}>
          {!notifySupported() ? 'Not supported' : denied ? 'Blocked' : on ? 'On' : 'Turn on'}
        </Button>
      </div>
    </Block>
  );
}

export default function SettingsPage() {
  const { user, role } = useAuthStore();
  const ws = role === 'MAINTAINER' ? 'maintainer' : 'contributor';
  return (
    <Page title="Settings">
      <div className="px-6 pb-10 max-w-3xl">
        <Block title="Account">
          <div className="flex items-center gap-3">
            <img src={user?.avatarUrl || 'https://github.com/ghost.png'} alt="" className="w-9 h-9 rounded-full" />
            <div>
              <p className="fs-13 text-[var(--text)]">{user?.username}</p>
              <p className="fs-12 text-[var(--muted)]">Signed in with GitHub · {role === 'MAINTAINER' ? 'Maintainer' : 'Contributor'} workspace (switch in the sidebar)</p>
            </div>
          </div>
        </Block>
        <NotifySettings />
        <Appearance ws={ws} />
        <SidebarSettings ws={ws} />
        <TodayWidgets ws={ws} />
        {ws === 'contributor' && <Suggestions />}
        {role === 'MAINTAINER' && <TrackedRepos />}
        {role === 'MAINTAINER' && <SavedReplies />}
        <Block title="AI (optional)">
          <AISettingsPanel />
        </Block>
      </div>
    </Page>
  );
}
