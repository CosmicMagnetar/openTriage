/**
 * Help: press ? anywhere (or the sidebar Help button). Explains what each page
 * is for, what the colours mean, and every shortcut.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { isTypingTarget } from './useWorkspace';
import { Dot, Kbd } from './ui';

export function openHelp() {
  window.dispatchEvent(new CustomEvent('ot:help'));
}

const PAGES = {
  contributor: [
    ['Today', 'What is waiting on you right now (changes requested, failing CI, questions for you, claims going stale), then issues picked for you.'],
    ['Find work', 'Issues nobody is on yet. “For you” uses your languages and the repos you contribute to or starred; “Search” is open-ended.'],
    ['My work', 'Your open PRs, reviews you owe, and issues you claimed.'],
    ['Repo lens', 'How a repository is laid out, how to run it, who reviews what, and whether maintainers respond.'],
  ],
  maintainer: [
    ['Today', 'What is waiting on you across the repos you track: newcomers without a reply, reviews, PRs ready to merge, duplicate work.'],
    ['Inbox', 'Incoming issues, untriaged first, with a suggested label and possible duplicates. Reply or label without leaving the page.'],
    ['Pull requests', 'Open PRs grouped by what they need next.'],
    ['Repo lens', 'The newcomer’s view of your repo — useful to spot missing docs.'],
  ],
};

const COLOURS = [
  ['green', 'Good to go: available, passing, ready to merge'],
  ['amber', 'Waiting or getting stale'],
  ['red', 'Blocked or someone is already on it'],
  ['purple', 'A person is waiting: newcomer or open question'],
  ['blue', 'Needs a review'],
];

const KEYS = [
  [['⌘', 'K'], 'Jump anywhere: paste a GitHub link, owner/repo#12, or search'],
  [['j'], 'Next item (also switches the open panel)'],
  [['k'], 'Previous item'],
  [['↵'], 'Open the selected item'],
  [['esc'], 'Close the panel or dialog'],
  [['r'], 'Refresh the current page'],
  [['⌘', '↵'], 'Post the reply you are writing'],
  [['?'], 'This help'],
];

export default function HelpOverlay({ workspace }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '?' && !isTypingTarget(document.activeElement)) { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('ot:help', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('ot:help', onOpen); };
  }, []);

  if (!open) return null;
  return (
    <div data-palette-open className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-black/55" onMouseDown={() => setOpen(false)}>
      <div className="w-[min(720px,94vw)] max-h-[84vh] scroll rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center h-11 px-4 border-b border-[var(--line-soft)]">
          <h2 className="fs-13-5 font-semibold">How OpenTriage helps</h2>
          <button onClick={() => setOpen(false)} aria-label="Close help" className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-6">
          <section>
            <h3 className="fs-11 uppercase tracking-[0.06em] text-[var(--faint)] mb-2">Pages</h3>
            <ul className="space-y-2.5">
              {PAGES[workspace].map(([t, d]) => (
                <li key={t}><p className="fs-12-5 text-[var(--text)]">{t}</p><p className="fs-12 text-[var(--muted)]">{d}</p></li>
              ))}
            </ul>
            <p className="mt-3 fs-12 text-[var(--muted)]">Switch between Contributor and Maintainer at the bottom of the sidebar — same account, different view.</p>
          </section>
          <section className="space-y-5">
            <div>
              <h3 className="fs-11 uppercase tracking-[0.06em] text-[var(--faint)] mb-2">Colours</h3>
              <ul className="space-y-1.5">
                {COLOURS.map(([c, d]) => <li key={c} className="flex items-center gap-2 fs-12 text-[var(--text-2)]"><Dot color={c} />{d}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="fs-11 uppercase tracking-[0.06em] text-[var(--faint)] mb-2">Keyboard</h3>
              <ul className="space-y-1.5">
                {KEYS.map(([ks, d]) => (
                  <li key={d} className="flex items-center gap-2 fs-12 text-[var(--text-2)]">
                    <span className="inline-flex gap-1 w-14">{ks.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>{d}
                  </li>
                ))}
              </ul>
            </div>
            <p className="fs-12 text-[var(--muted)]">Everything comes from GitHub and works without AI. Replies and claims you post here appear on GitHub as you.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
