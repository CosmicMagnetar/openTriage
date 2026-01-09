import { Github, Zap, Users, BarChart3, GitPullRequest, Bot, BookOpen, ArrowRight, ChevronRight } from 'lucide-react';
import Logo from './Logo';

const LandingPage = () => {
    const handleLogin = () => {
        window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/github`;
    };

    const features = [
        {
            icon: Bot,
            title: 'AI-Powered Triage',
            description: 'Automatically classify and prioritize issues using machine learning.'
        },
        {
            icon: Users,
            title: 'Mentorship Matching',
            description: 'Connect with experienced mentors based on skills and interests.'
        },
        {
            icon: BarChart3,
            title: 'Contribution Analytics',
            description: 'Track your open source journey with detailed insights and metrics.'
        },
        {
            icon: GitPullRequest,
            title: 'PR Management',
            description: 'Streamline pull request reviews with AI-assisted suggestions.'
        }
    ];

    const steps = [
        { number: '1', title: 'Connect GitHub', description: 'Sign in with your GitHub account' },
        { number: '2', title: 'Choose Your Path', description: 'Contributor or Maintainer mode' },
        { number: '3', title: 'Start Contributing', description: 'Find issues, track progress, grow' }
    ];

    return (
        <div className="min-h-screen bg-[hsl(220,13%,5%)]">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[hsl(220,13%,5%,0.9)] backdrop-blur-sm border-b border-[hsl(220,13%,12%)]">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo size="sm" />
                        <span className="text-lg font-bold text-[hsl(210,11%,95%)]">OpenTriage</span>
                    </div>
                    <button
                        onClick={handleLogin}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black rounded-lg font-medium transition-colors"
                    >
                        <Github className="w-4 h-4" />
                        Sign In
                    </button>
                </div>
            </header>

            {/* Hero */}
            <section className="pt-32 pb-20 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 bg-[hsl(142,70%,45%,0.1)] border border-[hsl(142,70%,45%,0.3)] rounded-full">
                        <Zap className="w-4 h-4 text-[hsl(142,70%,55%)]" />
                        <span className="text-sm text-[hsl(142,70%,55%)]">AI-Powered Open Source Platform</span>
                    </div>

                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[hsl(210,11%,95%)] mb-6 leading-tight">
                        Triage Issues.
                        <br />
                        <span className="text-[hsl(142,70%,55%)]">Grow As A Developer.</span>
                    </h1>

                    <p className="text-lg text-[hsl(210,11%,60%)] mb-10 max-w-2xl mx-auto">
                        OpenTriage helps maintainers manage issues efficiently with AI,
                        while connecting contributors with mentors and tracking their open source journey.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={handleLogin}
                            className="flex items-center gap-2 px-6 py-3 bg-[hsl(210,11%,98%)] hover:bg-white text-[hsl(220,13%,10%)] rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-white/10"
                        >
                            <Github className="w-5 h-5" />
                            Get Started with GitHub
                            <ArrowRight className="w-4 h-4" />
                        </button>
                        <a
                            href="#features"
                            className="flex items-center gap-2 px-6 py-3 text-[hsl(210,11%,70%)] hover:text-white transition-colors"
                        >
                            <BookOpen className="w-5 h-5" />
                            Learn More
                        </a>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="py-20 px-4 bg-[hsl(220,13%,6%)]">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-[hsl(210,11%,95%)] mb-4">
                            Everything You Need
                        </h2>
                        <p className="text-[hsl(210,11%,55%)] max-w-xl mx-auto">
                            Tools for both maintainers and contributors to streamline open source collaboration.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, idx) => (
                            <div
                                key={idx}
                                className="p-6 bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-xl hover:border-[hsl(220,13%,22%)] transition-colors"
                            >
                                <div className="w-12 h-12 mb-4 bg-[hsl(142,70%,45%,0.1)] rounded-lg flex items-center justify-center">
                                    <feature.icon className="w-6 h-6 text-[hsl(142,70%,55%)]" />
                                </div>
                                <h3 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-sm text-[hsl(210,11%,50%)]">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-[hsl(210,11%,95%)] mb-4">
                            How It Works
                        </h2>
                        <p className="text-[hsl(210,11%,55%)]">
                            Get started in minutes
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        {steps.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-4">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-14 h-14 mb-4 bg-[hsl(142,70%,45%)] rounded-full flex items-center justify-center text-xl font-bold text-black">
                                        {step.number}
                                    </div>
                                    <h3 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-1">
                                        {step.title}
                                    </h3>
                                    <p className="text-sm text-[hsl(210,11%,50%)]">
                                        {step.description}
                                    </p>
                                </div>
                                {idx < steps.length - 1 && (
                                    <ChevronRight className="w-6 h-6 text-[hsl(220,13%,25%)] hidden md:block" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-4 bg-[hsl(220,13%,6%)]">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-[hsl(210,11%,95%)] mb-4">
                        Ready to Contribute?
                    </h2>
                    <p className="text-[hsl(210,11%,55%)] mb-8">
                        Join thousands of developers using OpenTriage to manage and contribute to open source.
                    </p>
                    <button
                        onClick={handleLogin}
                        className="inline-flex items-center gap-2 px-8 py-4 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black rounded-lg font-semibold text-lg transition-colors"
                    >
                        <Github className="w-5 h-5" />
                        Start with GitHub
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-4 border-t border-[hsl(220,13%,12%)]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-[hsl(210,11%,50%)]">
                        <Logo size="sm" />
                        <span className="text-sm">© 2024 OpenTriage</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-[hsl(210,11%,50%)]">
                        <a href="#" className="hover:text-white transition-colors">About</a>
                        <a href="#" className="hover:text-white transition-colors">Privacy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
