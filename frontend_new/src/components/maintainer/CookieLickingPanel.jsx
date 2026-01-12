import { useState, useEffect } from 'react';
import { Cookie, Clock, AlertCircle, UserX, Play, Square, RefreshCw, Filter } from 'lucide-react';
import { cookieLickingApi, profileApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const CookieLickingPanel = () => {
    const { user } = useAuthStore();
    const [status, setStatus] = useState(null);
    const [atRiskClaims, setAtRiskClaims] = useState([]);
    const [connectedRepos, setConnectedRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState('');
    const [loading, setLoading] = useState(true);
    const [releasing, setReleasing] = useState(false);
    const [scanStarted, setScanStarted] = useState(false);

    useEffect(() => {
        loadRepos();
    }, [user]);

    useEffect(() => {
        loadData();
    }, [selectedRepo]);

    const loadRepos = async () => {
        if (!user) return;
        try {
            // First try connected repos
            const data = await profileApi.getConnectedRepos(user.username || user.id);
            let repos = data.repos || [];

            // If no connected repos, fetch from GitHub
            if (repos.length === 0) {
                try {
                    const githubData = await profileApi.getUserRepos(user.username);
                    repos = (githubData.repos || []).map(r => r.name);
                } catch (e) {
                    console.error('Failed to load GitHub repos:', e);
                }
            }

            setConnectedRepos(repos);
        } catch (error) {
            console.error('Failed to load repos:', error);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [statusData, atRiskData] = await Promise.all([
                cookieLickingApi.getStatus(selectedRepo),
                cookieLickingApi.getAtRiskClaims(selectedRepo)
            ]);

            setStatus(statusData);
            setAtRiskClaims(atRiskData.claims || []);
        } catch (error) {
            console.error('Failed to load cookie-licking data:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleScan = async () => {
        try {
            setScanStarted(true);
            if (status?.scanning) {
                await cookieLickingApi.stopScan();
                setStatus(prev => ({ ...prev, scanning: false }));
            } else {
                await cookieLickingApi.startScan();
                setStatus(prev => ({ ...prev, scanning: true }));
            }
            await loadData();
        } catch (error) {
            console.error('Failed to toggle scan:', error);
        } finally {
            setScanStarted(false);
        }
    };

    const releaseExpired = async () => {
        try {
            setReleasing(true);
            await cookieLickingApi.releaseExpired();
            await loadData();
        } catch (error) {
            console.error('Failed to release expired claims:', error);
        } finally {
            setReleasing(false);
        }
    };

    const getTimeColor = (hoursRemaining) => {
        if (hoursRemaining <= 4) return 'text-red-400';
        if (hoursRemaining <= 12) return 'text-orange-400';
        if (hoursRemaining <= 24) return 'text-yellow-400';
        return 'text-slate-400';
    };

    if (loading && !status) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <Cookie className="w-6 h-6 text-amber-400" />
                    <h2 className="text-lg font-bold text-slate-200">Cookie-Licking Monitor</h2>
                </div>
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <Cookie className="w-6 h-6 text-amber-400" />
                    <div>
                        <h2 className="text-lg font-bold text-slate-200">Cookie-Licking Monitor</h2>
                        <p className="text-xs text-slate-400">Track claimed issues with no activity</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Repo Filter */}
                    <div className="relative">
                        <select
                            value={selectedRepo}
                            onChange={(e) => setSelectedRepo(e.target.value)}
                            className="appearance-none bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 pr-8 text-sm 
                        text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                        >
                            <option value="">All Repositories</option>
                            {connectedRepos.map(repo => (
                                <option key={repo} value={repo}>{repo}</option>
                            ))}
                        </select>
                        <Filter className="w-3 h-3 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                    </div>

                    <button
                        onClick={loadData}
                        className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                        onClick={toggleScan}
                        disabled={scanStarted}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50
                       ${status?.scanning
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
                    >
                        {scanStarted ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                        ) : status?.scanning ? (
                            <>
                                <Square className="w-4 h-4" />
                                Stop Scan
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                Start Scan
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Status Summary */}
            {status && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-slate-200">{status.total_claimed || 0}</div>
                        <div className="text-xs text-slate-400">Total Claimed</div>
                    </div>
                    <div className="bg-orange-500/10 rounded-lg p-4 text-center border border-orange-500/30">
                        <div className="text-2xl font-bold text-orange-400">{status.at_risk || 0}</div>
                        <div className="text-xs text-orange-400/70">At Risk</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-4 text-center border border-red-500/30">
                        <div className="text-2xl font-bold text-red-400">{status.expired || 0}</div>
                        <div className="text-xs text-red-400/70">Expired</div>
                    </div>
                </div>
            )}

            {/* At-Risk Claims */}
            {atRiskClaims.length > 0 ? (
                <>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-300">At-Risk Claims</h3>
                        <button
                            onClick={releaseExpired}
                            disabled={releasing}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs 
                        font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                        >
                            {releasing ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400" />
                            ) : (
                                <UserX className="w-4 h-4" />
                            )}
                            Release All Expired
                        </button>
                    </div>

                    <div className="space-y-3">
                        {atRiskClaims.map((claim, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg border-l-4 
                          border-orange-500"
                            >
                                <img
                                    src={`https://github.com/${claim.username}.png`}
                                    alt={claim.username}
                                    className="w-10 h-10 rounded-full"
                                    onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-slate-200">
                                            #{claim.issue_number}
                                        </span>
                                        <span className="text-sm text-slate-400 truncate">
                                            {claim.issue_title}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                        <span>@{claim.username}</span>
                                        <span>•</span>
                                        <span>{claim.repo_name}</span>
                                        <span>•</span>
                                        <span>Claimed {claim.hours_since_claim?.toFixed(0) || 0}h ago</span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className={`flex items-center gap-1 ${getTimeColor(claim.hours_until_expiry)}`}>
                                        <Clock className="w-4 h-4" />
                                        <span className="font-medium">
                                            {claim.hours_until_expiry?.toFixed(0) || 0}h left
                                        </span>
                                    </div>

                                    {claim.hours_until_expiry <= 4 && (
                                        <span className="text-xs text-red-400">Expiring soon!</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="text-center py-8">
                    <Cookie className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No at-risk claims</p>
                    <p className="text-sm text-slate-500 mt-1">
                        {selectedRepo ? `All clear in ${selectedRepo}` : 'All claimed issues are progressing well'}
                    </p>
                </div>
            )}

            {/* Settings Note */}
            <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-start gap-2 text-xs text-slate-500">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>
                        Issues are marked at-risk after 24h with no activity.
                        Contributors receive supportive nudges before automatic release at 48h.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CookieLickingPanel;

