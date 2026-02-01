import { useState, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Download, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';

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

// 3D Isometric Grid Component
const IsometricGrid = ({ data, maxValue }) => {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !data) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Isometric projection settings
        const cellWidth = 12;
        const cellHeight = 6;
        const maxHeight = 40;
        const cols = 53; // weeks in a year
        const rows = 7; // days in a week
        
        const offsetX = width / 2 - (cols * cellWidth) / 2;
        const offsetY = 60;
        
        // Draw isometric grid
        for (let week = 0; week < cols; week++) {
            for (let day = 0; day < rows; day++) {
                const idx = week * 7 + day;
                const value = data[idx] || 0;
                const heightFactor = maxValue > 0 ? value / maxValue : 0;
                const cellHeight3D = heightFactor * maxHeight;
                
                // Calculate isometric position
                const isoX = offsetX + (week - day) * cellWidth * 0.866;
                const isoY = offsetY + (week + day) * cellHeight * 0.5;
                
                // Color based on contribution level
                let color;
                if (value === 0) {
                    color = 'hsl(220, 13%, 15%)';
                } else if (value <= 2) {
                    color = 'hsl(142, 70%, 25%)';
                } else if (value <= 5) {
                    color = 'hsl(142, 70%, 35%)';
                } else if (value <= 10) {
                    color = 'hsl(142, 70%, 45%)';
                } else {
                    color = 'hsl(142, 70%, 55%)';
                }
                
                // Draw 3D cell (top face)
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(isoX, isoY - cellHeight3D);
                ctx.lineTo(isoX + cellWidth * 0.866, isoY - cellHeight * 0.5 - cellHeight3D);
                ctx.lineTo(isoX, isoY - cellHeight - cellHeight3D);
                ctx.lineTo(isoX - cellWidth * 0.866, isoY - cellHeight * 0.5 - cellHeight3D);
                ctx.closePath();
                ctx.fill();
                
                // Draw right face (darker)
                if (cellHeight3D > 0) {
                    ctx.fillStyle = color.replace(')', ', 0.7)').replace('hsl', 'hsla');
                    ctx.beginPath();
                    ctx.moveTo(isoX, isoY - cellHeight3D);
                    ctx.lineTo(isoX + cellWidth * 0.866, isoY - cellHeight * 0.5 - cellHeight3D);
                    ctx.lineTo(isoX + cellWidth * 0.866, isoY - cellHeight * 0.5);
                    ctx.lineTo(isoX, isoY);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Draw left face (even darker)
                    ctx.fillStyle = color.replace(')', ', 0.5)').replace('hsl', 'hsla');
                    ctx.beginPath();
                    ctx.moveTo(isoX, isoY - cellHeight3D);
                    ctx.lineTo(isoX - cellWidth * 0.866, isoY - cellHeight * 0.5 - cellHeight3D);
                    ctx.lineTo(isoX - cellWidth * 0.866, isoY - cellHeight * 0.5);
                    ctx.lineTo(isoX, isoY);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
    }, [data, maxValue]);
    
    return (
        <canvas 
            ref={canvasRef} 
            width={700} 
            height={200} 
            className="w-full h-auto"
            style={{ imageRendering: 'pixelated' }}
        />
    );
};

// Activity Radar Chart
const ActivityRadar = ({ data }) => {
    const radarData = [
        { subject: 'Commit', value: data?.commits || 0, fullMark: 100 },
        { subject: 'Issue', value: data?.issues || 0, fullMark: 100 },
        { subject: 'PullReq', value: data?.pullRequests || 0, fullMark: 100 },
        { subject: 'Review', value: data?.reviews || 0, fullMark: 100 },
        { subject: 'Repo', value: data?.repos || 0, fullMark: 100 },
    ];
    
    return (
        <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(220, 13%, 20%)" />
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

// Language Donut Chart
const LanguageDonut = ({ languages }) => {
    const COLORS = [
        'hsl(142, 70%, 45%)',  // Green (main)
        'hsl(217, 91%, 60%)',  // Blue
        'hsl(280, 65%, 55%)',  // Purple
        'hsl(45, 100%, 50%)',  // Yellow
        'hsl(210, 11%, 50%)',  // Gray
    ];
    
    const data = Object.entries(languages || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (data.length === 0) {
        data.push({ name: 'No data', value: 1 });
    }
    
    return (
        <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ 
                            background: 'hsl(220, 13%, 10%)', 
                            border: '1px solid hsl(220, 13%, 20%)',
                            borderRadius: '8px'
                        }}
                        formatter={(value) => [`${((value / total) * 100).toFixed(1)}%`, 'Usage']}
                    />
                </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <span className="text-2xl font-bold text-[hsl(210,11%,90%)]">
                    {total > 0 ? `${((data[0]?.value / total) * 100).toFixed(0)}%` : '-'}
                </span>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
                {data.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1 text-xs">
                        <div 
                            className="w-3 h-3 rounded-sm" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-[hsl(210,11%,60%)]">
                            {entry.name} ({((entry.value / total) * 100).toFixed(0)}%)
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Main Component
const ContributionStats = ({ username, githubStats, onSaveStats, isGitHubFallback }) => {
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
    
    const maxContribution = Math.max(...contributionData, 1);
    
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
                className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)]">
                        Contribution Stats
                    </h2>
                    <button
                        onClick={saveStatsImage}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(142,70%,45%)] text-black rounded-lg
                            hover:bg-[hsl(142,70%,50%)] disabled:opacity-50 transition-colors font-medium text-sm"
                    >
                        {saving ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save Stats
                    </button>
                </div>
                
                {/* 3D Isometric Contribution Graph */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-[hsl(210,11%,60%)] mb-3">
                        Activity Overview
                    </h3>
                    <div className="bg-[hsl(220,13%,6%)] rounded-lg p-4 overflow-hidden">
                        <IsometricGrid data={contributionData} maxValue={maxContribution} />
                    </div>
                </div>
                
                {/* Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Radar Chart */}
                    <div className="bg-[hsl(220,13%,10%)] rounded-lg p-4">
                        <h3 className="text-sm font-medium text-[hsl(210,11%,60%)] mb-2">
                            Activity
                        </h3>
                        <ActivityRadar data={activityData} />
                    </div>
                    
                    {/* Donut Chart */}
                    <div className="bg-[hsl(220,13%,10%)] rounded-lg p-4">
                        <h3 className="text-sm font-medium text-[hsl(210,11%,60%)] mb-2">
                            Top Languages
                        </h3>
                        <LanguageDonut languages={languages} />
                    </div>
                </div>
                
                {/* Total Contributions */}
                <div className="mt-6 text-center">
                    <span className="text-3xl font-bold text-[hsl(142,70%,55%)]">
                        {totalContributions?.toLocaleString() || '0'}
                    </span>
                    <span className="text-[hsl(210,11%,50%)] ml-2">
                        {isGitHubFallback ? 'recent activities' : 'contributions'}
                    </span>
                    {isGitHubFallback && (
                        <p className="text-xs text-[hsl(210,11%,40%)] mt-1">
                            Based on public GitHub activity (last 100 events)
                        </p>
                    )}
                </div>
            </div>
            
            {/* Cached Image Preview (if available) */}
            {cachedImage && (
                <div className="bg-[hsl(220,13%,8%)] rounded-xl p-4 border border-[hsl(220,13%,15%)]">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-[hsl(210,11%,60%)]">
                            Cached Snapshot (Offline Available)
                        </h3>
                        <a
                            href={cachedImage}
                            download={`${username}-stats.png`}
                            className="flex items-center gap-1 text-xs text-[hsl(217,91%,60%)] hover:underline"
                        >
                            <Download className="w-3 h-3" />
                            Download
                        </a>
                    </div>
                    <img 
                        src={cachedImage} 
                        alt="Cached stats" 
                        className="w-full rounded-lg border border-[hsl(220,13%,15%)] opacity-75"
                    />
                </div>
            )}
        </div>
    );
};

export default ContributionStats;
