/**
 * Badge art as a standalone SVG image (no CSS variables), so it can be drawn
 * onto a canvas for the share card. Mirrors BadgeArt.jsx.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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

const SHAPE = {
  circle: (a) => `<circle cx="32" cy="32" r="27" ${a}/>`,
  shield: (a) => `<path d="M32 4 L55 12 V30 C55 45 45 55 32 60 C19 55 9 45 9 30 V12 Z" ${a}/>`,
  hex: (a) => `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" ${a}/>`,
  star: (a) => `<polygon points="${starPoints(32, 32, 29, 24, 12)}" ${a}/>`,
  diamond: (a) => `<polygon points="32,3 60,32 32,61 4,32" ${a}/>`,
};

/** Mix a hex colour with a dark base (canvas has no color-mix). */
function mix(hex, base, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(base)];
  return `rgb(${a.map((v, i) => Math.round(v * t + b[i] * (1 - t))).join(',')})`;
}

export function badgeSvg(badge, tier) {
  const t = TIERS[Math.max(0, tier)];
  const shape = SHAPE[badge.shape] ?? SHAPE.circle;
  const glyph = renderToStaticMarkup(createElement(badge.glyph, { color: t.color, size: 24, strokeWidth: 2.2 }))
    // Re-size only the outer <svg> tag (inner rects keep their own width/height).
    .replace(/^<svg[^>]*>/, (tag) => tag.replace(/\s(width|height|class)="[^"]*"/g, '').replace('<svg', '<svg x="20" y="20" width="24" height="24"'));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">`
    + shape(`fill="${mix(t.color, '#1a1f26', 0.26)}" stroke="${t.color}" stroke-width="3" stroke-linejoin="round"`)
    + `<g transform="translate(32 32) scale(0.78) translate(-32 -32)">${shape(`fill="none" stroke="${t.color}" stroke-opacity="0.45" stroke-width="1.5"`)}</g>`
    + glyph + `</svg>`;
}

/** Load an image (badge override URL, SVG string or avatar) for canvas drawing. */
export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function badgeImage(badge, tier) {
  const o = ART_OVERRIDES[badge.id];
  const url = typeof o === 'string' ? o : o?.[TIERS[Math.max(0, tier)].id];
  if (url) return loadImage(url);
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg(badge, tier))}`);
}
