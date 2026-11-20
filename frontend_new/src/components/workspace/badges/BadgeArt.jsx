/**
 * Demo badge art: a shape per badge, rim in the tier colour, the badge glyph
 * in the middle and tier pips underneath. Locked badges are drawn as an
 * outline. Replace with your own art via ART_OVERRIDES in registry.js.
 */
import { Lock } from 'lucide-react';
import { ART_OVERRIDES, TIERS } from './registry';

function starPoints(cx, cy, r1, r2, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const SHAPES = {
  circle: (p) => <circle cx="32" cy="32" r="27" {...p} />,
  shield: (p) => <path d="M32 4 L55 12 V30 C55 45 45 55 32 60 C19 55 9 45 9 30 V12 Z" {...p} />,
  hex: (p) => <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" {...p} />,
  star: (p) => <polygon points={starPoints(32, 32, 29, 24, 12)} {...p} />,
  diamond: (p) => <polygon points="32,3 60,32 32,61 4,32" {...p} />,
};

export default function BadgeArt({ badge, tier = -1, size = 64, showPips = true }) {
  const locked = tier < 0;
  const t = TIERS[Math.max(0, tier)];
  const override = ART_OVERRIDES[badge.id];
  const src = typeof override === 'string' ? override : override?.[t.id];
  const Glyph = badge.glyph;
  const Shape = SHAPES[badge.shape] ?? SHAPES.circle;

  if (src && !locked) {
    return <img src={src} alt={`${badge.name} ${t.label}`} width={size} height={size} className="select-none" />;
  }

  return (
    <span className="relative inline-flex flex-col items-center select-none" style={{ width: size }}>
      <span className="relative inline-block" style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
          <Shape
            fill={locked ? 'var(--inset)' : `color-mix(in srgb, ${t.color} 26%, #1a1f26)`}
            stroke={locked ? 'var(--line)' : t.color}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeDasharray={locked ? '4 3' : undefined}
          />
          {!locked && (
            <g transform="translate(32 32) scale(0.78) translate(-32 -32)">
              <Shape fill="none" stroke={t.color} strokeOpacity="0.45" strokeWidth="1.5" strokeLinejoin="round" />
            </g>
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: locked ? 'var(--muted)' : t.color }}>
          {locked ? <Lock style={{ width: size * 0.3, height: size * 0.3 }} /> : <Glyph style={{ width: size * 0.38, height: size * 0.38 }} strokeWidth={2.2} />}
        </span>
      </span>
      {showPips && badge.tiers.length > 1 && (
        <span className="flex gap-1 mt-1" aria-label={locked ? 'Locked' : `${t.label} tier`}>
          {badge.tiers.map((_, i) => (
            <span key={i} className="rounded-full" style={{ width: Math.max(4, size / 14), height: Math.max(4, size / 14), background: i <= tier ? TIERS[i].color : 'var(--line)' }} />
          ))}
        </span>
      )}
    </span>
  );
}
