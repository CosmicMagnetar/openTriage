import { Github, Zap, Users, BarChart3, GitPullRequest, Bot, BookOpen, ArrowRight, ChevronRight, Star, Mail, Play, CheckCircle2, Shield, Clock, Sparkles, Code2, Target, MessageSquare, Heart, ExternalLink, FolderPlus, GitBranch, Reply, UserPlus, Eye, Settings, Bell, ChevronDown, Cpu, Brain, Database, Workflow, Check, Tag, User, Award, Search, Send, MessageCircle, FileText, Layers, Trophy, Link } from 'lucide-react';
import Logo from './Logo';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../stores/authStore';

// ============================================
// REUSABLE COMPONENTS
// ============================================

const SectionBadge = ({ children, color = 'green' }) => {
    const colors = {
        green: 'bg-[hsl(142,70%,45%,0.1)] text-[hsl(142,70%,55%)] border-[hsl(142,70%,45%,0.25)]',
        blue: 'bg-[hsl(217,91%,60%,0.1)] text-[hsl(217,91%,65%)] border-[hsl(217,91%,60%,0.25)]',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
        yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
    };
    return (
        <span className={`inline-block px-3 py-1 mb-4 text-xs font-medium rounded-full border ${colors[color]}`}>
            {children}
        </span>
    );
};

const SectionTitle = ({ badge, badgeColor, title, subtitle }) => (
    <div className="text-center mb-16">
        {badge && <SectionBadge color={badgeColor}>{badge}</SectionBadge>}
        <h2 className="text-3xl md:text-4xl font-bold text-[hsl(210,11%,95%)] mb-4">{title}</h2>
        {subtitle && <p className="text-[hsl(210,11%,55%)] max-w-xl mx-auto">{subtitle}</p>}
    </div>
);

const FeatureCard = ({ icon: Icon, title, description }) => (
    <div className="group p-6 bg-[#09090b] border border-zinc-800 rounded-xl hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/5">
        <div className="w-12 h-12 mb-4 bg-emerald-500/10 rounded-lg flex items-center justify-center group-hover:bg-emerald-500/15 transition-colors">
            <Icon className="w-6 h-6 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-100 mb-2">{title}</h3>
        <p className="text-sm text-zinc-500">{description}</p>
    </div>
);

const AITechCard = ({ icon: Icon, name, description, color }) => {
    const colors = {
        green: 'from-emerald-500/20 to-transparent border-emerald-500/30',
        blue: 'from-blue-500/20 to-transparent border-blue-500/30',
        purple: 'from-purple-500/20 to-transparent border-purple-500/30',
        orange: 'from-orange-500/20 to-transparent border-orange-500/30',
    };
    const iconColors = {
        green: 'text-emerald-400',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        orange: 'text-orange-400',
    };
    return (
        <div className={`p-6 rounded-xl bg-gradient-to-br ${colors[color]} border backdrop-blur-sm`}>
            <Icon className={`w-10 h-10 mb-4 ${iconColors[color]}`} />
            <h3 className="text-lg font-semibold text-white mb-2">{name}</h3>
            <p className="text-sm text-zinc-400">{description}</p>
        </div>
    );
};

// ============================================
// 3D TILT CARD COMPONENT
// ============================================

const TiltCard3D = ({ children }) => {
    const cardRef = useRef(null);
    const [tiltStyle, setTiltStyle] = useState({
        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
        transition: 'transform 0.1s ease-out'
    });

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;

        const card = cardRef.current;
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate mouse position relative to card center
        const mouseX = e.clientX - centerX;
        const mouseY = e.clientY - centerY;

        // Calculate rotation (max 15 degrees)
        const maxTilt = 15;
        const rotateY = (mouseX / (rect.width / 2)) * maxTilt;
        const rotateX = -(mouseY / (rect.height / 2)) * maxTilt;

        setTiltStyle({
            transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
            transition: 'transform 0.1s ease-out'
        });
    };

    const handleMouseLeave = () => {
        setTiltStyle({
            transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
            transition: 'transform 0.4s ease-out'
        });
    };

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                ...tiltStyle,
                transformStyle: 'preserve-3d',
            }}
            className="relative cursor-pointer"
        >
            {children}
        </div>
    );
};

// ============================================
// TWITTER-STYLE TESTIMONIAL CARD
// ============================================

const TwitterTestimonialCard = ({ name, username, avatar, content, verified }) => (
    <motion.div
        whileHover={{ y: -4 }}
        className="flex-shrink-0 w-[320px] p-5 bg-[#0d0d0f] border border-zinc-800/80 rounded-2xl"
    >
        <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center text-sm font-medium text-white overflow-hidden">
                {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                    <span className="font-semibold text-white text-sm truncate">{name}</span>
                    {verified && (
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                        </svg>
                    )}
                </div>
                <div className="text-zinc-500 text-sm truncate">@{username}</div>
            </div>
        </div>
        <p className="text-zinc-300 text-sm leading-relaxed">{content}</p>
    </motion.div>
);

// ============================================
// HORIZONTAL MARQUEE TESTIMONIALS
// ============================================

const TestimonialsMarquee = ({ testimonials }) => {
    const row1 = testimonials.slice(0, Math.ceil(testimonials.length / 2));
    const row2 = testimonials.slice(Math.ceil(testimonials.length / 2));

    return (
        <div className="relative overflow-hidden py-8">
            {/* Row 1 - moves left */}
            <div className="flex gap-6 mb-6 animate-marquee-left">
                {[...row1, ...row1, ...row1].map((t, idx) => (
                    <TwitterTestimonialCard key={`r1-${idx}`} {...t} />
                ))}
            </div>
            {/* Row 2 - moves right */}
            <div className="flex gap-6 animate-marquee-right">
                {[...row2, ...row2, ...row2].map((t, idx) => (
                    <TwitterTestimonialCard key={`r2-${idx}`} {...t} />
                ))}
            </div>
            {/* Fade edges */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#09090b] to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#09090b] to-transparent pointer-events-none z-10" />
        </div>
    );
};

// ============================================
// ONBOARDING TUTORIAL COMPONENT
// ============================================

const OnboardingStepCard = ({ icon: Icon, title, description, color = 'emerald' }) => {
    const colorClasses = {
        emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
        purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
        pink: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
        cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    };

    return (
        <div className="group p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all">
            <div className={`w-12 h-12 mb-4 rounded-xl flex items-center justify-center ${colorClasses[color]} border`}>
                <Icon className="w-6 h-6" />
            </div>
            <h4 className="text-white font-semibold mb-2">{title}</h4>
            <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
        </div>
    );
};

const ContributorFlowPreview = () => (
    <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
            <OnboardingStepCard
                icon={Github}
                title="Sign Up & Connect GitHub"
                description="Start by connecting your GitHub account. We'll securely authenticate you via OAuth."
                color="emerald"
            />
            <OnboardingStepCard
                icon={Link}
                title="Add Repository"
                description="Paste any GitHub repo link to explore projects. Find open source projects that match your skills."
                color="blue"
            />
            <OnboardingStepCard
                icon={Search}
                title="Browse & Claim Issues"
                description="Discover issues tagged for contributors. Click on any issue you'd like to tackle."
                color="purple"
            />
            <OnboardingStepCard
                icon={Bot}
                title="Write with AI Assistance"
                description="Get AI-powered recommendations for your responses. Let AI help you craft better solutions."
                color="orange"
            />
            <OnboardingStepCard
                icon={MessageCircle}
                title="AI Project Chatbot"
                description="Use our AI assistant to analyze the codebase, understand project structure, and ask questions."
                color="cyan"
            />
            <OnboardingStepCard
                icon={Trophy}
                title="Earn Badges"
                description="Track your contributions and unlock achievements. Build your open source reputation."
                color="pink"
            />
        </div>

        {/* Interactive Demo Preview */}
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Live Preview</div>
            <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                        <div className="text-white text-sm font-medium">Issue: Add dark mode toggle</div>
                        <div className="text-zinc-500 text-xs">react-components/ui-toolkit#42 · good first issue</div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
                        Claim Issue
                    </span>
                </div>
                <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <div className="text-white text-sm font-medium mb-2">AI Suggestion</div>
                        <div className="text-zinc-400 text-sm">"Consider using CSS custom properties for theme switching. Check `ThemeContext.jsx` for existing patterns."</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const MaintainerFlowPreview = () => (
    <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
            <OnboardingStepCard
                icon={Github}
                title="Sign Up & Connect GitHub"
                description="Connect your GitHub account to access your repositories with secure OAuth."
                color="emerald"
            />
            <OnboardingStepCard
                icon={FolderPlus}
                title="Fetch Your Repositories"
                description="Import the repos you maintain. OpenTriage will sync with your GitHub data automatically."
                color="blue"
            />
            <OnboardingStepCard
                icon={GitPullRequest}
                title="Analyze PRs"
                description="Use AI-powered PR management tools to review and organize pull requests efficiently."
                color="purple"
            />
            <OnboardingStepCard
                icon={FileText}
                title="AI PR Summaries"
                description="Get instant AI-generated summaries for each PR. Understand changes at a glance."
                color="orange"
            />
            <OnboardingStepCard
                icon={Send}
                title="Rapid Reply Templates"
                description="Create and use prebuild response templates for common PR feedback scenarios."
                color="cyan"
            />
            <OnboardingStepCard
                icon={Users}
                title="Manage Contributors"
                description="Assign issues, label PRs, and organize contributions with smart automation."
                color="pink"
            />
        </div>

        {/* Interactive Demo Preview */}
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Live Preview</div>
            <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <GitPullRequest className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                        <div className="text-white text-sm font-medium">PR: Add OAuth2 support</div>
                        <div className="text-zinc-500 text-xs">+245 -12 · 3 files changed</div>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">+8 score</span>
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">ready</span>
                    </div>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <div className="text-xs text-zinc-500 mb-2">AI Summary</div>
                    <div className="text-zinc-300 text-sm">"Adds OAuth2 authentication flow with Google and GitHub providers. Includes token refresh logic and secure storage."</div>
                </div>
                <div className="flex gap-2">
                    <button className="flex-1 px-4 py-2 bg-emerald-500/20 text-emerald-400 text-sm rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors">
                        ✓ Approve & Merge
                    </button>
                    <button className="flex-1 px-4 py-2 bg-zinc-700/50 text-zinc-300 text-sm rounded-lg border border-zinc-600 hover:bg-zinc-700 transition-colors">
                        Request Changes
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const OnboardingTutorial = () => {
    const [activeTab, setActiveTab] = useState('contributor');

    const handleLogin = () => {
        window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/github`;
    };

    return (
        <section className="py-24 px-4 bg-[#09090b]">
            <div className="max-w-6xl mx-auto">
                <SectionTitle
                    badge="GET STARTED"
                    badgeColor="green"
                    title="Your Journey Starts Here"
                    subtitle="Choose your path and discover how OpenTriage can transform your open source workflow"
                />

                {/* Initial CTA */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                    <button
                        onClick={handleLogin}
                        className="flex items-center gap-3 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl font-semibold transition-colors"
                    >
                        <Github className="w-5 h-5" />
                        Sign Up to OpenTriage
                    </button>
                    <span className="text-zinc-500">or</span>
                    <button
                        onClick={handleLogin}
                        className="flex items-center gap-3 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium border border-zinc-700 transition-colors"
                    >
                        <Github className="w-5 h-5" />
                        Connect GitHub Account
                    </button>
                </div>

                {/* Role Selection Tabs */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                        <button
                            onClick={() => setActiveTab('contributor')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'contributor'
                                ? 'bg-emerald-500 text-black'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            <Code2 className="w-5 h-5" />
                            I'm a Contributor
                        </button>
                        <button
                            onClick={() => setActiveTab('maintainer')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'maintainer'
                                ? 'bg-blue-500 text-black'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            <Settings className="w-5 h-5" />
                            I'm a Maintainer
                        </button>
                    </div>
                </div>

                {/* Flow Preview */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {activeTab === 'contributor' ? <ContributorFlowPreview /> : <MaintainerFlowPreview />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </section>
    );
};


// ============================================
// MAIN LANDING PAGE COMPONENT
// ============================================

const LandingPage = () => {
    const { user, role } = useAuthStore();
    const [email, setEmail] = useState('');
    const [emailSubmitted, setEmailSubmitted] = useState(false);

    // Enable scrolling on mount, disable on unmount
    useEffect(() => {
        document.documentElement.style.overflow = 'auto';
        document.body.style.overflow = 'auto';
        document.getElementById('root').style.overflow = 'auto';
        document.getElementById('root').style.height = 'auto';

        return () => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.getElementById('root').style.overflow = '';
            document.getElementById('root').style.height = '';
        };
    }, []);

    const handleLogin = () => {
        window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/github`;
    };

    const goToDashboard = () => {
        window.location.href = '/';
    };

    const handleEmailSubmit = (e) => {
        e.preventDefault();
        if (email) {
            setEmailSubmitted(true);
            setEmail('');
        }
    };

    const scrollToSection = (e, sectionId) => {
        e.preventDefault();
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Data
    const features = [
        { icon: Bot, title: 'AI-Powered Triage', description: 'Automatically classify and prioritize issues using advanced machine learning models.' },
        { icon: Users, title: 'Mentorship Matching', description: 'Connect with experienced mentors based on skills, interests, and availability.' },
        { icon: BarChart3, title: 'Contribution Analytics', description: 'Track your open source journey with detailed insights, streak tracking, and metrics.' },
        { icon: GitPullRequest, title: 'PR Management', description: 'Streamline pull request reviews with AI-assisted suggestions and auto-labeling.' },
    ];

    const aiTechnologies = [
        { icon: Brain, name: 'GPT-4 Integration', description: 'Advanced language understanding for intelligent issue classification.', color: 'green' },
        { icon: Cpu, name: 'Gemini AI', description: 'Multi-modal analysis for code snippets and complex issues.', color: 'blue' },
        { icon: Database, name: 'Vector Embeddings', description: 'Semantic search for finding related issues and contributors.', color: 'purple' },
        { icon: Workflow, name: 'ML Pipelines', description: 'Automated workflows for improving triage accuracy.', color: 'orange' },
    ];

    const testimonials = [
        { name: 'Ethan Walker', username: 'ethanwrites', content: "We've tried several tools, but nothing comes close in terms of accuracy and ease of use.", verified: true, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
        { name: 'Maya Patel', username: 'mayapatel', content: 'The automation features alone have saved our team countless hours every week.', verified: true, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face' },
        { name: 'Liam Brooks', username: 'liambrooks', content: 'Setup was ridiculously easy. Within 10 minutes, we were running live.', verified: true, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face' },
        { name: 'Sophia Carter', username: 'sophiacodes', content: 'This SaaS app has completely streamlined our onboarding process.', verified: true, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face' },
        { name: 'Noah Kim', username: 'noahkim', content: 'The AI suggestions are spot on. Like having an expert assistant 24/7.', verified: true, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face' },
        { name: 'Ava Chen', username: 'avachen', content: 'Finally found a tool that actually understands developer workflows.', verified: true, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face' },
    ];

    const stats = [
        { value: '10K+', label: 'Contributors' },
        { value: '500+', label: 'Repositories' },
        { value: '50K+', label: 'Issues Triaged' },
        { value: '95%', label: 'Accuracy' }
    ];

    return (
        <div className="bg-[#09090b] min-h-screen">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#09090b]/95 backdrop-blur-md border-b border-zinc-800/50">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo size="sm" />
                        <span className="text-lg font-bold text-white">OpenTriage</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6 text-sm">
                        <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="text-zinc-400 hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="text-zinc-400 hover:text-white transition-colors">How it Works</a>
                        <a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="text-zinc-400 hover:text-white transition-colors">Reviews</a>
                        <a href="#contribute" onClick={(e) => scrollToSection(e, 'contribute')} className="text-zinc-400 hover:text-white transition-colors">Contribute</a>
                    </nav>
                    {user ? (
                        <div className="flex items-center gap-3">
                            <img
                                src={user.avatarUrl || 'https://github.com/ghost.png'}
                                alt={user.username}
                                className="w-8 h-8 rounded-full border border-zinc-700"
                            />
                            <span className="text-white text-sm font-medium hidden sm:inline">{user.username}</span>
                            <button
                                onClick={goToDashboard}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg font-medium transition-colors"
                            >
                                <ArrowRight className="w-4 h-4" />
                                Go to Dashboard
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleLogin} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg font-medium transition-colors">
                            <Github className="w-4 h-4" />
                            Sign In
                        </button>
                    )}
                </div>
            </header>

            {/* Hero Section - Like Reference Image */}
            <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
                {/* Background decorative arcs */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Red arc */}
                    <div
                        className="absolute"
                        style={{
                            top: '-10%',
                            left: '-20%',
                            width: '80%',
                            height: '120%',
                            border: '2px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '50%',
                            transform: 'rotate(-15deg)',
                        }}
                    />
                    {/* Teal arc */}
                    <div
                        className="absolute"
                        style={{
                            top: '20%',
                            right: '-30%',
                            width: '90%',
                            height: '100%',
                            border: '2px solid rgba(45, 212, 191, 0.25)',
                            borderRadius: '50%',
                            transform: 'rotate(10deg)',
                        }}
                    />
                </div>

                <div className="max-w-7xl mx-auto px-6 md:px-12 w-full grid lg:grid-cols-2 gap-12 items-center relative z-10">
                    {/* Left Content */}
                    <div className="order-2 lg:order-1">
                        <div className="flex items-center gap-4 mb-8">
                            <Logo size="lg" />
                            <span className="text-5xl md:text-6xl font-bold text-white tracking-tight">OpenTriage</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl text-zinc-400 mb-10 font-medium leading-relaxed">
                            Stop Sorting Issues. <span className="text-emerald-400">Start Shipping Code.</span>
                        </h1>
                        <div className="flex flex-col sm:flex-row gap-4 mb-10">
                            <button onClick={handleLogin} className="flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-zinc-100 text-black rounded-xl font-semibold transition-all text-lg">
                                <Github className="w-5 h-5" />
                                Get Started with GitHub
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-8 text-sm text-zinc-500">
                            <div className="flex items-center gap-2"><Shield className="w-4 h-4" /><span>Secure OAuth</span></div>
                            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /><span>100% Free</span></div>
                            <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>2 min setup</span></div>
                        </div>
                    </div>

                    {/* Right - Dashboard Preview with 3D Tilt */}
                    <div className="relative order-1 lg:order-2 hidden lg:block">
                        <TiltCard3D>
                            {/* Glow effect */}
                            <div
                                className="absolute inset-0 blur-3xl opacity-30 pointer-events-none"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.4) 0%, rgba(59, 130, 246, 0.3) 100%)',
                                    transform: 'scale(1.2)'
                                }}
                            />
                            {/* Dashboard frame */}
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-zinc-700/50">
                                <div className="bg-zinc-900 p-1">
                                    {/* Browser bar */}
                                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-t-lg">
                                        <div className="flex gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                                        </div>
                                        <div className="flex-1 mx-4">
                                            <div className="h-6 bg-zinc-700/50 rounded-md flex items-center px-3">
                                                <span className="text-xs text-zinc-500">opentriage.io/dashboard</span>
                                            </div>
                                        </div>
                                    </div>
                                    <img src="/dashboard-preview.png" alt="OpenTriage Dashboard" className="w-full h-auto rounded-b-lg" />
                                </div>
                            </div>
                        </TiltCard3D>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <section className="py-12 border-y border-zinc-800 bg-zinc-900/30">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="text-center">
                                <div className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</div>
                                <div className="text-sm text-zinc-500">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="py-24 px-4 scroll-mt-20">
                <div className="max-w-6xl mx-auto">
                    <SectionTitle badge="FEATURES" badgeColor="green" title="Everything You Need" subtitle="Tools for maintainers and contributors to streamline collaboration." />
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((f, idx) => <FeatureCard key={idx} {...f} />)}
                    </div>
                </div>
            </section>

            {/* Onboarding Tutorial - How it Works */}
            <div id="how-it-works" className="scroll-mt-20">
                <OnboardingTutorial />
            </div>

            {/* AI Technologies */}
            <section id="ai-tech" className="py-24 px-4 scroll-mt-20">
                <div className="max-w-6xl mx-auto">
                    <SectionTitle badge="AI TECHNOLOGIES" badgeColor="blue" title="Powered by Advanced AI" subtitle="Cutting-edge AI models for intelligent automation." />
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {aiTechnologies.map((t, idx) => <AITechCard key={idx} {...t} />)}
                    </div>
                    <div className="mt-12 p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 className="text-xl font-semibold text-white mb-2">How Our AI Works</h3>
                            <p className="text-zinc-400 max-w-2xl">
                                OpenTriage uses LLMs and ML pipelines to analyze issues, suggest labels, match mentors, and provide insights.
                            </p>
                        </div>
                        <a href="https://github.com/CosmicMagnetar/openTriage" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium whitespace-nowrap hover:bg-blue-600 transition-colors">
                            <Github className="w-5 h-5" />
                            View on GitHub
                        </a>
                    </div>
                </div>
            </section>

            {/* Testimonials - Twitter Style Marquee */}
            <section id="testimonials" className="py-24 bg-[#09090b] scroll-mt-20">
                <div className="max-w-6xl mx-auto px-4 mb-8">
                    <SectionTitle
                        badge="TESTIMONIALS"
                        badgeColor="yellow"
                        title="Don't just take our words"
                        subtitle="Hear what our users say about us. We're always looking for ways to improve. If you have a positive experience with us, leave a review."
                    />
                </div>
                <TestimonialsMarquee testimonials={testimonials} />
            </section>

            {/* Contribute */}
            <section id="contribute" className="py-24 px-4 scroll-mt-20 bg-zinc-900/30">
                <div className="max-w-6xl mx-auto">
                    <SectionTitle badge="CONTRIBUTE" badgeColor="green" title="Join the Community" subtitle="OpenTriage is open source. We welcome contributions!" />
                    <div className="grid md:grid-cols-3 gap-6">
                        <a href="https://github.com/CosmicMagnetar/openTriage" target="_blank" rel="noopener noreferrer" className="group p-6 bg-[#09090b] border border-zinc-800 rounded-xl hover:border-emerald-500/50 transition-all">
                            <Github className="w-10 h-10 text-zinc-500 group-hover:text-white mb-4 transition-colors" />
                            <h3 className="text-lg font-semibold text-white mb-2">GitHub Repository</h3>
                            <p className="text-sm text-zinc-500 mb-4">Star, report issues, submit PRs.</p>
                            <span className="text-emerald-400 text-sm flex items-center gap-1">View Repository <ExternalLink className="w-4 h-4" /></span>
                        </a>
                        <a href="https://github.com/CosmicMagnetar/openTriage/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="group p-6 bg-[#09090b] border border-zinc-800 rounded-xl hover:border-blue-500/50 transition-all">
                            <BookOpen className="w-10 h-10 text-zinc-500 group-hover:text-white mb-4 transition-colors" />
                            <h3 className="text-lg font-semibold text-white mb-2">Contribution Guide</h3>
                            <p className="text-sm text-zinc-500 mb-4">Learn how to contribute.</p>
                            <span className="text-blue-400 text-sm flex items-center gap-1">Read Guide <ExternalLink className="w-4 h-4" /></span>
                        </a>
                        <a href="https://github.com/CosmicMagnetar/openTriage/issues" target="_blank" rel="noopener noreferrer" className="group p-6 bg-[#09090b] border border-zinc-800 rounded-xl hover:border-purple-500/50 transition-all">
                            <GitBranch className="w-10 h-10 text-zinc-500 group-hover:text-white mb-4 transition-colors" />
                            <h3 className="text-lg font-semibold text-white mb-2">Good First Issues</h3>
                            <p className="text-sm text-zinc-500 mb-4">Beginner-friendly issues.</p>
                            <span className="text-purple-400 text-sm flex items-center gap-1">Browse Issues <ExternalLink className="w-4 h-4" /></span>
                        </a>
                    </div>
                </div>
            </section>

            {/* Newsletter */}
            <section className="py-24 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="p-8 md:p-12 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center">
                        <Mail className="w-12 h-12 mx-auto mb-6 text-emerald-400" />
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Stay Ahead with OpenTriage</h2>
                        <p className="text-zinc-400 mb-8">Join our newsletter for product updates, open source insights, and tips to maximize your contribution impact.</p>
                        {emailSubmitted ? (
                            <div className="flex items-center justify-center gap-2 text-emerald-400">
                                <CheckCircle2 className="w-5 h-5" />
                                <span>You're all set! Check your inbox for a welcome message.</span>
                            </div>
                        ) : (
                            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500" required />
                                <button type="submit" className="px-6 py-3 bg-emerald-500 text-black rounded-lg font-medium hover:bg-emerald-600 transition-colors">Subscribe</button>
                            </form>
                        )}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-4 bg-zinc-900/30">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Transform Your Workflow?</h2>
                    <p className="text-zinc-400 mb-8">Join thousands of developers using OpenTriage.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button onClick={handleLogin} className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-black rounded-lg font-semibold text-lg hover:bg-emerald-600 transition-colors">
                            <Github className="w-5 h-5" />
                            Get Started Free
                        </button>
                        <a href="https://github.com/CosmicMagnetar/openTriage" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-8 py-4 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 rounded-lg font-medium transition-colors">
                            <Star className="w-5 h-5" />
                            Star on GitHub
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer - Professional */}
            <footer className="py-16 px-4 border-t border-zinc-800 bg-[#09090b]">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                        {/* Brand */}
                        <div className="col-span-2">
                            <div className="flex items-center gap-3 mb-4">
                                <Logo size="sm" />
                                <span className="text-xl font-bold text-white">OpenTriage</span>
                            </div>
                            <p className="text-zinc-400 text-sm mb-6 max-w-xs leading-relaxed">
                                AI-powered intelligence for open source communities. Transform how maintainers and contributors collaborate.
                            </p>
                            <div className="flex items-center gap-3">
                                <a href="https://github.com/CosmicMagnetar/openTriage" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all">
                                    <Github className="w-4 h-4" />
                                </a>
                                <a href="#" className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                </a>
                            </div>
                        </div>

                        {/* Product */}
                        <div>
                            <h4 className="text-white font-semibold mb-4">Product</h4>
                            <ul className="space-y-3 text-sm">
                                <li><a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="text-zinc-400 hover:text-white transition-colors">Features</a></li>
                                <li><a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="text-zinc-400 hover:text-white transition-colors">How it Works</a></li>
                                <li><a href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')} className="text-zinc-400 hover:text-white transition-colors">Reviews</a></li>
                                <li><a href="#ai-tech" onClick={(e) => scrollToSection(e, 'ai-tech')} className="text-zinc-400 hover:text-white transition-colors">AI Technologies</a></li>
                            </ul>
                        </div>

                        {/* Resources */}
                        <div>
                            <h4 className="text-white font-semibold mb-4">Resources</h4>
                            <ul className="space-y-3 text-sm">
                                <li><a href="https://github.com/CosmicMagnetar/openTriage" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1">Documentation <ExternalLink className="w-3 h-3" /></a></li>
                                <li><a href="https://github.com/CosmicMagnetar/openTriage/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1">Contributing <ExternalLink className="w-3 h-3" /></a></li>
                                <li><a href="https://github.com/CosmicMagnetar/openTriage/issues" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1">Issues <ExternalLink className="w-3 h-3" /></a></li>
                                <li><a href="https://github.com/CosmicMagnetar/openTriage/releases" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1">Changelog <ExternalLink className="w-3 h-3" /></a></li>
                            </ul>
                        </div>

                        {/* Legal */}
                        <div>
                            <h4 className="text-white font-semibold mb-4">Legal</h4>
                            <ul className="space-y-3 text-sm">
                                <li><a href="#" className="text-zinc-400 hover:text-white transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="text-zinc-400 hover:text-white transition-colors">Terms of Service</a></li>
                                <li><a href="https://github.com/CosmicMagnetar/openTriage/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1">MIT License <ExternalLink className="w-3 h-3" /></a></li>
                            </ul>
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="pt-8 border-t border-zinc-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-6 text-sm text-zinc-500">
                            <p>© 2024 OpenTriage. All rights reserved.</p>
                        </div>
                        <p className="text-sm text-zinc-500 flex items-center gap-1">
                            Built with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> for the open source community
                        </p>
                    </div>
                </div>
            </footer>

            {/* CSS for marquee animation */}
            <style>{`
                @keyframes marquee-left {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.33%); }
                }
                @keyframes marquee-right {
                    0% { transform: translateX(-33.33%); }
                    100% { transform: translateX(0); }
                }
                .animate-marquee-left {
                    animation: marquee-left 30s linear infinite;
                }
                .animate-marquee-right {
                    animation: marquee-right 30s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default LandingPage;
