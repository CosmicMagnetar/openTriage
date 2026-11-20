/**
 * First-visit welcome, one per workspace. Three short steps in plain words:
 * what this workspace is for, set it up, first thing to do. Skippable;
 * Settings → Suggestions → "Show the welcome again" brings it back.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Compass, GitPullRequest, ArrowRight, Inbox, LineChart, MessageSquare, Trophy, Users } from 'lucide-react';
import usePrefs from '../../stores/prefsStore';
import { InterestsEditor } from './opportunities';
import { Button, useMotionOn } from './ui';

const COPY = {
  contributor: {
    title: 'Welcome to your contributor workspace',
    intro: 'This is where you find open-source work worth doing, keep track of everything you contribute, and grow from first PR to regular contributor.',
    points: [
      [Compass, 'Find work that is free', 'Issues nobody else is on, in repos where maintainers still reply.'],
      [LineChart, 'Track your journey', 'Every PR, merge and review you make, with milestones you can share.'],
      [Trophy, 'Get opportunities', 'Programs like GSoC and Outreachy, with dates and who can apply.'],
    ],
    setupTitle: 'What do you like working on?',
    setupText: 'We read your GitHub to guess. Add or remove anything — it only changes what we suggest.',
    quests: [
      [MessageSquare, 'Comment on an issue you could fix', 'Ask the maintainer if it is free before you start.', '/dashboard/find'],
      [GitPullRequest, 'Look at your open pull requests', 'See which ones are waiting on you.', '/dashboard/mine'],
      [BookOpen, 'Read a repo before you contribute', 'Setup steps, who to ask, where newcomers start.', '/dashboard/lens'],
    ],
  },
  maintainer: {
    title: 'Welcome to your maintainer workspace',
    intro: 'This is where you keep your projects moving: reply to people waiting, review and merge faster, and make sure newcomers do not get lost.',
    points: [
      [Inbox, 'One queue for everything', 'Replies, reviews, merges and decisions, sorted by who waits longest.'],
      [Users, 'Look after your community', 'First-time contributors, stale claims and duplicate work, before they hurt.'],
      [BookOpen, 'Keep the project healthy', 'Docs, labels and response times that make people want to contribute.'],
    ],
    setupTitle: 'Add the repositories you maintain',
    setupText: 'Track them here to fill your queue. Nothing changes on GitHub.',
    quests: [
      [Inbox, 'Clear the oldest item in your queue', 'Start with whoever has waited longest.', '/dashboard'],
      [GitPullRequest, 'Review one pull request', 'Even a short "I will look this week" helps.', '/dashboard/prs'],
      [BookOpen, 'Check how your repo looks to newcomers', 'What a first-time contributor sees.', '/dashboard/lens'],
    ],
  },
};

export default function WelcomeFlow({ ws, setup }) {
  const navigate = useNavigate();
  const set = usePrefs((s) => s.set);
  const motionOn = useMotionOn();
  const [step, setStep] = useState(0);
  const c = COPY[ws];
  const done = () => set({ onboarded: true });

  const slide = motionOn
    ? { initial: { opacity: 0, x: 12 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -12 }, transition: { duration: 0.15 } }
    : {};

  return (
    <section className="card p-5" aria-label="Welcome">
      <div className="flex items-center gap-2 mb-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1 rounded-full transition-all duration-200"
            style={{ width: i === step ? 28 : 12, background: i <= step ? 'var(--accent)' : 'var(--line)' }} />
        ))}
        <span className="fs-12 text-[var(--muted)] ml-1">Step {step + 1} of 3</span>
        <button onClick={done} className="ml-auto fs-12-5 text-[var(--muted)] hover:text-[var(--text)]">Skip</button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} {...slide}>
          {step === 0 && (
            <>
              <h2 className="fs-19 font-semibold">{c.title}</h2>
              <p className="fs-13-5 text-[var(--text-2)] mt-1 max-w-2xl">{c.intro}</p>
              <ul className="grid sm:grid-cols-3 gap-3 mt-4">
                {c.points.map(([Icon, t, d]) => (
                  <li key={t} className="rounded-md bg-[var(--inset)] border border-[var(--line)] p-3">
                    <Icon className="w-5 h-5 text-[var(--accent)]" />
                    <p className="fs-13-5 font-medium mt-2">{t}</p>
                    <p className="fs-12-5 text-[var(--muted)] mt-0.5">{d}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="fs-16 font-semibold">{c.setupTitle}</h2>
              <p className="fs-13 text-[var(--muted)] mt-1 mb-3">{c.setupText}</p>
              {ws === 'contributor' ? <InterestsEditor compact /> : setup}
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="fs-16 font-semibold">Pick a first step</h2>
              <p className="fs-13 text-[var(--muted)] mt-1 mb-3">Small is fine. You can do the rest later.</p>
              <ul className="space-y-2">
                {c.quests.map(([Icon, t, d, path]) => (
                  <li key={t}>
                    <button onClick={() => { done(); navigate(path); }}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-md border border-[var(--line)] bg-[var(--inset)] hover:border-[var(--accent)] transition-colors">
                      <Icon className="w-4 h-4 text-[var(--accent)] shrink-0" />
                      <span className="flex-1">
                        <span className="block fs-13-5 font-medium">{t}</span>
                        <span className="block fs-12-5 text-[var(--muted)]">{d}</span>
                      </span>
                      <ArrowRight className="w-4 h-4 text-[var(--muted)]" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex gap-2">
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 2 ? <Button variant="primary" onClick={() => setStep(step + 1)}>Next</Button> : <Button variant="primary" onClick={done}>Finish</Button>}
      </div>
    </section>
  );
}
