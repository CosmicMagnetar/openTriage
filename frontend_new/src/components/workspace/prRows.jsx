/** PR list rows shared by Pull requests and My work. */
import { ACTION, CHECKS, Dot, REVIEW, Ref, Row, Tag, timeAgo, waitingOnLabel } from './ui';
import { prefetchItem } from './useWorkspace';

export const prItem = (r) => ({ kind: 'pr', owner: r.owner, repo: r.repo, number: r.number });

/** Bucket a PR by its most urgent action. */
export function prBucket(r) {
  const a = r.actions[0];
  if (r.isDraft && !a) return 'Drafts';
  if (!a) return 'In progress';
  if (a.type === 'ready_to_merge') return 'Ready to merge';
  if (a.waitingOn.kind === 'author') return 'Waiting on author';
  if (['review_pending', 'newcomer_waiting', 'question_waiting'].includes(a.type)) return 'Needs review or reply';
  return 'Stalled or other';
}

export function PRRow({ r, i, selected, onOpen, me }) {
  const a = r.actions[0];
  const meta = a ? ACTION[a.type] : null;
  const checks = r.checks ? CHECKS[r.checks] : null;
  const review = r.reviewDecision ? REVIEW[r.reviewDecision] : null;
  return (
    <Row id={`row-${i}`} selected={selected} onClick={onOpen} onMouseEnter={() => prefetchItem(prItem(r))}
      lead={<Dot color={meta?.color ?? (r.isDraft ? 'gray' : 'green')} title={meta?.label} />}
      title={r.title}
      meta={<>
        <Ref owner={r.owner} repo={r.repo} number={r.number} />
        <span>@{r.author}</span>
        {r.isDraft && <Tag>draft</Tag>}
        {checks && <Tag color={checks.color}>{checks.label}</Tag>}
        {review && <Tag color={review.color}>{review.label}</Tag>}
        {a && <span className="text-[var(--text-2)]">{meta?.label} · waiting on {waitingOnLabel(a.waitingOn, me)}</span>}
      </>}
      right={<span className="text-[12px] text-[var(--faint)]">{timeAgo(r.updatedAt)}</span>}
    />
  );
}
