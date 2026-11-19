/**
 * Keeps the page area from ever going blank:
 * - lazyRetry: page code that fails to load (e.g. after a deploy or a dev
 *   re-optimise) is retried once before giving up.
 * - PageFallback: while page code loads, show the page's own header, so the
 *   screen always says where you are.
 * - PageBoundary: if a page still fails, say so and offer a reload instead of
 *   leaving an empty area.
 */
import { Component, lazy } from 'react';
import { RotateCw } from 'lucide-react';
import { pageMeta } from './nav';

export function lazyRetry(load) {
  return lazy(() => load().catch(() => new Promise((r) => setTimeout(r, 400)).then(load)));
}

export function PageFallback({ ws, pathname }) {
  const meta = pageMeta(ws, pathname);
  const Icon = meta?.icon;
  return (
    <div className="h-full flex flex-col" style={meta?.hue ? { '--hue': meta.hue } : undefined}>
      <header className="page-head shrink-0 border-b border-[var(--line)] px-8 pt-6 pb-4">
        <div className="flex items-center gap-3 min-h-[32px]">
          {Icon && <span className="chip chip-lg"><Icon /></span>}
          <h1 className="fs-24 font-semibold tracking-tight">{meta?.label ?? 'OpenTriage'}</h1>
        </div>
      </header>
      <p role="status" className="px-8 py-6 fs-13-5 text-[var(--muted)]">Opening {meta?.label ?? 'this page'}.</p>
    </div>
  );
}

export class PageBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[PageBoundary]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="card p-6 max-w-md text-center">
          <p className="fs-16 font-semibold">This page didn't load</p>
          <p className="fs-13-5 text-[var(--muted)] mt-1">Usually a new version was just published. Reloading fixes it.</p>
          <button onClick={() => window.location.reload()}
            className="mt-4 ctl inline-flex items-center gap-2 px-3 rounded-md fs-13 font-semibold bg-[var(--pop)] text-[var(--pop-ink)]">
            <RotateCw className="w-3.5 h-3.5" /> Reload
          </button>
        </div>
      </div>
    );
  }
}
