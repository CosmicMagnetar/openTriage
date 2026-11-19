/**
 * Settings: account, tracked repositories (maintainer workspace), saved replies, AI.
 */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { invalidate, useQuery } from '../../lib/query';
import AISettingsPanel from '../settings/AISettingsPanel';
import { Block, Button, Input, Page, Textarea } from './ui';

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
      <p className="text-[12px] text-[var(--muted)] mb-2">Used by Today, Inbox and Pull requests in the maintainer workspace. Untracking doesn't change anything on GitHub.</p>
      <ul className="mb-2">
        {(repos.data?.repos ?? []).map((r) => (
          <li key={r} className="flex items-center h-8 border-b border-[var(--line-soft)]">
            <span className="mono text-[var(--text-2)] flex-1">{r}</span>
            <Button variant="subtle" size="sm" onClick={() => remove(r)} aria-label={`Untrack ${r}`}><Trash2 className="w-3.5 h-3.5" /></Button>
          </li>
        ))}
        {repos.data && repos.data.repos.length === 0 && <li className="text-[12.5px] text-[var(--faint)] py-1">None yet.</li>}
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
      <p className="text-[12px] text-[var(--muted)] mb-2">Insert them from the reply box in any issue or PR.</p>
      <ul className="mb-3">
        {list.map((r) => (
          <li key={r.id} className="flex items-start gap-2 py-2 border-b border-[var(--line-soft)]">
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-[var(--text)]">{r.name}</p>
              <p className="text-[12px] text-[var(--muted)] line-clamp-2 whitespace-pre-wrap">{r.body}</p>
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

export default function SettingsPage() {
  const { user, role } = useAuthStore();
  return (
    <Page title="Settings">
      <div className="px-5 pb-10 max-w-3xl">
        <Block title="Account">
          <div className="flex items-center gap-3">
            <img src={user?.avatarUrl || 'https://github.com/ghost.png'} alt="" className="w-9 h-9 rounded-full" />
            <div>
              <p className="text-[13px] text-[var(--text)]">{user?.username}</p>
              <p className="text-[12px] text-[var(--muted)]">Signed in with GitHub · {role === 'MAINTAINER' ? 'Maintainer' : 'Contributor'} workspace (switch in the sidebar)</p>
            </div>
          </div>
        </Block>
        {role === 'MAINTAINER' && <TrackedRepos />}
        <SavedReplies />
        <Block title="AI">
          <AISettingsPanel />
        </Block>
      </div>
    </Page>
  );
}
