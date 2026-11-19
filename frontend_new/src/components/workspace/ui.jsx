/**
 * Workspace UI kit. Dense rows instead of cards, colour only for state,
 * monospace for references. Every page and the item panel use these.
 */
import { forwardRef, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import usePrefs from '../../stores/prefsStore';

// ---------------------------------------------------------------------------
// Motion (all respect Settings → Motion and prefers-reduced-motion)
// ---------------------------------------------------------------------------

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True when animation is allowed (Settings → Motion and the OS setting). */
export function useMotionOn() {
  return usePrefs((s) => s.motion) && !reducedMotion();
}

/** Slow drifting light behind the workspace, tinted by the accent colour. */
export function Ambient() {
  return (
    <div aria-hidden className="ambient">
      <span className="ambient-a" />
      <span className="ambient-b" />
      <span className="ambient-grain" />
    </div>
  );
}

/** Rows fade/slide in with a short stagger the first time a list appears. */
export function Stagger({ children, as = 'div' }) {
  const motionOn = usePrefs((s) => s.motion) && !reducedMotion();
  const M = motion[as];
  if (!motionOn) return <>{children}</>;
  return (
    <M initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.025 } } }}>
      {children}
    </M>
  );
}

export function StaggerItem({ children }) {
  const motionOn = usePrefs((s) => s.motion) && !reducedMotion();
  if (!motionOn) return <>{children}</>;
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0, transition: { duration: 0.18 } } }}>
      {children}
    </motion.div>
  );
}

/** Number that counts up when it changes. */
export function CountUp({ value }) {
  const motionOn = usePrefs((s) => s.motion) && !reducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (!motionOn || typeof value !== 'number') { setShown(value); return undefined; }
    const from = typeof prev.current === 'number' ? prev.current : 0;
    prev.current = value;
    if (from === value) { setShown(value); return undefined; }
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 400);
      setShown(Math.round(from + (value - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, motionOn]);
  return <>{shown}</>;
}

/** A small burst of coloured dots from a point (e.g. the button that was clicked). */
export function celebrate(x = window.innerWidth / 2, y = window.innerHeight / 2) {
  if (!usePrefs.getState().motion || reducedMotion()) return;
  const root = document.querySelector('.ot') ?? document.body;
  const colors = ['var(--accent)', 'var(--green)', 'var(--purple)', 'var(--amber)', 'var(--blue)'];
  for (let i = 0; i < 18; i++) {
    const d = document.createElement('span');
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const dist = 40 + Math.random() * 50;
    d.className = 'burst-dot';
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    d.style.background = colors[i % colors.length];
    d.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    d.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    root.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }
}

export function DrawnCheck({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="draw-check inline-block" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// State vocabulary (one meaning per colour, everywhere)
// ---------------------------------------------------------------------------

export const STATE = {
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  purple: 'var(--purple)',
  blue: 'var(--blue)',
  gray: 'var(--faint)',
};

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
  responsive: { label: 'Responsive', color: 'green' },
  slow: { label: 'Slow to respond', color: 'amber' },
  unresponsive: { label: 'Rarely responds', color: 'red' },
  unknown: { label: 'Response unknown', color: 'gray' },
};

export const ACTION = {
  ci_failing: { label: 'CI failing', color: 'red' },
  changes_requested: { label: 'Changes requested', color: 'amber' },
  merge_conflict: { label: 'Conflicts', color: 'amber' },
  question_waiting: { label: 'Question', color: 'purple' },
  review_pending: { label: 'Needs review', color: 'blue' },
  newcomer_waiting: { label: 'Newcomer waiting', color: 'purple' },
  ready_to_merge: { label: 'Ready to merge', color: 'green' },
  stalled: { label: 'Stalled', color: 'gray' },
  stale_claim: { label: 'Stale claim', color: 'amber' },
  duplicate_effort: { label: 'Duplicate effort', color: 'red' },
  likely_done: { label: 'Likely done', color: 'gray' },
};

export const CHECKS = {
  SUCCESS: { label: 'Checks pass', color: 'green' },
  FAILURE: { label: 'Checks fail', color: 'red' },
  ERROR: { label: 'Checks error', color: 'red' },
  PENDING: { label: 'Checks running', color: 'amber' },
  EXPECTED: { label: 'Checks pending', color: 'amber' },
};

export const REVIEW = {
  APPROVED: { label: 'Approved', color: 'green' },
  CHANGES_REQUESTED: { label: 'Changes requested', color: 'amber' },
  REVIEW_REQUIRED: { label: 'Review required', color: 'blue' },
};

export function waitingOnLabel(w, me) {
  if (!w) return '';
  if (w.kind === 'maintainers') return 'maintainers';
  if (me && w.login?.toLowerCase() === me.toLowerCase()) return 'you';
  return `@${w.login}`;
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

export function Dot({ color = 'gray', pulse = false, title }) {
  return (
    <span
      title={title}
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${pulse ? 'pulse' : ''}`}
      style={{ background: STATE[color] ?? color }}
    />
  );
}

/**
 * Liveness heartbeat: the signature mark for every item.
 * Active states beat, amber (stale) beats slowly, gray (done/dead) is flat.
 */
const RHYTHM = { green: 'fast', blue: 'fast', purple: 'fast', red: 'fast', amber: 'slow', gray: 'flat' };
export function Pulse({ color = 'gray', title, size = 18 }) {
  const rhythm = RHYTHM[color] ?? 'fast';
  const c = STATE[color] ?? color;
  const d = rhythm === 'flat' ? 'M1 6h16' : 'M1 6h4l1.5-3.5L9 10l1.8-6L12 6h5';
  return (
    <span title={title} className={`pulse-mark pulse-${rhythm}`} style={{ '--c': c, width: size }}>
      <svg viewBox="0 0 18 12" width={size} height={size * 0.67} aria-hidden>
        <path d={d} className="pulse-trace" />
        <path d={d} className="pulse-line" />
      </svg>
    </span>
  );
}

/**
 * Who holds the baton: contributor → CI → maintainers, with the current
 * holder lit and the baton sliding to it.
 */
export function Baton({ action, me }) {
  const motionOn = useMotionOn();
  if (!action?.waitingOn) return null;
  const onMaintainers = action.waitingOn.kind === 'maintainers';
  const holder = onMaintainers ? 2 : action.type === 'ci_failing' ? 1 : 0;
  const person = onMaintainers ? 'contributor' : waitingOnLabel(action.waitingOn, me);
  const stops = [person, 'CI', 'maintainers'];
  const color = STATE[(ACTION[action.type] ?? {}).color] ?? 'var(--accent)';
  return (
    <div className="baton" style={{ '--c': color }} aria-label={`Waiting on ${stops[holder]}`}>
      <div className="baton-track">
        {motionOn ? (
          <motion.span className="baton-fill" initial={{ width: 0 }} animate={{ width: `${holder * 50}%` }}
            transition={{ duration: 0.6, ease: [0.2, 0.7, 0.3, 1] }} />
        ) : <span className="baton-fill" style={{ width: `${holder * 50}%` }} />}
        {stops.map((label, i) => (
          <span key={label + i} className={`baton-stop ${i === holder ? 'is-holder' : i < holder ? 'is-past' : ''}`}
            style={{ left: `${i * 50}%` }}>
            <span className="baton-dot" />
            <span className="baton-label">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Quiet text tag; colour only on the dot. */
export function Tag({ color, children, title, mono = false }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 h-5 px-1.5 rounded border text-[11px] whitespace-nowrap ${mono ? 'mono' : ''}`}
      style={{ borderColor: 'var(--line)', color: 'var(--text-2)' }}
    >
      {color && <Dot color={color} />}
      {children}
    </span>
  );
}

export function Kbd({ children }) {
  return (
    <kbd className="mono inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border text-[10px]"
      style={{ borderColor: 'var(--line)', color: 'var(--muted)', background: 'var(--raised)' }}>
      {children}
    </kbd>
  );
}

export const Button = forwardRef(function Button({ variant = 'ghost', size = 'md', className = '', children, ...rest }, ref) {
  const base = 'btn inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none';
  const sizes = { sm: 'h-6 px-2 text-[12px]', md: 'h-7 px-2.5 text-[12.5px]' };
  const variants = {
    primary: 'btn-primary text-[#0b0c0e] bg-[var(--accent)] hover:brightness-110',
    ghost: 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)] border border-[var(--line)]',
    subtle: 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]',
    danger: 'text-[var(--red)] hover:bg-[rgba(248,81,73,0.1)] border border-[var(--line)]',
  };
  return (
    <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
});

export const Input = forwardRef(function Input({ className = '', ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`h-7 px-2.5 rounded-md text-[12.5px] bg-[var(--panel)] border border-[var(--line)] text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--accent)] ${className}`}
      {...rest}
    />
  );
});

export function Textarea({ className = '', ...rest }) {
  return (
    <textarea
      className={`w-full px-2.5 py-2 rounded-md text-[12.5px] bg-[var(--panel)] border border-[var(--line)] text-[var(--text)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--accent)] resize-y ${className}`}
      {...rest}
    />
  );
}

export function ExtLink({ href, children, className = '' }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-0.5 hover:text-[var(--text)] hover:underline underline-offset-2 ${className}`}
      onClick={(e) => e.stopPropagation()}>
      {children}
      <ArrowUpRight className="w-3 h-3 opacity-60" />
    </a>
  );
}

export function Ref({ owner, repo, number, className = '' }) {
  return <span className={`mono text-[var(--faint)] ${className}`}>{owner}/{repo}#{number}</span>;
}

export function timeAgo(iso) {
  if (!iso) return '';
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1 / 24) return 'now';
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Page frame: sticky header with title, count, refresh state and actions. */
export function Page({ title, count, subtitle, actions, toolbar, refreshing, updatedAt, onRefresh, children }) {
  return (
    <div className="h-full flex flex-col min-w-0">
      <header className="shrink-0 border-b border-[var(--line-soft)] px-5 pt-4 pb-3 pl-14 lg:pl-5">
        <div className="flex items-center gap-3 min-h-[28px]">
          <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
          {count !== undefined && <span className="mono text-[var(--faint)]"><CountUp value={count} /></span>}
          {onRefresh && (
            <button onClick={onRefresh} title="Refresh (r)"
              className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--faint)] hover:text-[var(--text-2)]">
              <Dot color={refreshing ? 'blue' : 'gray'} pulse={refreshing} />
              {refreshing ? 'updating' : updatedAt ? `updated ${timeAgo(new Date(updatedAt).toISOString())} ago` : ''}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
        {subtitle && <p className="text-[12px] text-[var(--muted)] mt-0.5">{subtitle}</p>}
        {toolbar && <div className="mt-3 flex flex-wrap items-center gap-2">{toolbar}</div>}
      </header>
      <div className="flex-1 scroll">{children}</div>
    </div>
  );
}

export function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-1.5">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--faint)]">{children}</h2>
      {right}
    </div>
  );
}

/** Dense list row. `selected` is driven by keyboard navigation. */
export function Row({ selected, onClick, onMouseEnter, lead, title, meta, right, children, id }) {
  return (
    <div
      id={id}
      role="button"
      tabIndex={-1}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{ paddingTop: 'var(--row-py)', paddingBottom: 'var(--row-py)' }}
      className={`ot-row group relative flex items-start gap-3 px-5 border-b border-[var(--line-soft)] cursor-pointer hover:bg-[var(--hover)] transition-colors ${selected ? 'row-selected' : ''}`}
    >
      <div className="pt-[3px]">{lead}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="truncate text-[13px] text-[var(--text)]">{title}</span>
        </div>
        {meta && <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--muted)]">{meta}</div>}
        {children}
      </div>
      {right && <div className="shrink-0 flex items-center gap-1.5 pt-0.5">{right}</div>}
    </div>
  );
}

const SCAN_LINES = ['Reading GitHub', 'Checking who is on it', 'Finding who acts next'];

/**
 * First-load state (only when nothing is cached yet): a heartbeat being drawn
 * and what is being checked, instead of grey placeholder bars.
 * Kept as `SkeletonRows` so every page uses it without changes.
 */
export function SkeletonRows({ n = 6 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SCAN_LINES.length), 1400);
    return () => clearInterval(t);
  }, []);
  const compact = n <= 3;
  return (
    <div role="status" aria-live="polite" className={`scan ${compact ? 'scan-compact' : ''}`}>
      <svg viewBox="0 0 120 30" className="scan-ecg" aria-hidden>
        <path d="M0 15h34l5-10 7 22 6-18 4 6h64" />
      </svg>
      <span className="scan-text">{SCAN_LINES[i]}<span className="scan-dots" /></span>
    </div>
  );
}

/** Small animated scenes for empty states. */
function EmptyArt({ art }) {
  if (art === 'search') {
    return (
      <svg viewBox="0 0 96 64" className="empty-art" aria-hidden>
        <circle cx="40" cy="30" r="14" className="ea-stroke" />
        <path d="M50 40l12 12" className="ea-stroke" />
        <circle cx="40" cy="30" r="3" className="ea-dot ea-orbit" />
        <path d="M8 58h80" className="ea-ground" />
      </svg>
    );
  }
  if (art === 'start') {
    return (
      <svg viewBox="0 0 96 64" className="empty-art" aria-hidden>
        <path d="M14 46h68" className="ea-ground" />
        <circle cx="22" cy="46" r="4" className="ea-dot" />
        <circle cx="48" cy="46" r="4" className="ea-dot ea-d2" />
        <circle cx="74" cy="46" r="4" className="ea-dot ea-d3" />
        <rect x="16" y="20" width="12" height="6" rx="3" className="ea-baton" />
      </svg>
    );
  }
  // calm: everyone has what they need
  return (
    <svg viewBox="0 0 96 64" className="empty-art" aria-hidden>
      <circle cx="48" cy="30" r="20" className="ea-ring" />
      <circle cx="48" cy="30" r="12" className="ea-ring ea-r2" />
      <path d="M40 30.5l5.5 5.5L57 24.5" className="ea-check" />
      <path d="M8 58h80" className="ea-ground" />
    </svg>
  );
}

export function Empty({ title, children, action, art = 'calm' }) {
  const motionOn = useMotionOn();
  const Wrap = motionOn ? motion.div : 'div';
  const anim = motionOn ? { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } } : {};
  return (
    <Wrap className="px-5 py-14 text-center" {...anim}>
      <EmptyArt art={art} />
      <p className="text-[13.5px] font-medium text-[var(--text)] mt-3">{title}</p>
      {children && <div className="text-[12px] text-[var(--muted)] mt-1.5 max-w-md mx-auto">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </Wrap>
  );
}

export function ErrorLine({ message, onRetry }) {
  return (
    <div className="mx-5 my-4 flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
      <Dot color="red" />
      <span className="flex-1">{message}</span>
      {onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

/** Segmented filter: [{ value, label, count }] */
export function Segments({ value, onChange, options }) {
  return (
    <div className="inline-flex p-0.5 rounded-md border border-[var(--line)] bg-[var(--panel)]">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`h-6 px-2.5 rounded text-[12px] inline-flex items-center gap-1.5 ${value === o.value
            ? 'bg-[var(--raised)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--line)]'
            : 'text-[var(--muted)] hover:text-[var(--text-2)]'}`}>
          {o.label}
          {o.count !== undefined && <span className="mono text-[10.5px] text-[var(--faint)]">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Small labelled block used inside the item panel. */
export function Block({ title, right, children }) {
  return (
    <section className="py-3.5 border-b border-[var(--line-soft)]">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--faint)]">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Evidence({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {items.map((e, i) => (
        <li key={i} className="text-[12px] text-[var(--muted)] flex flex-wrap items-center gap-x-1.5">
          <span className="text-[var(--faint)]">↳</span>
          {e.url ? <ExtLink href={e.url}>{e.label}</ExtLink> : <span>{e.label}</span>}
          {e.at && <span className="text-[var(--faint)]">{timeAgo(e.at)}</span>}
        </li>
      ))}
    </ul>
  );
}
