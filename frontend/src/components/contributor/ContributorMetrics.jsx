import { useEffect, useState } from 'react';
import axios from 'axios';
import { TrendingUp, GitPullRequest, AlertCircle, CheckCircle, GitBranch, Calendar, Award } from 'lucide-react';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const ContributorMetrics = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMetrics();
    }, []);

    const loadMetrics = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API}/contributor/dashboard-summary`);
            setMetrics(response.data);
        } catch (error) {
            console.error('Error loading metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full" />
                    <p className="text-slate-400">Loading metrics...</p>
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
        <div className="w-full h-full overflow-auto p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-4xl font-bold text-slate-200 mb-2">Contribution Metrics</h1>
                    <p className="text-slate-400">
                        Track your open source contribution activity and impact
                    </p>
                </div>

                {/* Overview Stats */}
                <div className="grid grid-cols-4 gap-6">
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
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <GitPullRequest className="w-6 h-6 text-purple-400" />
                        <h2 className="text-2xl font-bold text-slate-200">Pull Requests</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
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
                    <div className="mt-6">
                        <div className="flex justify-between text-sm text-slate-400 mb-2">
                            <span>PR Status Distribution</span>
                            <span>{metrics?.totalPRs || 0} total</span>
                        </div>
                        <div className="h-4 bg-slate-900 rounded-full overflow-hidden flex">
                            <div
                                className="bg-emerald-500 transition-all duration-500"
                                style={{ width: `${(metrics?.mergedPRs / (metrics?.totalPRs || 1)) * 100}%` }}
                                title={`Merged: ${metrics?.mergedPRs || 0}`}
                            />
                            <div
                                className="bg-blue-500 transition-all duration-500"
                                style={{ width: `${(metrics?.openPRs / (metrics?.totalPRs || 1)) * 100}%` }}
                                title={`Open: ${metrics?.openPRs || 0}`}
                            />
                        </div>
                        <div className="flex gap-4 mt-2 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                                <span className="text-slate-400">Merged ({metrics?.mergedPRs || 0})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                                <span className="text-slate-400">Open ({metrics?.openPRs || 0})</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Issues Section */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <AlertCircle className="w-6 h-6 text-orange-400" />
                        <h2 className="text-2xl font-bold text-slate-200">Issues</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
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
                    <div className="mt-6">
                        <div className="flex justify-between text-sm text-slate-400 mb-2">
                            <span>Issue Status Distribution</span>
                            <span>{metrics?.totalIssues || 0} total</span>
                        </div>
                        <div className="h-4 bg-slate-900 rounded-full overflow-hidden flex">
                            <div
                                className="bg-emerald-500 transition-all duration-500"
                                style={{ width: `${(metrics?.closedIssues / (metrics?.totalIssues || 1)) * 100}%` }}
                                title={`Closed: ${metrics?.closedIssues || 0}`}
                            />
                            <div
                                className="bg-blue-500 transition-all duration-500"
                                style={{ width: `${(metrics?.openIssues / (metrics?.totalIssues || 1)) * 100}%` }}
                                title={`Open: ${metrics?.openIssues || 0}`}
                            />
                        </div>
                        <div className="flex gap-4 mt-2 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                                <span className="text-slate-400">Closed ({metrics?.closedIssues || 0})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                                <span className="text-slate-400">Open ({metrics?.openIssues || 0})</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity Summary */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Award className="w-8 h-8 text-emerald-400" />
                            <div>
                                <h3 className="text-xl font-bold text-emerald-400">Contribution Impact</h3>
                                <p className="text-sm text-slate-400">Your open source footprint</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <ImpactItem label="Repositories Contributed" value={metrics?.repositoriesContributed || 0} />
                            <ImpactItem label="Total Contributions" value={metrics?.totalContributions || 0} />
                            <ImpactItem label="Success Rate" value={`${prSuccessRate}%`} />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/30 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Calendar className="w-8 h-8 text-purple-400" />
                            <div>
                                <h3 className="text-xl font-bold text-purple-400">Activity Overview</h3>
                                <p className="text-sm text-slate-400">Recent contribution stats</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <ImpactItem label="Active PRs" value={metrics?.openPRs || 0} />
                            <ImpactItem label="Active Issues" value={metrics?.openIssues || 0} />
                            <ImpactItem label="Completed Work" value={(metrics?.mergedPRs || 0) + (metrics?.closedIssues || 0)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ icon: Icon, label, value, color, trend }) => {
    const colors = {
        emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
        orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400'
    };

    return (
        <div className={`bg-slate-800/80 backdrop-blur-sm border rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] ${colors[color]}`}>
            <div className="flex items-center gap-3 mb-4">
                <Icon className="w-6 h-6" />
                <span className="text-sm font-medium text-slate-400">{label}</span>
            </div>
            <div className="text-4xl font-bold mb-2">{value}</div>
            <div className="text-xs text-slate-500">{trend}</div>
        </div>
    );
};

const StatBox = ({ label, value, icon: Icon, color }) => {
    const colors = {
        emerald: 'text-emerald-400',
        purple: 'text-purple-400',
        blue: 'text-blue-400',
        orange: 'text-orange-400'
    };

    return (
        <div className="bg-slate-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${colors[color]}`} />
                <span className="text-sm text-slate-400">{label}</span>
            </div>
            <div className={`text-3xl font-bold ${colors[color]}`}>{value}</div>
        </div>
    );
};

const ImpactItem = ({ label, value }) => {
    return (
        <div className="flex justify-between items-center">
            <span className="text-slate-300">{label}</span>
            <span className="text-xl font-bold text-white">{value}</span>
        </div>
    );
};

export default ContributorMetrics;
