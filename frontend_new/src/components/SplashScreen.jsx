import Logo from './Logo';

/** Full-screen loader: the animated mark on the app's pitch-dark background. */
const SplashScreen = () => (
  <div className="w-full h-screen bg-[#050506] text-[#8c8c95] flex items-center justify-center overflow-hidden" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-5">
      <Logo size={72} animated title="OpenTriage" />
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[#ececef]">OpenTriage</h1>
        <p className="text-sm text-[#8c8c95]">Loading…</p>
      </div>
    </div>
  </div>
);

export default SplashScreen;
