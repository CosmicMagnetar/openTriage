import { useEffect, useState } from 'react';
import Logo from './Logo';

/** Only show the loader when loading is actually slow; fast loads see just the dark background. */
const DELAY_MS = 400;

/** Full-screen loader: the animated mark on the app's pitch-dark background. */
const SplashScreen = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-full h-screen bg-[#050506] text-[#8c8c95] flex items-center justify-center overflow-hidden" role="status" aria-live="polite" aria-busy="true">
      {show && (
        <div className="flex flex-col items-center gap-5 animate-in fade-in duration-300">
          <Logo size={72} animated title="OpenTriage" />
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
