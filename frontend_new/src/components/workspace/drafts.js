/**
 * Ready-to-edit GitHub comments for the moments where work gets lost:
 * a silent claim, a stalled PR, someone stepping away. Always posted by the
 * user on GitHub (never automated), always editable first.
 */

const at = (logins) => logins.map((l) => `@${l}`).join(', ');

/** Drafts for an issue, depending on who is looking and what state it is in. */
export function issueDrafts({ availability, mine, isMaintainer, me }) {
  const out = [];
  if (!availability) return out;
  const stale = availability.claims.filter((c) => c.stale && c.login.toLowerCase() !== (me ?? '').toLowerCase()).map((c) => c.login);

  if (mine?.claimed && !isMaintainer) {
    out.push({
      id: 'update', label: 'Post an update',
      text: "Quick update: I'm still working on this.\n\nWhere it stands: \nWhat's left: \nI expect to open a PR by: ",
    });
    out.push({
      id: 'release', label: 'Step back',
      text: "I'm stepping back from this issue so someone else can pick it up. Thanks for your patience!\n\nNotes for whoever takes it next:\n- What I tried: \n- Where I got stuck: \n- Useful pointers: ",
    });
  }
  if (isMaintainer && stale.length) {
    out.push({
      id: 'checkin', label: 'Check in on stale claim',
      text: `Hi ${at(stale)}, are you still working on this? No pressure either way. If we don't hear back within 7 days, we'll open it up for someone else so it doesn't get stuck. Thanks!`,
    });
    out.push({
      id: 'reopen', label: 'Open it up again',
      text: `Since there hasn't been activity from ${at(stale)} for a while, this issue is open for anyone to pick up again. ${at(stale)}, if you're still on it, just say so and it's yours. Thanks!`,
    });
  }
  return out;
}

/** Drafts for a pull request: rescuing stalled work instead of closing it. */
export function prDrafts({ pr, mine, isMaintainer, stalled }) {
  const out = [];
  if (!pr || !stalled) return out;
  const author = pr.author?.login;
  if (mine) {
    out.push({
      id: 'pr-update', label: 'Post an update',
      text: "Sorry for the delay. I'm still working on this.\n\nNext steps: \nI expect to push them by: ",
    });
    out.push({
      id: 'pr-handoff', label: 'Hand it off',
      text: "I can't finish this right now. Anyone is welcome to continue from my branch.\n\nState of the work:\n- Done: \n- Left to do: \n- Known issues: ",
    });
    return out;
  }
  if (isMaintainer) {
    out.push({
      id: 'pr-ping', label: 'Ask the author',
      text: `Hi @${author}, are you still working on this? If you don't have time to finish it, that's completely fine: someone else can continue from your branch and you'll stay credited as co-author.`,
    });
  } else {
    out.push({
      id: 'pr-adopt', label: 'Offer to continue it',
      text: `Hi @${author}, this looks stalled. Would you mind if I continued from your branch? I'll keep your commits and credit you as co-author in the final PR.`,
    });
  }
  return out;
}

/** Co-author trailer to keep credit when continuing someone's PR. */
export function coAuthorTrailer(login) {
  return `Co-authored-by: ${login} <${login}@users.noreply.github.com>`;
}

/**
 * First-PR path for an issue you claimed. Each step ticks itself from GitHub
 * state, so the list always matches reality.
 */
export function firstPrSteps({ issue, availability, mine, me }) {
  const meL = (me ?? '').toLowerCase();
  const myPR = availability?.openPRs?.find((p) => p.author?.toLowerCase() === meL) ?? null;
  const done = issue?.state === 'CLOSED' || availability?.status === 'likely_done';
  const steps = [
    { id: 'claim', label: 'Claim it on GitHub', done: Boolean(mine?.claimed) },
    { id: 'setup', label: 'Set it up locally (see "Run it locally")', done: Boolean(myPR) || done },
    { id: 'pr', label: `Open a PR that says "Fixes #${issue?.number ?? ''}"`, done: Boolean(myPR) || done, url: myPR?.url },
    { id: 'merge', label: 'Get it reviewed and merged', done },
  ];
  const next = steps.find((s) => !s.done)?.id ?? null;
  return { steps, next, myPR };
}
