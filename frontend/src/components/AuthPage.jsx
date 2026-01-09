import { Github, Shield, Zap, Users, Check } from 'lucide-react';
import Logo from './Logo';

const AuthPage = () => {
  const handleGitHubLogin = () => {
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/github`;
  };

  const features = [
    { icon: Zap, text: 'AI-powered issue triage' },
    { icon: Users, text: 'Find mentors & grow' },
    { icon: Shield, text: 'Track contributions' }
  ];

  return (
    <div className="w-full min-h-screen bg-[hsl(220,13%,5%)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-xl p-8 shadow-2xl">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 p-3 bg-[hsl(142,70%,45%,0.1)] rounded-xl">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-bold text-[hsl(210,11%,95%)]">OpenTriage</h1>
            <p className="text-[hsl(210,11%,55%)] text-center text-sm mt-2">
              AI-powered open source contribution platform
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-[hsl(210,11%,70%)]">
                <div className="p-1.5 bg-[hsl(142,70%,45%,0.1)] rounded-lg">
                  <feature.icon className="w-4 h-4 text-[hsl(142,70%,55%)]" />
                </div>
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Sign In Button */}
          <button
            data-testid="github-signin-button"
            onClick={handleGitHubLogin}
            className="w-full bg-[hsl(210,11%,98%)] hover:bg-white text-[hsl(220,13%,10%)] px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-3 transition-all hover:shadow-lg hover:shadow-white/5"
          >
            <Github className="w-5 h-5" />
            Sign in with GitHub
          </button>

          {/* Trust Indicator */}
          <div className="mt-6 pt-6 border-t border-[hsl(220,13%,12%)]">
            <div className="flex items-center justify-center gap-2 text-[hsl(210,11%,45%)]">
              <Shield className="w-4 h-4" />
              <span className="text-xs">Secure OAuth 2.0 • Read-only access</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[hsl(210,11%,35%)] mt-6">
          By signing in, you agree to our terms of service
        </p>
      </div>
    </div>
  );
};

export default AuthPage;