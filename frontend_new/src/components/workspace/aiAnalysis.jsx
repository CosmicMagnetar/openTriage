/**
 * AI with your own key: the Settings block to add it, and the deep repo
 * analysis in Repo lens. Without a key, the analysis says where to add one;
 * everything else in OpenTriage works without AI.
 */
import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { keys, workApi } from '../../services/workApi';
import { invalidate, useQuery } from '../../lib/query';
import { Block, Button, Input, Tag } from './ui';

const PROVIDERS = [
  ['anthropic', 'Anthropic', 'claude-opus-5-5 (default)'],
  ['openrouter', 'OpenRouter', 'openrouter/auto (default)'],
  ['openai', 'OpenAI', 'model name (required)'],
];

export function useAiKey() {
  return useQuery(keys.aiKey(), () => workApi.aiKey(), { staleMs: 5 * 60_000 });
}

/** Settings → AI: paste your key; it's encrypted on the server and never shown again. */
export function AiKeySettings() {
  const q = useAiKey();
  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const s = q.data;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await workApi.saveAiKey(provider, apiKey, model.trim() || undefined);
      setApiKey(''); invalidate('ai-key'); q.refresh(); toast.success('Key saved (encrypted)');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    try { await workApi.deleteAiKey(); invalidate('ai-key'); q.refresh(); toast.success('Key removed'); } catch (err) { toast.error(err.message); }
  };
  return (
    <div>
      <p className="fs-12 text-[var(--muted)] mb-2">
        Optional. Powers the plain-language repo explanation in Repo lens. Your key is encrypted on the server, used only for your requests,
        and never shown again. You pay your provider directly; OpenTriage adds no cost.
      </p>
      {s?.set && (
        <div className="flex items-center gap-2 mb-3 fs-12-5">
          <Tag color="green">{s.provider}</Tag>
          <span className="mono">••••{s.last4}</span>
          {s.model && <span className="text-[var(--muted)]">· {s.model}</span>}
          <Button size="sm" variant="danger" onClick={remove}>Remove</Button>
        </div>
      )}
      <form onSubmit={save} className="space-y-2 max-w-xl">
        <div className="flex flex-wrap gap-2">
          <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Provider"
            className="ctl px-2 rounded-md fs-13 bg-[var(--inset)] border border-[var(--line)] text-[var(--text)]">
            {PROVIDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={PROVIDERS.find((p) => p[0] === provider)[2]} className="w-64" aria-label="Model" />
        </div>
        <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={s?.set ? 'Paste a new key to replace it' : 'Paste your API key'} className="w-full" aria-label="API key" />
        <Button disabled={busy || apiKey.trim().length < 20}>{s?.set ? 'Replace key' : 'Save key'}</Button>
      </form>
    </div>
  );
}

const DIFF = { easy: 'green', medium: 'amber', hard: 'red' };

/** Repo lens: "Explain this repo to me" with your key. Shared per repo version, so a second visit is instant. */
export function AiRepoAnalysis({ owner, repo }) {
  const navigate = useNavigate();
  const key = useAiKey();
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (fresh = false) => {
    setBusy(true);
    try { setRes(await workApi.repoAnalysis(`${owner}/${repo}`, fresh)); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const a = res?.analysis;
  return (
    <Block title="Explain it to me (AI, your key)">
      {!key.data?.set ? (
        <p className="fs-12-5 text-[var(--muted)]">
          Add your own AI key in <button onClick={() => navigate('/dashboard/settings#ai')} className="text-[var(--link)] hover:underline">Settings</button> for a plain-language walkthrough of this repo, built on the map above. Everything else works without it.
        </p>
      ) : !a ? (
        <div className="flex items-center gap-3">
          <Button onClick={() => run(false)} disabled={busy}><Sparkles className="w-3.5 h-3.5" /> {busy ? 'Reading the repo…' : 'Explain this repo'}</Button>
          <span className="fs-12 text-[var(--muted)]">Uses your {key.data.provider} key once per repo version; later visits reuse the answer.</span>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="fs-13-5">{a.summary}</p>
          {a.howItWorks.length > 0 && (
            <div>
              <p className="fs-12-5 font-semibold mb-1">How it works</p>
              <ol className="list-decimal pl-5 space-y-0.5 fs-13">{a.howItWorks.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
          )}
          {a.firstAreas.length > 0 && (
            <div>
              <p className="fs-12-5 font-semibold mb-1">Good first places for you</p>
              <ul className="space-y-1 fs-13">{a.firstAreas.map((f) => <li key={f.path}><code className="mono">{f.path}</code> <span className="text-[var(--muted)]">· {f.why}</span></li>)}</ul>
            </div>
          )}
          <div>
            <p className="fs-12-5 font-semibold mb-1">Each folder, in plain words</p>
            <ul className="space-y-1 fs-13">{a.folders.map((f) => (
              <li key={f.path} className="flex items-start gap-2">
                <code className="mono shrink-0">{f.path}/</code>
                <span className="flex-1">{f.explain}</span>
                <Tag color={DIFF[f.difficulty]}>{f.difficulty}</Tag>
                {f.startHere && <Tag color="green">start here</Tag>}
              </li>
            ))}</ul>
          </div>
          {a.glossary.length > 0 && (
            <div>
              <p className="fs-12-5 font-semibold mb-1">Words this project uses</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 fs-13">{a.glossary.map((g) => <Fragment key={g.term}><dt className="font-medium">{g.term}</dt><dd className="text-[var(--text-2)]">{g.meaning}</dd></Fragment>)}</dl>
            </div>
          )}
          <p className="fs-12 text-[var(--muted)]">By {res.model} ({res.provider}) for commit {res.sha.slice(0, 7)} · AI can be wrong; the map above is from the repo itself. <button onClick={() => run(true)} className="text-[var(--link)] hover:underline" disabled={busy}>Regenerate</button></p>
        </div>
      )}
    </Block>
  );
}
