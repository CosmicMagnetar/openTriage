import { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Download, RefreshCw, Save, Flame, Code, GitPullRequest, GitCommit, Star, Activity, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import GitHubHeatmap from './GitHubHeatmap';
import { profileApi, gamificationApi } from '../../services/api';

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

// Clean Activity Radar Chart
const ActivityRadar = ({ data }) => {
    // Always use demo values to ensure the chart looks filled
    const demoData = {
        commits: 75,
        issues: 50,
        pullRequests: 65,
        reviews: 40,
        repos: 55
    };

    // Check if we have real data
    const hasRealData = data && Object.values(data).some(v => v > 5);
    const displayData = hasRealData ? data : demoData;

    const radarData = [
        { subject: 'Commits', value: displayData.commits || 75 },
        { subject: 'Issues', value: displayData.issues || 50 },
        { subject: 'PRs', value: displayData.pullRequests || 65 },
        { subject: 'Reviews', value: displayData.reviews || 40 },
        { subject: 'Repos', value: displayData.repos || 55 },
    ];

    return (
        <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} outerRadius="65%">
                <PolarGrid stroke="rgba(255,255,255,0.15)" />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }}
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
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.4}
                    strokeWidth={2}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
};

// Modern Language Donut Chart with enhanced UI
const LanguageDonut = ({ languages }) => {
    // GitHub-style language colors
    const LANGUAGE_COLORS = {
        'JavaScript': '#f1e05a',
        'TypeScript': '#3178c6',
        'Python': '#3572A5',
        'Java': '#b07219',
        'Go': '#00ADD8',
        'Rust': '#dea584',
        'Ruby': '#701516',
        'C++': '#f34b7d',
        'C#': '#178600',
        'PHP': '#4F5D95',
        'Swift': '#F05138',
        'Kotlin': '#A97BFF',
        'Scala': '#c22d40',
        'Shell': '#89e051',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'Vue': '#41b883',
        'Dart': '#00B4AB',
    };

    const DEFAULT_COLORS = ['#3fb950', '#58a6ff', '#a371f7', '#f78166', '#db61a2', '#79c0ff'];
    const [activeIndex, setActiveIndex] = useState(null);

    let data = Object.entries(languages || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], index) => ({
            name,
            value,
            color: LANGUAGE_COLORS[name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
        }));

    // Show placeholder when no data is available
    if (data.length === 0 || data.every(d => d.value === 0)) {
        return (
            <div className="relative h-[240px] flex flex-col items-center justify-center bg-gradient-to-br from-[#161b22] to-[#0d1117] rounded-xl">
                <div className="w-20 h-20 rounded-full border-4 border-[#30363d] flex items-center justify-center mb-3">
                    <div className="w-12 h-12 rounded-full border-2 border-[#238636]/30 border-t-[#238636] animate-spin" />
                </div>
                <div className="text-[#8b949e] text-sm">Analyzing languages...</div>
            </div>
        );
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    const topLanguage = data[0]?.name || 'N/A';
    const topPercent = total > 0 ? ((data[0]?.value / total) * 100).toFixed(0) : 0;

    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const { name, value, color } = payload[0].payload;
            const percentage = ((value / total) * 100).toFixed(1);
            return (
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <p className="text-sm font-semibold text-white">{name}</p>
                    </div>
                    <p className="text-xs text-[#8b949e]">
                        <span className="text-white font-medium">{percentage}%</span> of codebase
                    </p>
                </div>
            );
        }
        return null;
    };

    const onPieEnter = (_, index) => setActiveIndex(index);
    const onPieLeave = () => setActiveIndex(null);

    return (
        <div className="relative bg-gradient-to-br from-[#161b22] to-[#0d1117] rounded-xl p-4">
            {/* Chart Container */}
            <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                            onMouseEnter={onPieEnter}
                            onMouseLeave={onPieLeave}
                            animationBegin={0}
                            animationDuration={800}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    stroke={activeIndex === index ? entry.color : 'transparent'}
                                    strokeWidth={activeIndex === index ? 3 : 0}
                                    style={{
                                        filter: activeIndex === index ? 'brightness(1.2) drop-shadow(0 0 8px currentColor)' : 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        opacity: activeIndex !== null && activeIndex !== index ? 0.5 : 1,
                                    }}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>

                {/* Center Content */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <div
                        className="w-3 h-3 rounded-full mx-auto mb-1 transition-all duration-300"
                        style={{
                            backgroundColor: activeIndex !== null ? data[activeIndex]?.color : data[0]?.color,
                            boxShadow: `0 0 12px ${activeIndex !== null ? data[activeIndex]?.color : data[0]?.color}40`
                        }}
                    />
                    <span className="text-2xl font-bold text-white block">
                        {activeIndex !== null
                            ? ((data[activeIndex]?.value / total) * 100).toFixed(0)
                            : topPercent}%
                    </span>
                    <p className="text-xs text-[#8b949e] max-w-[90px] truncate">
                        {activeIndex !== null ? data[activeIndex]?.name : topLanguage}
                    </p>
                </div>
            </div>

            {/* Legend - Modern Grid Layout */}
            <div className="grid grid-cols-2 gap-2 mt-4">
                {data.map((entry, index) => {
                    const percentage = ((entry.value / total) * 100).toFixed(1);
                    const isActive = activeIndex === index;
                    return (
                        <div
                            key={entry.name}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 ${isActive ? 'bg-[#21262d]' : 'hover:bg-[#21262d]/50'
                                }`}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(null)}
                        >
                            <div
                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-all duration-200"
                                style={{
                                    backgroundColor: entry.color,
                                    boxShadow: isActive ? `0 0 8px ${entry.color}` : 'none'
                                }}
                            />
                            <span className={`text-xs truncate flex-1 transition-colors ${isActive ? 'text-white' : 'text-[#8b949e]'}`}>
                                {entry.name}
                            </span>
                            <span className={`text-xs font-medium transition-colors ${isActive ? 'text-white' : 'text-[#484f58]'}`}>
                                {percentage}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Mini Stat Card - with responsive minimum sizing
const MiniStat = ({ icon: Icon, label, value, color }) => {
    const colors = {
        green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };

    return (
        <div className={`${colors[color]} rounded-lg p-3 border min-h-[72px] flex flex-col justify-center`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-[11px] text-gray-400 truncate">{label}</span>
            </div>
            <p className="text-lg font-bold text-white truncate">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
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
    const [apiLanguages, setApiLanguages] = useState(null);
    const [realCalendarData, setRealCalendarData] = useState(null);

    // Fetch languages from our API (works for all users)
    useEffect(() => {
        const fetchLanguages = async () => {
            if (!username) return;

            try {
                const data = await profileApi.getUserLanguages(username);
                if (data?.languages && data.languages.length > 0) {
                    // Convert API response to format needed by LanguageDonut
                    const langMap = {};
                    data.languages.forEach(lang => {
                        langMap[lang.language] = lang.percentage;
                    });
                    setApiLanguages(langMap);
                }
            } catch (err) {
                console.log('Failed to fetch languages from API:', err);
            }
        };

        fetchLanguages();
    }, [username]);

    // Fetch real contribution calendar data for the heatmap
    useEffect(() => {
        const fetchCalendar = async () => {
            if (!username) return;
            try {
                const calendarResponse = await gamificationApi.getUserCalendar(username, 365);
                if (calendarResponse?.calendar) {
                    setRealCalendarData(calendarResponse.calendar);
                }
            } catch (err) {
                console.log('Failed to fetch calendar data:', err);
            }
        };
        fetchCalendar();
    }, [username]);

    // Fetch public GitHub data for non-OpenTriage users
    useEffect(() => {
        const fetchPublicData = async () => {
            if (!isGitHubFallback || !username) return;

            try {
                const eventsRes = await fetch(`https://api.github.com/users/${username}/events/public?per_page=100`);
                if (eventsRes.ok) {
                    const events = await eventsRes.json();
                    const eventCounts = events.reduce((acc, event) => {
                        acc[event.type] = (acc[event.type] || 0) + 1;
                        return acc;
                    }, {});

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

    // Load cached stats on mount
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

    // Build heatmap data from real calendar or public events
    const contributionData = (() => {
        const data = new Array(371).fill(0);
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        if (realCalendarData && realCalendarData.length > 0) {
            // Build a date → contributions map from real API data
            const calMap = new Map(
                realCalendarData.map(d => [d.date, d.contributions || d.total || 0])
            );
            for (let i = 0; i < 371; i++) {
                const date = new Date(oneYearAgo);
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                data[i] = calMap.get(dateStr) || 0;
            }
        } else if (isGitHubFallback && publicContributions?.contributionMap) {
            for (let i = 0; i < 371; i++) {
                const date = new Date(oneYearAgo);
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                data[i] = publicContributions.contributionMap[dateStr] || 0;
            }
        }
        // No more random dummy data — empty heatmap is shown for users without data
        return data;
    })();

    // Activity data for radar - ensure meaningful values
    // Map API field names: totalCommits, totalPRs, totalIssues, totalReviews, public_repos
    const rawActivityData = isGitHubFallback && publicContributions ? {
        commits: Math.min(100, (publicContributions.pushEvents || 0) * 2),
        issues: Math.min(100, (publicContributions.issueEvents || 0) * 10),
        pullRequests: Math.min(100, (publicContributions.prEvents || 0) * 5),
        reviews: Math.min(100, 10),
        repos: Math.min(100, (githubStats?.public_repos || 0) * 2),
    } : {
        commits: Math.min(100, (githubStats?.totalCommits || githubStats?.commits || 0) / 10),
        issues: Math.min(100, (githubStats?.totalIssues || githubStats?.issues || 0) * 5),
        pullRequests: Math.min(100, (githubStats?.totalPRs || githubStats?.pullRequests || 0) * 3),
        reviews: Math.min(100, (githubStats?.totalReviews || githubStats?.reviews || 0) * 4),
        repos: Math.min(100, (githubStats?.public_repos || githubStats?.repos || 0) * 2),
    };

    // Use demo data if all values are 0
    const hasActivityData = Object.values(rawActivityData).some(v => v > 0);
    const activityData = hasActivityData ? rawActivityData : {
        commits: 70,
        issues: 45,
        pullRequests: 60,
        reviews: 35,
        repos: 50
    };

    // Priority: API languages > public languages > githubStats languages
    const languages = apiLanguages || publicLanguages || githubStats?.languages || null;

    const totalContributions = isGitHubFallback && publicContributions
        ? publicContributions.events
        : (githubStats?.totalContributions || 0);

    const saveStatsImage = async () => {
        if (!statCardRef.current) return;

        setSaving(true);
        try {
            const html2canvas = (await import('html2canvas')).default;

            const canvas = await html2canvas(statCardRef.current, {
                backgroundColor: '#0f172a',
                scale: 2,
                useCORS: true,
            });

            const imageData = canvas.toDataURL('image/png');
            await saveToIndexedDB(username, imageData, githubStats);
            setCachedImage(imageData);

            const link = document.createElement('a');
            link.download = `${username}-stats-${new Date().toISOString().split('T')[0]}.png`;
            link.href = imageData;
            link.click();

            toast.success('Stats saved!');

            if (onSaveStats) {
                onSaveStats(imageData);
            }
        } catch (error) {
            console.error('Failed to save stats:', error);
            toast.error('Failed to save stats');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Main Stats Card */}
            <div
                ref={statCardRef}
                className="bg-[#0d1117] rounded-xl border border-[#21262d] overflow-hidden"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-[#21262d] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-[#e6edf3]">Contribution Stats</h2>
                            <p className="text-xs text-[#7d8590]">GitHub activity overview</p>
                        </div>
                    </div>
                    {isOwner && (
                        <button
                            onClick={saveStatsImage}
                            disabled={saving}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 
                                text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save
                        </button>
                    )}
                </div>

                {/* Quick Stats */}
                <div className="p-4 sm:p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
                        <MiniStat
                            icon={GitCommit}
                            label="Commits"
                            value={githubStats?.totalCommits || githubStats?.commits || publicContributions?.pushEvents || 0}
                            color="green"
                        />
                        <MiniStat
                            icon={GitPullRequest}
                            label="PRs"
                            value={githubStats?.totalPRs || githubStats?.pullRequests || publicContributions?.prEvents || 0}
                            color="blue"
                        />
                        <MiniStat
                            icon={Star}
                            label="Stars"
                            value={githubStats?.total_stars || githubStats?.stars || 0}
                            color="orange"
                        />
                        <MiniStat
                            icon={Users}
                            label="Followers"
                            value={githubStats?.followers || 0}
                            color="purple"
                        />
                    </div>

                    {/* Heatmap */}
                    <div className="mb-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-4 h-4 text-[#7d8590]" />
                            <span className="text-sm text-[#7d8590]">Contribution Activity</span>
                        </div>
                        <div className="bg-[#161b22] rounded-lg p-4 overflow-x-auto">
                            <GitHubHeatmap data={contributionData} totalContributions={totalContributions} />
                        </div>
                    </div>

                    {/* Charts - stack on mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#161b22] rounded-lg p-4 min-h-[260px]">
                            <h3 className="text-sm text-[#7d8590] mb-2">Activity</h3>
                            <ActivityRadar data={activityData} />
                        </div>
                        <div className="bg-[#161b22] rounded-lg p-4 min-h-[260px]">
                            <h3 className="text-sm text-[#7d8590] mb-2">Top Languages</h3>
                            <LanguageDonut languages={languages} />
                        </div>
                    </div>

                    {/* Total */}
                    <div className="mt-5 text-center py-4 bg-[#161b22] rounded-lg border border-[#21262d]">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Flame className="w-5 h-5 text-orange-400" />
                            <span className="text-3xl font-bold text-[#e6edf3]">
                                {totalContributions?.toLocaleString() || '0'}
                            </span>
                        </div>
                        <span className="text-sm text-[#7d8590]">
                            {isGitHubFallback ? 'recent activities' : 'contributions this year'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Cached Preview */}
            {isOwner && cachedImage && (
                <div className="bg-[#0d1117] rounded-xl border border-[#21262d] p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-[#7d8590]">Saved Snapshot</span>
                        <a
                            href={cachedImage}
                            download={`${username}-stats.png`}
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                            <Download className="w-3 h-3" />
                            Download
                        </a>
                    </div>
                    <img
                        src={cachedImage}
                        alt="Cached stats"
                        className="w-full rounded-lg opacity-75 hover:opacity-100 transition-opacity"
                    />
                </div>
            )}
        </div>
    );
};

export default ContributionStats;
