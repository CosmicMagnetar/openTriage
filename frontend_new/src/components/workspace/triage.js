/**
 * Triage board columns and how they map to GitHub labels. A card's column
 * comes from its labels; moving a card adds the target column's label and
 * removes the labels of the column it left.
 */
export const COLUMNS = [
  { id: 'new', title: 'New', hint: 'Not looked at yet', label: null, match: [], hue: '#8b95a3' },
  { id: 'info', title: 'Needs info', hint: 'Waiting on the author', label: 'needs info', match: ['needs info', 'needs-info', 'needs more info', 'more info needed', 'question', 'awaiting response'], hue: '#e3a72f' },
  { id: 'ready', title: 'Ready for contributors', hint: 'Clear and up for grabs', label: 'good first issue', match: ['good first issue', 'good-first-issue', 'help wanted', 'help-wanted', 'up for grabs'], hue: '#5fbf62' },
  { id: 'dup', title: 'Possible duplicate', hint: 'Check before closing', label: 'duplicate', match: ['duplicate', 'possible duplicate'], hue: '#a77ef0' },
];

const norm = (l) => (typeof l === 'string' ? l : l?.name ?? '').toLowerCase().trim();

/** Column id for a list of labels (first matching column wins, else New). */
export function columnFor(labels = []) {
  const names = labels.map(norm);
  const hit = COLUMNS.find((c) => c.match.some((m) => names.includes(m)));
  return hit ? hit.id : 'new';
}

/** Label changes to move an item from its current labels to column `to`. */
export function labelChanges(labels = [], to) {
  const names = labels.map(norm);
  const target = COLUMNS.find((c) => c.id === to);
  const remove = labels
    .filter((l) => COLUMNS.some((c) => c.id !== to && c.match.includes(norm(l))))
    .map((l) => (typeof l === 'string' ? l : l.name));
  const add = target?.label && !target.match.some((m) => names.includes(m)) ? [target.label] : [];
  return { add, remove };
}
