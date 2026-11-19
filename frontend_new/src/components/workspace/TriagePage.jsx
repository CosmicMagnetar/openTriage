/**
 * Triage board (maintainer): every incoming issue in the repos you track, in
 * four columns. Drag a card (or select several) to another column to change
 * its labels on GitHub, always after you confirm. Send a saved reply to the
 * selected issues in one go.
 */
import { useMemo, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import { keys, workApi } from '../../services/workApi';
import { REFRESH_MS, invalidate, useQuery } from '../../lib/query';
import { prefetchItem, useItemPanel } from './useWorkspace';
import { Button, Confirm, ErrorLine, Page, SkeletonRows, Tag, timeAgo, useMotionOn } from './ui';
import { COLUMNS, columnFor, labelChanges } from './triage';
import { motion } from 'framer-motion';

const keyOf = (r) => `${r.owner}/${r.repo}#${r.number}`;

function Card({ r, selected, onSelect, onOpen, dragging, setDragging }) {
  const motionOn = useMotionOn();
  const Wrap = motionOn ? motion.div : 'div';
  return (
    <Wrap layout={motionOn ? 'position' : undefined} transition={{ duration: 0.18 }}
      draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', keyOf(r)); setDragging(keyOf(r)); }} onDragEnd={() => setDragging(null)}
      className={`group rounded-[10px] border bg-[var(--panel)] p-3 cursor-grab active:cursor-grabbing transition-colors ${selected ? 'border-[var(--pop)]' : 'border-[var(--line)] hover:border-[var(--muted)]'} ${dragging === keyOf(r) ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2.5">
        <input type="checkbox" checked={selected} onChange={() => onSelect(keyOf(r))} aria-label={`Select ${r.title}`} className="mt-1" style={{ accentColor: 'var(--pop)' }} />
        <button onClick={() => onOpen(r)} onMouseEnter={() => prefetchItem({ kind: 'issue', owner: r.owner, repo: r.repo, number: r.number })} className="flex-1 min-w-0 text-left">
          <span className="block fs-14 leading-snug">{r.title}</span>
          <span className="mt-1.5 flex items-center gap-2 fs-12 text-[var(--muted)]">
            <img src={`https://github.com/${r.author}.png?size=40`} alt="" className="w-4 h-4 rounded-full" loading="lazy" />
            <span className="truncate">@{r.author}</span>
            <span className="mono">{r.repo}#{r.number}</span>
            <span className="ml-auto">{timeAgo(r.createdAt)}</span>
          </span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            {r.authorIsNewcomer && <Tag color="purple">First-time</Tag>}
            {(r.labels ?? []).slice(0, 3).map((l) => <Tag key={typeof l === 'string' ? l : l.name}>{typeof l === 'string' ? l : l.name}</Tag>)}
          </span>
        </button>
      </div>
    </Wrap>
  );
}

export default function TriagePage() {
  const inbox = useQuery(keys.inbox(), (o) => workApi.inbox(o), { staleMs: REFRESH_MS });
  const replies = useQuery(keys.replies(), () => workApi.savedReplies(), { staleMs: 5 * 60_000 });
  const { open } = useItemPanel();
  const [selected, setSelected] = useState(new Set());
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [pending, setPending] = useState(null); // { items, to } or { items, reply }
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState({}); // key -> column, optimistic

  const rows = useMemo(() => (inbox.data?.rows ?? []).filter((r) => !r.isPR), [inbox.data]);
  const byKey = useMemo(() => new Map(rows.map((r) => [keyOf(r), r])), [rows]);
  const col = (r) => moved[keyOf(r)] ?? columnFor(r.labels);
  const toggle = (k) => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const ask = (keysList, to) => {
    const items = keysList.map((k) => byKey.get(k)).filter((r) => r && col(r) !== to);
    if (items.length) setPending({ items, to });
  };

  const run = async () => {
    setBusy(true);
    let ok = 0;
    try {
      if (pending.to) {
        for (const r of pending.items) {
          const { add, remove } = labelChanges(r.labels, pending.to);
          try {
            if (remove.length) await workApi.removeLabels(r.owner, r.repo, r.number, remove);
            if (add.length) await workApi.addLabels(r.owner, r.repo, r.number, add);
            setMoved((m) => ({ ...m, [keyOf(r)]: pending.to }));
            ok += 1;
          } catch (err) {
            toast.error(`${r.repo}#${r.number}: ${err.message}`);
          }
        }
        if (ok) toast.success(`Moved ${ok} issue${ok > 1 ? 's' : ''} to ${COLUMNS.find((c) => c.id === pending.to).title}`);
      } else if (pending.reply) {
        for (const r of pending.items) {
          try { await workApi.comment(r.owner, r.repo, r.number, pending.reply.body); ok += 1; } catch (err) { toast.error(`${r.repo}#${r.number}: ${err.message}`); }
        }
        if (ok) toast.success(`Replied on ${ok} issue${ok > 1 ? 's' : ''}`);
      }
      setSelected(new Set());
      invalidate('inbox');
      inbox.refresh();
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const replyList = Array.isArray(replies.data) ? replies.data : [];
  const sel = [...selected];

  return (
    <Page title="Triage"
      subtitle="Every new issue in your repos, sorted by what it needs. Drag to another column to change its labels on GitHub; you confirm every change."
      refreshing={inbox.isRefreshing} updatedAt={inbox.updatedAt} onRefresh={() => inbox.refresh()}
      toolbar={sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 card px-3 py-2">
          <span className="fs-13 font-semibold">{sel.length} selected</span>
          <span className="fs-13 text-[var(--muted)]">Move to</span>
          {COLUMNS.map((c) => <Button key={c.id} size="sm" onClick={() => ask(sel, c.id)}>{c.title}</Button>)}
          {replyList.length > 0 && (
            <select defaultValue="" aria-label="Send a saved reply" className="ctl-sm px-2 rounded-md fs-12-5 bg-[var(--inset)] border border-[var(--line)]"
              onChange={(e) => { const reply = replyList.find((x) => String(x.id) === e.target.value); if (reply) setPending({ items: sel.map((k) => byKey.get(k)).filter(Boolean), reply }); e.target.value = ''; }}>
              <option value="" disabled>Saved reply…</option>
              {replyList.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          <Button size="sm" variant="subtle" onClick={() => setSelected(new Set())}><X className="w-3.5 h-3.5" /> Clear</Button>
        </div>
      )}>
      <div className="px-8 py-6">
        {inbox.error && <ErrorLine message={inbox.error.message} onRetry={inbox.refresh} />}
        {!inbox.data && !inbox.error && <SkeletonRows />}
        {inbox.data?.hint && <p className="fs-14 text-[var(--muted)]">{inbox.data.hint}</p>}
        {inbox.data && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 items-start">
            {COLUMNS.map((c) => {
              const list = rows.filter((r) => col(r) === c.id);
              return (
                <section key={c.id} style={{ '--hue': c.hue }}
                  onDragOver={(e) => { e.preventDefault(); setOver(c.id); }} onDragLeave={() => setOver(null)}
                  onDrop={(e) => { e.preventDefault(); setOver(null); const k = e.dataTransfer.getData('text/plain'); ask(selected.has(k) ? sel : [k], c.id); }}
                  className={`rounded-xl p-3 min-h-[200px] transition-colors ${over === c.id ? 'bg-[color-mix(in_srgb,var(--hue)_12%,transparent)] outline outline-1 outline-[var(--hue)]' : 'bg-[var(--inset)]'}`}>
                  <header className="flex items-center gap-2 px-1 pb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.hue }} />
                    <h2 className="fs-14 font-semibold">{c.title}</h2>
                    <span className="mono fs-12 text-[var(--muted)]">{list.length}</span>
                    {c.label && <span className="ml-auto fs-11-5 text-[var(--faint)] truncate" title="Label added on GitHub">{c.label}</span>}
                  </header>
                  <p className="px-1 -mt-2 pb-3 fs-12 text-[var(--muted)]">{c.hint}</p>
                  <div className="space-y-2">
                    {list.map((r) => (
                      <Card key={keyOf(r)} r={r} selected={selected.has(keyOf(r))} onSelect={toggle}
                        onOpen={(x) => open({ kind: 'issue', owner: x.owner, repo: x.repo, number: x.number })}
                        dragging={dragging} setDragging={setDragging} />
                    ))}
                    {list.length === 0 && <p className="px-1 py-6 text-center fs-12-5 text-[var(--faint)]">Drop issues here</p>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <Confirm open={!!pending} busy={busy} onCancel={() => setPending(null)} onConfirm={run}
        title={pending?.reply ? `Post "${pending.reply.name}"?` : `Move to ${COLUMNS.find((c) => c.id === pending?.to)?.title}?`}
        confirmLabel={pending?.reply ? 'Post replies' : 'Change labels'}>
        {pending?.to && (
          <ul className="space-y-1.5 max-h-60 overflow-auto">
            {pending.items.map((r) => {
              const { add, remove } = labelChanges(r.labels, pending.to);
              return (
                <li key={keyOf(r)} className="fs-13">
                  <span className="mono text-[var(--muted)]">{r.repo}#{r.number}</span>{' '}
                  {add.length > 0 && <span className="text-[var(--green)]">+ {add.join(', ')}</span>}{' '}
                  {remove.length > 0 && <span className="text-[var(--red)]">− {remove.join(', ')}</span>}
                  {!add.length && !remove.length && <span className="text-[var(--muted)]">no label change</span>}
                </li>
              );
            })}
          </ul>
        )}
        {pending?.reply && (
          <>
            <p className="inline-flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> On {pending.items.length} issue{pending.items.length > 1 ? 's' : ''}, as you:</p>
            <p className="mt-2 p-2 rounded-md bg-[var(--inset)] fs-13 whitespace-pre-wrap max-h-40 overflow-auto">{pending.reply.body}</p>
          </>
        )}
      </Confirm>
    </Page>
  );
}
