import { useState, useMemo } from 'react';
import { X, ExternalLink, Users, Building2, Globe, Star, GitFork, Search, Heart, Sparkles, ArrowRight } from 'lucide-react';

const OrganizationsPanel = ({ onClose, contributedRepos = [] }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Popular open source organizations to discover
    const organizations = [
        {
            name: 'Apache Software Foundation',
            description: 'Non-profit corporation providing software for the public good. Home to 350+ open source projects.',
            website: 'https://apache.org',
            github: 'https://github.com/apache',
            category: 'foundation',
            projects: ['Kafka', 'Spark', 'Hadoop', 'Airflow'],
            howToConnect: 'Join mailing lists, attend ApacheCon, contribute to any Apache project.',
            icon: '🪶'
        },
        {
            name: 'Cloud Native Computing Foundation',
            description: 'Building sustainable ecosystems for cloud native software like Kubernetes and Prometheus.',
            website: 'https://cncf.io',
            github: 'https://github.com/cncf',
            category: 'foundation',
            projects: ['Kubernetes', 'Prometheus', 'Envoy', 'Helm'],
            howToConnect: 'Join CNCF Slack, attend KubeCon, start with good-first-issues.',
            icon: '☁️'
        },
        {
            name: 'Mozilla',
            description: 'Non-profit behind Firefox. Champions internet health and privacy.',
            website: 'https://mozilla.org',
            github: 'https://github.com/mozilla',
            category: 'company',
            projects: ['Firefox', 'Rust', 'MDN Web Docs', 'Servo'],
            howToConnect: 'Join Mozilla Community, pick bugs on Bugzilla, attend Mozilla Festival.',
            icon: '🦊'
        },
        {
            name: 'The Linux Foundation',
            description: 'Supports the creation of sustainable open source ecosystems. Hosts Linux kernel development.',
            website: 'https://linuxfoundation.org',
            github: 'https://github.com/linuxfoundation',
            category: 'foundation',
            projects: ['Linux Kernel', 'Node.js', 'Let\'s Encrypt', 'GraphQL'],
            howToConnect: 'Apply for LFX Mentorship, join project mailing lists, attend Linux conferences.',
            icon: '🐧'
        },
        {
            name: 'Google Open Source',
            description: 'Home to Google\'s open source projects and contributions.',
            website: 'https://opensource.google',
            github: 'https://github.com/google',
            category: 'company',
            projects: ['TensorFlow', 'Angular', 'Go', 'Flutter'],
            howToConnect: 'Apply for GSoC, join project communities, check good-first-issues.',
            icon: '🔍'
        },
        {
            name: 'Microsoft Open Source',
            description: 'Microsoft\'s commitment to open source with thousands of projects.',
            website: 'https://opensource.microsoft.com',
            github: 'https://github.com/microsoft',
            category: 'company',
            projects: ['VS Code', 'TypeScript', '.NET', 'Terminal'],
            howToConnect: 'Join VS Code community, contribute via GitHub, attend Microsoft events.',
            icon: '💠'
        },
        {
            name: 'Meta Open Source',
            description: 'Open source projects from Meta powering billions of users.',
            website: 'https://opensource.fb.com',
            github: 'https://github.com/facebook',
            category: 'company',
            projects: ['React', 'PyTorch', 'Jest', 'Docusaurus'],
            howToConnect: 'Check React community, join Discord servers, look for good-first-issues.',
            icon: '∞'
        },
        {
            name: 'Python Software Foundation',
            description: 'Non-profit promoting and advancing the Python programming language.',
            website: 'https://python.org',
            github: 'https://github.com/python',
            category: 'foundation',
            projects: ['CPython', 'pip', 'PyPI', 'Python Docs'],
            howToConnect: 'Join python-dev mailing list, contribute to CPython, mentor at PyCon.',
            icon: '🐍'
        },
        {
            name: 'Rust Foundation',
            description: 'Stewards of the Rust programming language and ecosystem.',
            website: 'https://foundation.rust-lang.org',
            github: 'https://github.com/rust-lang',
            category: 'foundation',
            projects: ['Rust', 'Cargo', 'rustup', 'rust-analyzer'],
            howToConnect: 'Join Rust Discord/Zulip, look for E-easy issues, attend RustConf.',
            icon: '🦀'
        },
        {
            name: 'GitLab',
            description: 'The complete DevOps platform, delivered as a single application.',
            website: 'https://gitlab.com',
            github: 'https://gitlab.com/gitlab-org',
            category: 'company',
            projects: ['GitLab', 'GitLab Runner', 'Omnibus', 'Charts'],
            howToConnect: 'Check GitLab Contributing Guide, join community forum, pick issues.',
            icon: '🦊'
        }
    ];

    // Get unique repos the user contributes to
    const myOrganizations = useMemo(() => {
        const orgSet = new Set();
        contributedRepos.forEach(repo => {
            if (repo.includes('/')) {
                orgSet.add(repo.split('/')[0]);
            }
        });
        return Array.from(orgSet);
    }, [contributedRepos]);

    // Filter organizations
    const filteredOrgs = useMemo(() => {
        return organizations.filter(org => {
            const matchesSearch = searchQuery === '' ||
                org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                org.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                org.projects.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesCategory = selectedCategory === 'all' || org.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory]);

    const categories = [
        { id: 'all', label: 'All', icon: Globe },
        { id: 'foundation', label: 'Foundations', icon: Building2 },
        { id: 'company', label: 'Companies', icon: Star }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-auto">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-200 mb-2 flex items-center gap-3">
                                <Building2 className="w-8 h-8 text-emerald-400" />
                                Organizations
                            </h2>
                            <p className="text-slate-400">Discover and connect with open source organizations</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search organizations or projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            {categories.map(cat => {
                                const Icon = cat.icon;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedCategory === cat.id
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-emerald-500'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {cat.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Your Organizations */}
                {myOrganizations.length > 0 && (
                    <div className="p-6 border-b border-slate-700">
                        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                            <Heart className="w-5 h-5 text-pink-400" />
                            Organizations You Contribute To
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {myOrganizations.map(org => (
                                <a
                                    key={org}
                                    href={`https://github.com/${org}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 transition-all"
                                >
                                    <GitFork className="w-4 h-4 text-emerald-400" />
                                    {org}
                                    <ExternalLink className="w-3 h-3 text-slate-500" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Organizations Grid */}
                <div className="p-6 space-y-4">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                        Discover Organizations ({filteredOrgs.length})
                    </h3>

                    {filteredOrgs.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-400">No organizations match your search.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredOrgs.map((org, index) => (
                                <div
                                    key={index}
                                    className="bg-slate-700/30 border border-slate-700 rounded-xl p-6 hover:border-emerald-500/50 transition-all"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="text-4xl">{org.icon}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 mb-3">
                                                <div>
                                                    <h4 className="text-xl font-bold text-slate-200 mb-1">{org.name}</h4>
                                                    <p className="text-sm text-slate-400">{org.description}</p>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <a
                                                        href={org.website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-all"
                                                    >
                                                        <Globe className="w-3 h-3" />
                                                        Website
                                                    </a>
                                                    <a
                                                        href={org.github}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-all"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        GitHub
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Popular Projects */}
                                            <div className="mb-4">
                                                <span className="text-xs text-slate-500 font-medium">Popular Projects:</span>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {org.projects.map((project, i) => (
                                                        <span
                                                            key={i}
                                                            className="text-xs px-2 py-1 bg-slate-800 text-emerald-400 rounded border border-slate-700"
                                                        >
                                                            {project}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* How to Connect */}
                                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                                <div className="flex items-center gap-2 text-xs text-blue-400 font-medium mb-1">
                                                    <ArrowRight className="w-3 h-3" />
                                                    How to Connect
                                                </div>
                                                <p className="text-sm text-slate-300">{org.howToConnect}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Tips */}
                <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                        <p className="text-sm text-slate-300 mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            <strong className="text-emerald-400">Tips for Connecting:</strong>
                        </p>
                        <ul className="text-sm text-slate-400 space-y-1 ml-6">
                            <li>• Start by contributing to their projects - even small PRs count!</li>
                            <li>• Join their communication channels (Slack, Discord, mailing lists)</li>
                            <li>• Attend their events, meetups, or conferences</li>
                            <li>• Apply for mentorship programs like GSoC or LFX during application periods</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrganizationsPanel;
