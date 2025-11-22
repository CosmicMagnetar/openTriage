import { useEffect, useState } from 'react';

const SplashScreen = () => {
  const [sorted, setSorted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSorted(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full h-screen bg-slate-900 flex items-center justify-center overflow-hidden">
      <div className="flex flex-col items-center gap-8">
        <div className="flex gap-4 items-end">
          <div
            data-testid="bar-red"
            className={`w-16 rounded-lg transition-all duration-700 ease-out ${
              sorted ? 'h-12 bg-red-500' : 'h-32 bg-red-400'
            }`}
            style={{ transitionDelay: '0ms' }}
          />
          <div
            data-testid="bar-blue"
            className={`w-16 rounded-lg transition-all duration-700 ease-out ${
              sorted ? 'h-24 bg-blue-500' : 'h-20 bg-blue-400'
            }`}
            style={{ transitionDelay: '100ms' }}
          />
          <div
            data-testid="bar-green"
            className={`w-16 rounded-lg transition-all duration-700 ease-out ${
              sorted ? 'h-32 bg-emerald-500' : 'h-16 bg-emerald-400'
            }`}
            style={{ transitionDelay: '200ms' }}
          />
        </div>
        <h1 className="text-3xl font-bold text-slate-200">OpenTriage</h1>
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );
};

export default SplashScreen;