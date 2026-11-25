import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Logo from './Logo';

/**
 * Full-screen loader: the animated mark on the app's pitch-dark background.
 *
 * - Fast loads (under DELAY_MS) never show it, only the dark background.
 * - Loading often hands over from one splash to the next (auth check, then a
 *   lazy page). The next one picks up where the last left off, so the logo
 *   doesn't vanish and replay.
 * - When it goes away it fades out over the page instead of cutting.
 */
const DELAY_MS = 400;
const HANDOFF_MS = 250;
const FADE_MS = 280;

// Shared between splash instances: was one visible, and when did it go?
let lastVisibleAt = 0;

const SplashScreen = () => {
  const continuing = Date.now() - lastVisibleAt < HANDOFF_MS;
  const [show, setShow] = useState(continuing);
  const ref = useRef(null);
  const shown = useRef(continuing);

  useEffect(() => {
    if (show) return undefined;
    const t = setTimeout(() => { shown.current = true; setShow(true); }, DELAY_MS);
    return () => clearTimeout(t);
  }, [show]);

  // On unmount: remember the hand-off time, and fade a copy out over the page.
  useLayoutEffect(() => () => {
    if (!shown.current || !ref.current) return;
    lastVisibleAt = Date.now();
    const ghost = ref.current.cloneNode(true);
    ghost.removeAttribute('role');
    Object.assign(ghost.style, {
      position: 'fixed', inset: '0', zIndex: '9999', pointerEvents: 'none',
      transition: `opacity ${FADE_MS}ms ease`, opacity: '1',
    });
    ghost.querySelectorAll('.anim').forEach((n) => n.classList.remove('anim'));
    document.body.appendChild(ghost);
    requestAnimationFrame(() => requestAnimationFrame(() => { ghost.style.opacity = '0'; }));
    setTimeout(() => ghost.remove(), FADE_MS + 50);
  }, []);

  return (
    <div ref={ref} className="w-full h-screen bg-[#050506] text-[#8c8c95] flex items-center justify-center overflow-hidden" role="status" aria-live="polite" aria-busy="true">
      {show && (
        <div className={`flex flex-col items-center gap-5 ${continuing ? '' : 'animate-in fade-in duration-300'}`}>
          <Logo size={72} animated={!continuing} title="OpenTriage" />
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[#ececef]">OpenTriage</h1>
            <p className="text-sm text-[#8c8c95]">Loading…</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SplashScreen;
