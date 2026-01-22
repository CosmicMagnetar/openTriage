import { useEffect, useState } from 'react';
import axios from 'axios';
import { TrendingUp, GitPullRequest, AlertCircle, CheckCircle, GitBranch, Calendar, Award, Star, Users } from 'lucide-react';
import { profileApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const ContributorMetrics = () => {
    const { user } = useAuthStore();
    const [metrics, setMetrics] = useState(null);
    const [githubStats, setGithubStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMetrics();
    }, [user]);

    const loadMetrics = async () => {
        setLoading(true);
        try {
            const [metricsResponse, statsResponse] = await Promise.all([
                axios.get(`${API}/contributor/dashboard-summary`),
                user?.username ? profileApi.getGitHubStats(user.username) : Promise.resolve(null)
            ]);
            setMetrics(metricsResponse.data);
            setGithubStats(statsResponse);
        } catch (error) {
            console.error('Error loading metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin w-8 h-8 border-2 border-[hsl(142,70%,45%)] border-t-transparent rounded-full" />
                    <p className="text-[hsl(210,11%,50%)] text-sm">Loading metrics...</p>
                </div>
            </div>
        );
    }

    const prSuccessRate = metrics?.totalPRs > 0
        ? ((metrics.mergedPRs / metrics.totalPRs) * 100).toFixed(1)
        : 0;

    const issueResolutionRate = metrics?.totalIssues > 0
        ? ((metrics.closedIssues / metrics.totalIssues) * 100).toFixed(1)
        : 0;

    return (
        <div className="w-full h-full overflow-auto p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-[hsl(210,11%,90%)] mb-1">Contribution Metrics</h1>
                    <p className="text-[hsl(210,11%,50%)] text-sm">
                        Track your open source contribution activity
                    </p>
                </div>

                {/* Overview Stats */}
                <div className="grid grid-cols-4 gap-4">
                    <MetricCard
                        icon={TrendingUp}
                        label="Total Contributions"
                        value={metrics?.totalContributions || 0}
                        color="emerald"
                        trend="+12% this month"
                    />
                    <MetricCard
                        icon={GitBranch}
                        label="Repositories"
                        value={metrics?.repositoriesContributed || 0}
                        color="purple"
                        trend="Across GitHub"
                    />
                    <MetricCard
                        icon={Award}
                        label="PR Success Rate"
                        value={`${prSuccessRate}%`}
                        color="blue"
                        trend={`${metrics?.mergedPRs || 0} merged`}
                    />
                    <MetricCard
                        icon={CheckCircle}
                        label="Issue Resolution"
                        value={`${issueResolutionRate}%`}
                        color="orange"
                        trend={`${metrics?.closedIssues || 0} resolved`}
                    />
                </div>

                {/* Pull Requests Section */}
                <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-5">
                    <div className="flex items-center gap-3 mb-5">
                        <GitPullRequest className="w-5 h-5 text-purple-400" />
                        <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)]">Pull Requests</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <StatBox
                            label="Total PRs"
                            value={metrics?.totalPRs || 0}
                            icon={GitPullRequest}
                            color="purple"
                        />
                        <StatBox
                            label="Open PRs"
                            value={metrics?.openPRs || 0}
                            icon={GitPullRequest}
                            color="blue"
                        />
                        <StatBox
                            label="Merged PRs"
                            value={metrics?.mergedPRs || 0}
                            icon={CheckCircle}
                            color="emerald"
                        />
                    </div>

                    {/* PR Progress Bar */}
                    <div className="mt-5">
                        <div className="flex justify-between text-sm text-[hsl(210,11%,50%)] mb-2">
                            <span>PR Status Distribution</span>
                            <span>{metrics?.totalPRs || 0} total</span>
                        </div>
                        <div className="h-2 bg-[hsl(220,13%,12%)] rounded-full overflow-hidden flex">
                            <div
                                className="bg-[hsl(142,70%,45%)] transition-all duration-500"
                                style={{ width: `${(metrics?.mergedPRs / (metrics?.totalPRs || 1)) * 100}%` }}
                                title={`Merged: ${metrics?.mergedPRs || 0}`}
                            />
                            <div
                                className="bg-[hsl(217,91%,60%)] transition-all duration-500"
                                style={{ width: `${(metrics?.openPRs / (metrics?.totalPRs || 1)) * 100}%` }}
                                title={`Open: ${metrics?.openPRs || 0}`}
                            />
                        </div>
                        <div className="flex gap-4 mt-2 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 bg-[hsl(142,70%,45%)] rounded-full" />
                                <span className="text-[hsl(210,11%,50%)]">Merged ({metrics?.mergedPRs || 0})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 bg-[hsl(217,91%,60%)] rounded-full" />
                                <span className="text-[hsl(210,11%,50%)]">Open ({metrics?.openPRs || 0})</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Issues Section */}
                <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-5">
                    <div className="flex items-center gap-3 mb-5">
                        <AlertCircle className="w-5 h-5 text-orange-400" />
                        <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)]">Issues</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <StatBox
                            label="Total Issues"
                            value={metrics?.totalIssues || 0}
                            icon={AlertCircle}
                            color="orange"
                        />
                        <StatBox
                            label="Open Issues"
                            value={metrics?.openIssues || 0}
                            icon={AlertCircle}
                            color="blue"
                        />
                        <StatBox
                            label="Closed Issues"
                            value={metrics?.closedIssues || 0}
                            icon={CheckCircle}
                            color="emerald"
                        />
                    </div>

                    {/* Issue Progress Bar */}
                    <div className="mt-5">
                        <div className="flex justify-between text-sm text-[hsl(210,11%,50%)] mb-2">
                            <span>Issue Status Distribution</span>
                            <span>{metrics?.totalIssues || 0} total</span>
                        </div>
                        <div className="h-2 bg-[hsl(220,13%,12%)] rounded-full overflow-hidden flex">
                            <div
                                className="bg-[hsl(142,70%,45%)] transition-all duration-500"
                                style={{ width: `${(metrics?.closedIssues / (metrics?.totalIssues || 1)) * 100}%` }}
                                title={`Closed: ${metrics?.closedIssues || 0}`}
                            />
                            <div
                                className="bg-[hsl(217,91%,60%)] transition-all duration-500"
                                style={{ width: `${(metrics?.openIssues / (metrics?.totalIssues || 1)) * 100}%` }}
                                title={`Open: ${metrics?.openIssues || 0}`}
                            />
                        </div>
                        <div className="flex gap-4 mt-2 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 bg-[hsl(142,70%,45%)] rounded-full" />
                                <span className="text-[hsl(210,11%,50%)]">Closed ({metrics?.closedIssues || 0})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 bg-[hsl(217,91%,60%)] rounded-full" />
                                <span className="text-[hsl(210,11%,50%)]">Open ({metrics?.openIssues || 0})</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity Summary */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[hsl(220,13%,8%)] border border-[hsl(142,70%,45%,0.2)] rounded-lg p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <Award className="w-6 h-6 text-[hsl(142,70%,55%)]" />
                            <div>
                                <h3 className="text-base font-semibold text-[hsl(142,70%,55%)]">Contribution Impact</h3>
                                <p className="text-xs text-[hsl(210,11%,50%)]">Your open source footprint</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <ImpactItem label="Repositories Contributed" value={metrics?.repositoriesContributed || 0} />
                            <ImpactItem label="Total Contributions" value={metrics?.totalContributions || 0} />
                            <ImpactItem label="Success Rate" value={`${prSuccessRate}%`} />
                        </div>
                    </div>

                    <div className="bg-[hsl(220,13%,8%)] border border-purple-500/20 rounded-lg p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <Calendar className="w-6 h-6 text-purple-400" />
                            <div>
                                <h3 className="text-base font-semibold text-purple-400">Activity Overview</h3>
                                <p className="text-xs text-[hsl(210,11%,50%)]">Recent contribution stats</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <ImpactItem label="Active PRs" value={metrics?.openPRs || 0} />
                            <ImpactItem label="Active Issues" value={metrics?.openIssues || 0} />
                            <ImpactItem label="Completed Work" value={(metrics?.mergedPRs || 0) + (metrics?.closedIssues || 0)} />
                        </div>
                    </div>
                </div>

                {/* GitHub Stats Section */}
                {githubStats && (
                    <div className="bg-[hsl(220,13%,8%)] border border-[hsl(217,91%,60%,0.2)] rounded-lg p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <GitBranch className="w-6 h-6 text-[hsl(217,91%,65%)]" />
                            <div>
                                <h3 className="text-base font-semibold text-[hsl(217,91%,65%)]">GitHub Profile Stats</h3>
                                <p className="text-xs text-[hsl(210,11%,50%)]">Your overall GitHub statistics</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-[hsl(220,13%,10%)] rounded-md p-4 border border-[hsl(220,13%,15%)]">
                                <div className="flex items-center gap-2 mb-2">
                                    <GitBranch className="w-4 h-4 text-[hsl(217,91%,65%)]" />
                                    <span className="text-sm text-[hsl(210,11%,50%)]">Public Repos</span>
                                </div>
                                <div className="text-2xl font-bold text-[hsl(217,91%,65%)]">{githubStats.public_repos || 0}</div>
                            </div>
                            <div className="bg-[hsl(220,13%,10%)] rounded-md p-4 border border-[hsl(220,13%,15%)]">
                                <div className="flex items-center gap-2 mb-2">
                                    <Star className="w-4 h-4 text-yellow-400" />
                                    <span className="text-sm text-[hsl(210,11%,50%)]">Total Stars</span>
                                </div>
                                <div className="text-2xl font-bold text-yellow-400">{githubStats.total_stars || 0}</div>
                            </div>
                            <div className="bg-[hsl(220,13%,10%)] rounded-md p-4 border border-[hsl(220,13%,15%)]">
                                <div className="flex items-center gap-2 mb-2">
                                    <Users className="w-4 h-4 text-[hsl(142,70%,55%)]" />
                                    <span className="text-sm text-[hsl(210,11%,50%)]">Followers</span>
                                </div>
                                <div className="text-2xl font-bold text-[hsl(142,70%,55%)]">{githubStats.followers || 0}</div>
                            </div>
                            <div className="bg-[hsl(220,13%,10%)] rounded-md p-4 border border-[hsl(220,13%,15%)]">
                                <div className="flex items-center gap-2 mb-2">
                                    <Users className="w-4 h-4 text-purple-400" />
                                    <span className="text-sm text-[hsl(210,11%,50%)]">Following</span>
                                </div>
                                <div className="text-2xl font-bold text-purple-400">{githubStats.following || 0}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const MetricCard = ({ icon: Icon, label, value, color, trend }) => {
    const colors = {
        emerald: 'border-[hsl(142,70%,45%,0.25)] text-[hsl(142,70%,55%)]',
        purple: 'border-purple-500/25 text-purple-400',
        blue: 'border-[hsl(217,91%,60%,0.25)] text-[hsl(217,91%,65%)]',
        orange: 'border-orange-500/25 text-orange-400'
    };

    return (
        <div className={`bg-[hsl(220,13%,8%)] border rounded-lg p-4 transition-colors ${colors[color]}`}>
            <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4" />
                <span className="text-sm text-[hsl(210,11%,50%)]">{label}</span>
            </div>
            <div className="text-3xl font-bold mb-1">{value}</div>
            <div className="text-xs text-[hsl(210,11%,40%)]">{trend}</div>
        </div>
    );
};

const StatBox = ({ label, value, icon: Icon, color }) => {
    const colors = {
        emerald: 'text-[hsl(142,70%,55%)]',
        purple: 'text-purple-400',
        blue: 'text-[hsl(217,91%,65%)]',
        orange: 'text-orange-400'
    };

    return (
        <div className="bg-[hsl(220,13%,10%)] rounded-md p-4 border border-[hsl(220,13%,15%)]">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${colors[color]}`} />
                <span className="text-sm text-[hsl(210,11%,50%)]">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
        </div>
    );
};

const ImpactItem = ({ label, value }) => {
    return (
        <div className="flex justify-between items-center">
            <span className="text-[hsl(210,11%,60%)] text-sm">{label}</span>
            <span className="text-lg font-semibold text-[hsl(210,11%,90%)]">{value}</span>
        </div>
    );
};

export default ContributorMetrics;
