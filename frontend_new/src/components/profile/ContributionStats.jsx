import { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis } from 'recharts';
import { Download, RefreshCw, Save, TrendingUp, Flame, Trophy, Code, GitPullRequest, GitCommit, Star, Zap, Activity } from 'lucide-react';
import { toast } from 'sonner';
import GitHubHeatmap from './GitHubHeatmap';

// IndexedDB helper for offline-first caching
const DB_NAME = 'OpenTriageStats';
const STORE_NAME = 'statsSnapshots';

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'username' });
            }
        };
    });
};

const saveToIndexedDB = async (username, imageData, stats) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ username, imageData, stats, savedAt: new Date().toISOString() });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

const loadFromIndexedDB = async (username) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(username);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

// Activity Radar Chart with glow effect
const ActivityRadar = ({ data }) => {
    const radarData = [
        { subject: 'Commits', value: data?.commits || 0, fullMark: 100, icon: '💻' },
        { subject: 'Issues', value: data?.issues || 0, fullMark: 100, icon: '🐛' },
        { subject: 'PRs', value: data?.pullRequests || 0, fullMark: 100, icon: '🔀' },
        { subject: 'Reviews', value: data?.reviews || 0, fullMark: 100, icon: '👀' },
        { subject: 'Repos', value: data?.repos || 0, fullMark: 100, icon: '📁' },
    ];
    
    return (
        <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} outerRadius="70%">
                <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142, 70%, 55%)" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="hsl(142, 70%, 35%)" stopOpacity={0.3}/>
                    </linearGradient>
                </defs>
                <PolarGrid stroke="hsl(220, 13%, 20%)" strokeDasharray="3 3" />
                <PolarAngleAxis 
                    dataKey="subject" 
                    tick={({ x, y, payload }) => (
                        <g transform={`translate(${x},${y})`}>
                            <text 
                                x={0} 
                                y={0} 
                                dy={4}
                                textAnchor="middle" 
                                fill="hsl(210, 11%, 70%)" 
                                fontSize={11}
                                fontWeight={500}
                            >
                                {payload.value}
                            </text>
                        </g>
                    )}
                />
                <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    tick={false}
                    axisLine={false}
                />
                <Radar
                    name="Activity"
                    dataKey="value"
                    stroke="hsl(142, 70%, 50%)"
                    fill="url(#radarGradient)"
                    strokeWidth={2}
                    filter="url(#glow)"
                    animationDuration={1000}
                    animationEasing="ease-out"
                />
            </RadarChart>
        </ResponsiveContainer>
    );
};
                <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: 'hsl(210, 11%, 60%)', fontSize: 12 }}
                />
                <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    tick={false}
                    axisLine={false}
                />
                <Radar
                    name="Activity"
                    dataKey="value"
                    stroke="hsl(142, 70%, 45%)"
                    fill="hsl(142, 70%, 45%)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
};

// Language Donut Chart with improved aesthetics
const LanguageDonut = ({ languages }) => {
    const COLORS = [
        'hsl(142, 70%, 50%)',  // Bright Green
        'hsl(217, 91%, 60%)',  // Bright Blue
        'hsl(280, 65%, 60%)',  // Purple
        'hsl(45, 100%, 55%)',  // Gold
        'hsl(340, 75%, 55%)',  // Pink
        'hsl(180, 70%, 45%)',  // Cyan
    ];
    
    const data = Object.entries(languages || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (data.length === 0) {
        data.push({ name: 'No data', value: 1 });
    }
    
    const topLanguage = data[0]?.name || 'N/A';
    const topPercent = total > 0 ? ((data[0]?.value / total) * 100).toFixed(0) : 0;
    
    return (
        <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                    <defs>
                        {COLORS.map((color, idx) => (
                            <linearGradient key={idx} id={`langGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={1}/>
                                <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                            </linearGradient>
                        ))}
                    </defs>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        animationDuration={800}
                        animationEasing="ease-out"
                    >
                        {data.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={`url(#langGrad${index % COLORS.length})`}
                                stroke="hsl(220, 13%, 8%)"
                                strokeWidth={2}
                            />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ 
                            background: 'hsl(220, 13%, 10%)', 
                            border: '1px solid hsl(220, 13%, 25%)',
                            borderRadius: '12px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                        }}
                        formatter={(value) => [`${((value / total) * 100).toFixed(1)}%`, 'Usage']}
                    />
                </PieChart>
            </ResponsiveContainer>
            {/* Center text with icon */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <Code className="w-5 h-5 mx-auto mb-1 text-[hsl(142,70%,55%)]" />
                <span className="text-xl font-bold text-[hsl(210,11%,95%)]">
                    {topPercent}%
                </span>
                <p className="text-[10px] text-[hsl(210,11%,50%)] mt-0.5">{topLanguage}</p>
            </div>
            {/* Legend with dots */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                {data.slice(0, 5).map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                        <div 
                            className="w-2.5 h-2.5 rounded-full shadow-sm" 
                            style={{ 
                                backgroundColor: COLORS[index % COLORS.length],
                                boxShadow: `0 0 6px ${COLORS[index % COLORS.length]}40`
                            }}
                        />
                        <span className="text-[hsl(210,11%,65%)] font-medium">
                            {entry.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Stat Card with icon and animated value
const StatCard = ({ icon: Icon, label, value, color = 'green', trend }) => {
    const colorClasses = {
        green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
        blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400',
        purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400',
        orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30 text-orange-400',
        pink: 'from-pink-500/20 to-pink-600/5 border-pink-500/30 text-pink-400',
    };
    
    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 border backdrop-blur-sm 
            hover:scale-[1.02] transition-all duration-300 cursor-default`}>
            <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${colorClasses[color].split(' ').pop()}`} />
                {trend && (
                    <span className="flex items-center gap-0.5 text-xs text-emerald-400">
                        <TrendingUp className="w-3 h-3" />
                        {trend}
                    </span>
                )}
            </div>
            <p className="text-2xl font-bold text-[hsl(210,11%,95%)] tracking-tight">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-[hsl(210,11%,50%)] mt-1">{label}</p>
        </div>
    );
};

// Main Component
const ContributionStats = ({ username, githubStats, onSaveStats, isGitHubFallback, isOwner = true }) => {
    const statCardRef = useRef(null);
    const [saving, setSaving] = useState(false);
    const [cachedImage, setCachedImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [publicContributions, setPublicContributions] = useState(null);
    const [publicLanguages, setPublicLanguages] = useState(null);
    
    // Fetch public GitHub data for non-OpenTriage users
    useEffect(() => {
        const fetchPublicData = async () => {
            if (!isGitHubFallback || !username) return;
            
            try {
                // Fetch public events to estimate activity
                const eventsRes = await fetch(`https://api.github.com/users/${username}/events/public?per_page=100`);
                if (eventsRes.ok) {
                    const events = await eventsRes.json();
                    
                    // Count different event types
                    const eventCounts = events.reduce((acc, event) => {
                        acc[event.type] = (acc[event.type] || 0) + 1;
                        return acc;
                    }, {});
                    
                    // Build contribution data from events
                    const contributionMap = {};
                    events.forEach(event => {
                        const date = event.created_at.split('T')[0];
                        contributionMap[date] = (contributionMap[date] || 0) + 1;
                    });
                    
                    setPublicContributions({
                        events: events.length,
                        pushEvents: eventCounts.PushEvent || 0,
                        prEvents: eventCounts.PullRequestEvent || 0,
                        issueEvents: eventCounts.IssuesEvent || 0,
                        createEvents: eventCounts.CreateEvent || 0,
                        contributionMap
                    });
                }
                
                // Fetch repos to get language data
                const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`);
                if (reposRes.ok) {
                    const repos = await reposRes.json();
                    const langCounts = {};
                    repos.forEach(repo => {
                        if (repo.language) {
                            langCounts[repo.language] = (langCounts[repo.language] || 0) + 1;
                        }
                    });
                    setPublicLanguages(langCounts);
                }
            } catch (err) {
                console.log('Failed to fetch public GitHub data:', err);
            }
        };
        
        fetchPublicData();
    }, [username, isGitHubFallback]);
    
    // Load cached stats on mount (offline-first)
    useEffect(() => {
        const loadCached = async () => {
            try {
                const cached = await loadFromIndexedDB(username);
                if (cached?.imageData) {
                    setCachedImage(cached.imageData);
                }
            } catch (err) {
                console.log('No cached stats found');
            } finally {
                setLoading(false);
            }
        };
        if (username) loadCached();
    }, [username]);
    
    // Generate contribution data for isometric grid
    const contributionData = (() => {
        const data = new Array(371).fill(0); // 53 weeks * 7 days
        
        // Use real public contribution data if available
        if (isGitHubFallback && publicContributions?.contributionMap) {
            const today = new Date();
            const oneYearAgo = new Date(today);
            oneYearAgo.setFullYear(today.getFullYear() - 1);
            
            for (let i = 0; i < 371; i++) {
                const date = new Date(oneYearAgo);
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                data[i] = publicContributions.contributionMap[dateStr] || 0;
            }
        } else if (githubStats?.totalContributions) {
            // Simulate contribution pattern from stats for OpenTriage users
            const total = githubStats.totalContributions;
            for (let i = 0; i < 371; i++) {
                const weekFactor = Math.sin(i / 30) * 0.5 + 0.5;
                const randomFactor = Math.random();
                if (randomFactor > 0.3) {
                    data[i] = Math.floor(randomFactor * weekFactor * 15);
                }
            }
        }
        return data;
    })();
    
    // Activity data for radar chart
    const activityData = isGitHubFallback && publicContributions ? {
        commits: Math.min(100, (publicContributions.pushEvents || 0) * 2),
        issues: Math.min(100, (publicContributions.issueEvents || 0) * 10),
        pullRequests: Math.min(100, (publicContributions.prEvents || 0) * 5),
        reviews: Math.min(100, 10), // Can't get from public API
        repos: Math.min(100, (githubStats?.public_repos || 0) * 2),
    } : {
        commits: Math.min(100, (githubStats?.commits || 0) / 10),
        issues: Math.min(100, (githubStats?.issues || 0) * 5),
        pullRequests: Math.min(100, (githubStats?.pullRequests || 0) * 3),
        reviews: Math.min(100, (githubStats?.reviews || 0) * 4),
        repos: Math.min(100, (githubStats?.repos || 0) * 2),
    };
    
    // Language data - use public data if available
    const languages = publicLanguages || githubStats?.languages || {
        TypeScript: 45,
        Python: 30,
        Rust: 15,
        Other: 10,
    };
    
    // Calculate total contributions for display
    const totalContributions = isGitHubFallback && publicContributions
        ? publicContributions.events
        : (githubStats?.totalContributions || 0);
    
    const saveStatsImage = async () => {
        if (!statCardRef.current) return;
        
        setSaving(true);
        try {
            // Dynamically import html2canvas
            const html2canvas = (await import('html2canvas')).default;
            
            const canvas = await html2canvas(statCardRef.current, {
                backgroundColor: '#0d1117',
                scale: 2,
                useCORS: true,
            });
            
            const imageData = canvas.toDataURL('image/png');
            
            // Save to IndexedDB for offline caching
            await saveToIndexedDB(username, imageData, githubStats);
            setCachedImage(imageData);
            
            // Trigger download
            const link = document.createElement('a');
            link.download = `${username}-stats-${new Date().toISOString().split('T')[0]}.png`;
            link.href = imageData;
            link.click();
            
            toast.success('Stats saved! Image downloaded and cached for offline viewing.');
            
            if (onSaveStats) {
                onSaveStats(imageData);
            }
        } catch (error) {
            console.error('Failed to save stats:', error);
            toast.error('Failed to save stats image');
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <div className="space-y-6">
            {/* Stat Card - Capturable */}
            <div 
                ref={statCardRef}
                className="bg-gradient-to-br from-[hsl(220,13%,10%)] to-[hsl(220,13%,6%)] rounded-2xl p-6 border border-[hsl(220,13%,18%)] shadow-xl"
            >
                {/* Header with glowing accent */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 
                            flex items-center justify-center border border-emerald-500/30">
                            <Activity className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[hsl(210,11%,95%)] tracking-tight">
                                Contribution Stats
                            </h2>
                            <p className="text-xs text-[hsl(210,11%,50%)]">Your GitHub activity overview</p>
                        </div>
                    </div>
                    {isOwner && (
                        <button
                            onClick={saveStatsImage}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 
                                text-white rounded-xl hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 
                                transition-all duration-300 font-semibold text-sm shadow-lg shadow-emerald-500/20
                                hover:shadow-emerald-500/40 hover:scale-[1.02]"
                        >
                            {saving ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save Stats
                        </button>
                    )}
                </div>
                
                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <StatCard 
                        icon={GitCommit} 
                        label="Commits" 
                        value={githubStats?.commits || publicContributions?.pushEvents || 0}
                        color="green"
                    />
                    <StatCard 
                        icon={GitPullRequest} 
                        label="Pull Requests" 
                        value={githubStats?.pullRequests || publicContributions?.prEvents || 0}
                        color="blue"
                    />
                    <StatCard 
                        icon={Flame} 
                        label="Current Streak" 
                        value={githubStats?.streak || '0 days'}
                        color="orange"
                    />
                    <StatCard 
                        icon={Star} 
                        label="Stars Earned" 
                        value={githubStats?.stars || 0}
                        color="purple"
                    />
                </div>
                
                {/* GitHub-style 2D Contribution Heatmap */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-semibold text-[hsl(210,11%,80%)]">
                            Contribution Activity
                        </h3>
                    </div>
                    <div className="bg-[hsl(220,13%,6%)] rounded-xl p-4 overflow-x-auto border border-[hsl(220,13%,12%)]">
                        <GitHubHeatmap 
                            data={contributionData} 
                            totalContributions={totalContributions}
                        />
                    </div>
                </div>
                
                {/* Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Radar Chart */}
                    <div className="bg-gradient-to-br from-[hsl(220,13%,12%)] to-[hsl(220,13%,8%)] rounded-xl p-4 border border-[hsl(220,13%,15%)]">
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="w-4 h-4 text-blue-400" />
                            <h3 className="text-sm font-semibold text-[hsl(210,11%,80%)]">
                                Activity Breakdown
                            </h3>
                        </div>
                        <ActivityRadar data={activityData} />
                    </div>
                    
                    {/* Donut Chart */}
                    <div className="bg-gradient-to-br from-[hsl(220,13%,12%)] to-[hsl(220,13%,8%)] rounded-xl p-4 border border-[hsl(220,13%,15%)]">
                        <div className="flex items-center gap-2 mb-2">
                            <Code className="w-4 h-4 text-purple-400" />
                            <h3 className="text-sm font-semibold text-[hsl(210,11%,80%)]">
                                Language Distribution
                            </h3>
                        </div>
                        <LanguageDonut languages={languages} />
                    </div>
                </div>
                
                {/* Total Contributions - Hero Section */}
                <div className="mt-6 text-center py-6 rounded-xl bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10 border border-[hsl(220,13%,15%)]">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <Flame className="w-6 h-6 text-orange-400 animate-pulse" />
                        <span className="text-4xl font-black bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                            {totalContributions?.toLocaleString() || '0'}
                        </span>
                        <Flame className="w-6 h-6 text-orange-400 animate-pulse" />
                    </div>
                    <span className="text-sm text-[hsl(210,11%,60%)] font-medium">
                        {isGitHubFallback ? 'Recent Activities' : 'Total Contributions'}
                    </span>
                    {isGitHubFallback && (
                        <p className="text-xs text-[hsl(210,11%,40%)] mt-2">
                            📊 Based on public GitHub activity (last 100 events)
                        </p>
                    )}
                </div>
            </div>
            
            {/* Cached Image Preview (if available and is owner) */}
            {isOwner && cachedImage && (
                <div className="bg-gradient-to-br from-[hsl(220,13%,10%)] to-[hsl(220,13%,6%)] rounded-2xl p-5 border border-[hsl(220,13%,18%)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Download className="w-4 h-4 text-blue-400" />
                            <h3 className="text-sm font-semibold text-[hsl(210,11%,80%)]">
                                Cached Snapshot
                            </h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                                Offline Ready
                            </span>
                        </div>
                        <a
                            href={cachedImage}
                            download={`${username}-stats.png`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-400 bg-blue-500/10 
                                rounded-lg hover:bg-blue-500/20 transition-colors font-medium border border-blue-500/20"
                        >
                            <Download className="w-3 h-3" />
                            Download
                        </a>
                    </div>
                    <img 
                        src={cachedImage} 
                        alt="Cached stats" 
                        className="w-full rounded-xl border border-[hsl(220,13%,15%)] opacity-80 hover:opacity-100 transition-opacity"
                    />
                </div>
            )}
        </div>
    );
};

export default ContributionStats;
