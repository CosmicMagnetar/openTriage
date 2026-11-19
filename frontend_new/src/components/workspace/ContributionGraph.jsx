/** GitHub-style contribution graph, shared by Journey and the Home widget. */
const LEVEL_COLOR = ['var(--inset)', '#1b4721', '#2b6a30', '#46954a', '#6bc46d'];
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

export function ContributionGraph({ weeks, compact = false }) {
  if (!weeks?.length) return null;
  const size = compact ? 8 : 11;
  const gap = compact ? 2 : 3;
  return (
    <div className="overflow-x-auto">
      <svg width={weeks.length * (size + gap)} height={7 * (size + gap)} role="img" aria-label="Contribution graph for the last year">
        {weeks.map((w, x) => w.contributionDays.map((d, y) => (
          <rect key={d.date} x={x * (size + gap)} y={y * (size + gap)} width={size} height={size} rx="2"
            fill={LEVEL_COLOR[LEVELS[d.contributionLevel] ?? 0]} stroke="var(--line)" strokeOpacity={LEVELS[d.contributionLevel] ? 0 : 0.6}>
            <title>{`${d.contributionCount} contributions on ${d.date}`}</title>
          </rect>
        )))}
      </svg>
    </div>
  );
}

