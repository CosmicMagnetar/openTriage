import { useState, useMemo, useEffect } from 'react';
import { ExternalLink, Building2, Globe, Star, GitFork, Search, Heart, Sparkles, ArrowRight, X } from 'lucide-react';
import axios from 'axios';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const OrganizationsPanel = ({ onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [contributedRepos, setContributedRepos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch contributed repos for the "Your Organizations" section
    useEffect(() => {
        const fetchIssues = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const response = await axios.get(`${API}/contributor/my-issues`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                // Backend returns { items: [...], total, pages, limit }
                const issues = response.data?.items || response.data || [];
                const repos = [...new Set(issues.map(i => i.repoName).filter(Boolean))];
                setContributedRepos(repos);
            } catch (error) {
                console.error('Failed to fetch contributions:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchIssues();
    }, []);

    const organizations = [
        {
            name: 'Apache Software Foundation',
            description: 'Non-profit corporation providing software for the public good. Home to 350+ open source projects.',
            website: 'https://apache.org',
            github: 'https://github.com/apache',
            category: 'foundation',
            projects: ['Kafka', 'Spark', 'Hadoop', 'Airflow'],
            howToConnect: 'Join mailing lists, attend ApacheCon, contribute to any Apache project.',
            domain: 'apache.org'
        },
        {
            name: 'Cloud Native Computing Foundation',
            description: 'Building sustainable ecosystems for cloud native software like Kubernetes and Prometheus.',
            website: 'https://cncf.io',
            github: 'https://github.com/cncf',
            category: 'foundation',
            projects: ['Kubernetes', 'Prometheus', 'Envoy', 'Helm'],
            howToConnect: 'Join CNCF Slack, attend KubeCon, start with good-first-issues.',
            domain: 'cncf.io'
        },
        {
            name: 'Mozilla',
            description: 'Non-profit behind Firefox. Champions internet health and privacy.',
            website: 'https://mozilla.org',
            github: 'https://github.com/mozilla',
            category: 'company',
            projects: ['Firefox', 'Rust', 'MDN Web Docs', 'Servo'],
            howToConnect: 'Join Mozilla Community, pick bugs on Bugzilla, attend Mozilla Festival.',
            domain: 'mozilla.org'
        },
        {
            name: 'The Linux Foundation',
            description: 'Supports the creation of sustainable open source ecosystems. Hosts Linux kernel development.',
            website: 'https://linuxfoundation.org',
            github: 'https://github.com/linuxfoundation',
            category: 'foundation',
            projects: ['Linux Kernel', 'Node.js', 'Let\'s Encrypt', 'GraphQL'],
            howToConnect: 'Apply for LFX Mentorship, join project mailing lists, attend Linux conferences.',
            domain: 'linuxfoundation.org'
        },
        {
            name: 'Google Open Source',
            description: 'Home to Google\'s open source projects and contributions.',
            website: 'https://opensource.google',
            github: 'https://github.com/google',
            category: 'company',
            projects: ['TensorFlow', 'Angular', 'Go', 'Flutter'],
            howToConnect: 'Apply for GSoC, join project communities, check good-first-issues.',
            domain: 'google.com'
        },
        {
            name: 'Microsoft Open Source',
            description: 'Microsoft\'s commitment to open source with thousands of projects.',
            website: 'https://opensource.microsoft.com',
            github: 'https://github.com/microsoft',
            category: 'company',
            projects: ['VS Code', 'TypeScript', '.NET', 'Terminal'],
            howToConnect: 'Join VS Code community, contribute via GitHub, attend Microsoft events.',
            domain: 'microsoft.com'
        },
        {
            name: 'Meta Open Source',
            description: 'Open source projects from Meta powering billions of users.',
            website: 'https://opensource.fb.com',
            github: 'https://github.com/facebook',
            category: 'company',
            projects: ['React', 'PyTorch', 'Jest', 'Docusaurus'],
            howToConnect: 'Check React community, join Discord servers, look for good-first-issues.',
            domain: 'meta.com'
        },
        {
            name: 'Python Software Foundation',
            description: 'Non-profit promoting and advancing the Python programming language.',
            website: 'https://python.org',
            github: 'https://github.com/python',
            category: 'foundation',
            projects: ['CPython', 'pip', 'PyPI', 'Python Docs'],
            howToConnect: 'Join python-dev mailing list, contribute to CPython, mentor at PyCon.',
            domain: 'python.org'
        },
        {
            name: 'Rust Foundation',
            description: 'Stewards of the Rust programming language and ecosystem.',
            website: 'https://foundation.rust-lang.org',
            github: 'https://github.com/rust-lang',
            category: 'foundation',
            projects: ['Rust', 'Cargo', 'rustup', 'rust-analyzer'],
            howToConnect: 'Join Rust Discord/Zulip, look for E-easy issues, attend RustConf.',
            domain: 'rust-lang.org'
        },
        {
            name: 'GitLab',
            description: 'The complete DevOps platform, delivered as a single application.',
            website: 'https://gitlab.com',
            github: 'https://gitlab.com/gitlab-org',
            category: 'company',
            projects: ['GitLab', 'GitLab Runner', 'Omnibus', 'Charts'],
            howToConnect: 'Check GitLab Contributing Guide, join community forum, pick issues.',
            domain: 'gitlab.com'
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-[hsl(220,13%,5%)] rounded-xl border border-[hsl(220,13%,14%)] shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-[hsl(210,11%,60%)] hover:text-[hsl(210,11%,90%)] hover:bg-[hsl(220,13%,10%)] rounded-lg transition-all z-10"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-6 md:p-8 space-y-8">
                    {/* Header */}
                    <div>
                        <h1 className="text-3xl font-bold text-[hsl(210,11%,90%)] mb-2 flex items-center gap-3">
                            <Building2 className="w-8 h-8 text-[hsl(142,70%,55%)]" />
                            Organizations
                        </h1>
                        <p className="text-[hsl(210,11%,60%)]">
                            Discover and connect with open source organizations
                        </p>
                    </div>

                    {/* Sub-Header: Search and Filter */}
                    <div className="flex flex-col sm:flex-row gap-4 bg-[hsl(220,13%,7%)] p-4 rounded-xl border border-[hsl(220,13%,14%)]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(210,11%,50%)]" />
                            <input
                                type="text"
                                placeholder="Search organizations or projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg pl-10 pr-4 py-2.5 text-[hsl(210,11%,80%)] placeholder-[hsl(210,11%,40%)] focus:outline-none focus:border-[hsl(220,13%,28%)] transition-colors"
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
                                            ? 'bg-[hsl(142,70%,45%,0.12)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.3)]'
                                            : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,60%)] border border-[hsl(220,13%,18%)] hover:bg-[hsl(220,13%,12%)]'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {cat.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Your Organizations (if any) */}
                    {myOrganizations.length > 0 && (
                        <div className="p-6 bg-[hsl(220,13%,8%)] rounded-xl border border-[hsl(220,13%,14%)]">
                            <h3 className="text-lg font-bold text-[hsl(210,11%,90%)] mb-4 flex items-center gap-2">
                                <Heart className="w-5 h-5 text-pink-500" />
                                Organizations You Contribute To
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                {myOrganizations.map(org => (
                                    <a
                                        key={org}
                                        href={`https://github.com/${org}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,16%)] border border-[hsl(220,13%,18%)] rounded-lg text-[hsl(210,11%,80%)] transition-all"
                                    >
                                        <GitFork className="w-4 h-4 text-[hsl(142,70%,55%)]" />
                                        {org}
                                        <ExternalLink className="w-3 h-3 text-[hsl(210,11%,50%)]" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Organizations Grid */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-[hsl(210,11%,90%)] flex items-center gap-2 px-2">
                            <Sparkles className="w-5 h-5 text-yellow-500" />
                            Discover Organizations ({filteredOrgs.length})
                        </h3>

                        {filteredOrgs.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-[hsl(220,13%,20%)] rounded-xl">
                                <p className="text-[hsl(210,11%,50%)]">No organizations match your search.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {filteredOrgs.map((org, index) => (
                                    <div
                                        key={index}
                                        className="bg-[hsl(220,13%,6%)] border border-[hsl(220,13%,14%)] rounded-xl p-6 hover:border-[hsl(220,13%,20%)] transition-all group"
                                    >
                                        <div className="flex items-start gap-5">
                                            <OrganizationIcon domain={org.domain} name={org.name} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div>
                                                        <h4 className="text-xl font-bold text-[hsl(210,11%,90%)] mb-1 group-hover:text-[hsl(142,70%,55%)] transition-colors">{org.name}</h4>
                                                        <p className="text-sm text-[hsl(210,11%,60%)]">{org.description}</p>
                                                    </div>
                                                    <div className="flex gap-2 flex-shrink-0">
                                                        <a
                                                            href={org.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-xs bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,16%)] text-[hsl(210,11%,80%)] px-3 py-1.5 rounded-lg border border-[hsl(220,13%,18%)] transition-all"
                                                        >
                                                            <Globe className="w-3 h-3" />
                                                            Website
                                                        </a>
                                                        <a
                                                            href={org.github}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-xs bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black font-medium px-3 py-1.5 rounded-lg transition-all"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                            GitHub
                                                        </a>
                                                    </div>
                                                </div>

                                                {/* Popular Projects */}
                                                <div className="mb-4">
                                                    <span className="text-xs text-[hsl(210,11%,50%)] font-medium uppercase tracking-wide">Popular Projects:</span>
                                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                                        {org.projects.map((project, i) => (
                                                            <span
                                                                key={i}
                                                                className="text-xs px-2 py-1 bg-[hsl(220,13%,12%)] text-[hsl(210,11%,75%)] rounded border border-[hsl(220,13%,18%)]"
                                                            >
                                                                {project}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* How to Connect */}
                                                <div className="bg-[hsl(220,13%,8%)] rounded-lg p-3 border border-[hsl(220,13%,14%)]">
                                                    <div className="flex items-center gap-2 text-xs text-blue-400 font-medium mb-1">
                                                        <ArrowRight className="w-3 h-3" />
                                                        How to Connect
                                                    </div>
                                                    <p className="text-sm text-[hsl(210,11%,60%)]">{org.howToConnect}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer Tips */}
                    <div className="sticky bottom-0 bg-[hsl(220,13%,8%)] border-t border-[hsl(220,13%,14%)] p-6 rounded-xl">
                        <div className="bg-[hsl(142,70%,45%,0.1)] border border-[hsl(142,70%,45%,0.2)] rounded-lg p-4">
                            <p className="text-sm text-[hsl(210,11%,80%)] mb-2 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[hsl(142,70%,55%)]" />
                                <strong className="text-[hsl(142,70%,55%)]">Tips for Connecting:</strong>
                            </p>
                            <ul className="text-sm text-[hsl(210,11%,60%)] space-y-1 ml-6 list-disc marker:text-[hsl(210,11%,40%)]">
                                <li>Start by contributing to their projects - even small PRs count!</li>
                                <li>Join their communication channels (Slack, Discord, mailing lists)</li>
                                <li>Attend their events, meetups, or conferences</li>
                                <li>Apply for mentorship programs like GSoC or LFX during application periods</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const OrganizationIcon = ({ domain, name }) => {
    const [error, setError] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Get initials for fallback
    const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

    // Always show fallback first, then overlay with logo if it loads
    return (
        <div className="w-14 h-14 rounded-xl bg-[hsl(220,13%,10%)] flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-[hsl(220,13%,18%)]">
            {/* Fallback content - always visible until image loads */}
            <span className="text-lg font-bold text-[hsl(142,70%,55%)]">{initials}</span>

            {/* Logo image - hidden until loaded */}
            {domain && !error && (
                <img
                    src={`https://logo.clearbit.com/${domain}`}
                    alt={`${name} logo`}
                    className={`absolute inset-0 w-full h-full object-contain p-2 bg-[hsl(220,13%,10%)] transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                />
            )}
        </div>
    );
};

export default OrganizationsPanel;
