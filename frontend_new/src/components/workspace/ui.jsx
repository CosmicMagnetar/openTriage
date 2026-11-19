/**
 * Small presentational pieces shared by the coordination pages.
 * Uses the app's existing dark palette; no new visual language.
 */
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

export const tone = {
  blue: 'bg-[hsl(217,91%,60%,0.12)] text-[hsl(217,91%,70%)] border-[hsl(217,91%,60%,0.25)]',
  green: 'bg-[hsl(142,70%,45%,0.12)] text-[hsl(142,70%,60%)] border-[hsl(142,70%,45%,0.25)]',
  amber: 'bg-[hsl(38,92%,50%,0.12)] text-[hsl(38,92%,65%)] border-[hsl(38,92%,50%,0.25)]',
  red: 'bg-[hsl(0,72%,55%,0.12)] text-[hsl(0,72%,68%)] border-[hsl(0,72%,55%,0.25)]',
  gray: 'bg-[hsl(220,13%,14%)] text-[hsl(210,11%,65%)] border-[hsl(220,13%,20%)]',
  purple: 'bg-[hsl(270,70%,60%,0.12)] text-[hsl(270,70%,75%)] border-[hsl(270,70%,60%,0.25)]',
};

export function Chip({ color = 'gray', children, title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${tone[color]}`}>
      {children}
    </span>
  );
}

export function Page({ title, subtitle, actions, children }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 pt-16 lg:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[hsl(210,11%,92%)]">{title}</h1>
            {subtitle && <p className="text-sm text-[hsl(210,11%,55%)] mt-1">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Panel({ title, icon: Icon, right, children, className = '' }) {
  return (
    <section className={`bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-xl ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(220,13%,14%)]">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(210,11%,85%)]">
            {Icon && <Icon className="w-4 h-4 text-[hsl(210,11%,55%)]" />}
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ExtLink({ href, children, className = '' }) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-[hsl(217,91%,68%)] hover:underline ${className}`}>
      {children}
      <ExternalLink className="w-3 h-3 opacity-70" />
    </a>
  );
}

export function Evidence({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {items.map((e, i) => (
        <li key={i} className="text-xs text-[hsl(210,11%,55%)] flex flex-wrap items-center gap-x-2">
          <span className="text-[hsl(210,11%,40%)]">evidence</span>
          {e.url ? <ExtLink href={e.url}>{e.label}</ExtLink> : <span>{e.label}</span>}
          {e.at && <span className="text-[hsl(210,11%,40%)]">· {timeAgo(e.at)}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[hsl(210,11%,55%)] py-8 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-[hsl(0,72%,55%,0.3)] bg-[hsl(0,72%,55%,0.08)] text-sm text-[hsl(0,72%,75%)]">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="text-xs underline hover:no-underline">Retry</button>
      )}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="text-center py-10 px-4 border border-dashed border-[hsl(220,13%,18%)] rounded-xl">
      <p className="text-sm font-medium text-[hsl(210,11%,75%)]">{title}</p>
      {children && <div className="text-sm text-[hsl(210,11%,50%)] mt-2">{children}</div>}
    </div>
  );
}

export const inputClass =
  'bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm text-[hsl(210,11%,88%)] placeholder:text-[hsl(210,11%,40%)] focus:outline-none focus:border-[hsl(217,91%,60%,0.6)]';

export const buttonClass =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,55%)] text-white disabled:opacity-50 transition-colors';

export const ghostButtonClass =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[hsl(210,11%,75%)] border border-[hsl(220,13%,18%)] hover:bg-[hsl(220,13%,12%)] disabled:opacity-50 transition-colors';

export function timeAgo(iso) {
  if (!iso) return '';
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1 / 24) return 'just now';
  if (days < 1) return `${Math.round(days * 24)}h ago`;
  if (days < 30) return `${Math.round(days)}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export const AVAILABILITY = {
  available: { label: 'Available', color: 'green' },
  claimed: { label: 'Claimed', color: 'red' },
  claimed_stale: { label: 'Stale claim', color: 'amber' },
  in_progress: { label: 'PR open', color: 'red' },
  in_progress_stalled: { label: 'PR stalled', color: 'amber' },
  likely_done: { label: 'Likely done', color: 'gray' },
  closed: { label: 'Closed', color: 'gray' },
};

export const VERDICT = {
  good_pick: { label: 'Good pick', color: 'green' },
  ask_first: { label: 'Ask first', color: 'amber' },
  avoid: { label: 'Avoid', color: 'red' },
};

export const RESPONSIVENESS = {
  responsive: { label: 'Responsive maintainers', color: 'green' },
  slow: { label: 'Slow responses', color: 'amber' },
  unresponsive: { label: 'Rarely responds', color: 'red' },
  unknown: { label: 'Responsiveness unknown', color: 'gray' },
};

export const ACTION = {
  ci_failing: { label: 'CI failing', color: 'red' },
  changes_requested: { label: 'Changes requested', color: 'amber' },
  merge_conflict: { label: 'Merge conflict', color: 'amber' },
  question_waiting: { label: 'Question waiting', color: 'purple' },
  review_pending: { label: 'Review pending', color: 'blue' },
  newcomer_waiting: { label: 'Newcomer waiting', color: 'purple' },
  ready_to_merge: { label: 'Ready to merge', color: 'green' },
  stalled: { label: 'Stalled', color: 'gray' },
  stale_claim: { label: 'Stale claim', color: 'amber' },
  duplicate_effort: { label: 'Duplicate effort', color: 'red' },
  likely_done: { label: 'Likely done', color: 'gray' },
};

export function waitingOnLabel(w, me) {
  if (!w) return '';
  if (w.kind === 'maintainers') return 'Maintainers';
  if (me && w.login?.toLowerCase() === me.toLowerCase()) return 'You';
  return `@${w.login}`;
}
