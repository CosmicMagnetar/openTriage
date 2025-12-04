import { Github } from 'lucide-react';
import { toast } from 'sonner';

const AuthPage = () => {
  const handleGitHubLogin = () => {
    // Redirect to backend auth endpoint
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/github`;
  };

  return (
    <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex flex-col items-center gap-6">
          <div className="flex gap-3 items-end mb-4">
            <div className="w-10 h-8 bg-red-500 rounded" />
            <div className="w-10 h-16 bg-blue-500 rounded" />
            <div className="w-10 h-24 bg-emerald-500 rounded" />
          </div>

          <h1 className="text-3xl font-bold text-slate-200">OpenTriage</h1>
          <p className="text-slate-400 text-center">
            AI-powered issue triage for open-source repositories
          </p>

          <button
            data-testid="github-signin-button"
            onClick={handleGitHubLogin}
            className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-slate-200 px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-300"
          >
            <Github className="w-5 h-5" />
            Sign in with GitHub
          </button>

          <p className="text-xs text-slate-500 text-center mt-4">
            Connect your GitHub account to start triaging issues with AI
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;