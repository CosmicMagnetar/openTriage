import { useState, useEffect } from 'react';
import { Eye, GitPullRequest, MessageSquare, Users, Clock, TrendingUp, Award } from 'lucide-react';
import { analyticsApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const InvisibleLaborDashboard = ({ repoName = null }) => {
    const { user } = useAuthStore();
    const [metrics, setMetrics] = useState(null);
    const [topContributors, setTopContributors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(90);

    useEffect(() => {
        loadMetrics();
    }, [user, repoName, timeRange]);

    const loadMetrics = async () => {
        if (!user) return;

        try {
            setLoading(true);

            const [userMetrics, contributors] = await Promise.all([
                analyticsApi.getUserMetrics(user.username, timeRange),
                analyticsApi.getTopContributors(timeRange, 5)
            ]);

            setMetrics(userMetrics);
            setTopContributors(contributors.contributors || []);
        } catch (error) {
            console.error('Failed to load invisible labor metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    const MetricCard = ({ icon: Icon, label, value, subValue, color }) => (
        <div className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-2xl font-bold text-slate-200">{value}</div>
            </div>
            <div className="text-sm text-slate-400">{label}</div>
            {subValue && (
                <div className="text-xs text-slate-500 mt-1">{subValue}</div>
            )}
        </div>
    );

    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <Eye className="w-6 h-6 text-amber-400" />
                    <h2 className="text-lg font-bold text-slate-200">Invisible Labor Dashboard</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="animate-pulse bg-slate-700/30 rounded-lg h-24"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Eye className="w-6 h-6 text-amber-400" />
                    <div>
                        <h2 className="text-lg font-bold text-slate-200">Invisible Labor Dashboard</h2>
                        <p className="text-xs text-slate-400">Your hidden contributions that matter</p>
                    </div>
                </div>

                {/* Time Range Selector */}
                <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(Number(e.target.value))}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                    <option value={180}>Last 6 months</option>
                    <option value={365}>Last year</option>
                </select>
            </div>

            {metrics ? (
                <>
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <MetricCard
                            icon={Eye}
                            label="Code Reviews"
                            value={metrics.review_count || 0}
                            subValue={metrics.review_depth ? `Avg depth: ${metrics.review_depth.toFixed(1)}` : null}
                            color="bg-blue-500"
                        />
                        <MetricCard
                            icon={MessageSquare}
                            label="Mentorship Comments"
                            value={metrics.mentorship_comments || 0}
                            subValue="Helping newcomers"
                            color="bg-green-500"
                        />
                        <MetricCard
                            icon={Clock}
                            label="Avg Response Time"
                            value={metrics.avg_response_time ? `${metrics.avg_response_time.toFixed(0)}h` : 'N/A'}
                            subValue="To issues & PRs"
                            color="bg-purple-500"
                        />
                        <MetricCard
                            icon={Users}
                            label="Contributors Helped"
                            value={metrics.contributors_helped || 0}
                            subValue="Unique people helped"
                            color="bg-amber-500"
                        />
                    </div>

                    {/* Impact Summary */}
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-4 mb-6 border border-amber-500/20">
                        <div className="flex items-center gap-3 mb-2">
                            <Award className="w-5 h-5 text-amber-400" />
                            <span className="font-semibold text-amber-400">Your Impact Score</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white">
                                {metrics.impact_score?.toFixed(0) || 0}
                            </span>
                            <span className="text-slate-400">points</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-2">
                            Based on reviews, mentorship, response time, and community engagement.
                        </p>
                    </div>

                    {/* Contribution Breakdown */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-300 mb-3">Contribution Breakdown</h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Code Reviews', value: metrics.review_count || 0, max: 50, color: 'bg-blue-500' },
                                { label: 'PR Comments', value: metrics.pr_comments || 0, max: 100, color: 'bg-green-500' },
                                { label: 'Issue Triage', value: metrics.issues_triaged || 0, max: 30, color: 'bg-purple-500' },
                                { label: 'Docs Updates', value: metrics.docs_updates || 0, max: 10, color: 'bg-amber-500' },
                            ].map(item => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">{item.label}</span>
                                        <span className="text-slate-300">{item.value}</span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${item.color} transition-all duration-500`}
                                            style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-8 text-slate-400">
                    No metrics available yet
                </div>
            )}

            {/* Top Contributors */}
            {topContributors.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Top Community Contributors
                    </h3>
                    <div className="space-y-2">
                        {topContributors.map((contributor, i) => (
                            <div
                                key={contributor.username}
                                className="flex items-center gap-3 p-2 bg-slate-700/30 rounded-lg"
                            >
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                              ${i === 0 ? 'bg-yellow-500 text-yellow-900' :
                                        i === 1 ? 'bg-slate-400 text-slate-900' :
                                            i === 2 ? 'bg-amber-600 text-amber-100' :
                                                'bg-slate-600 text-slate-300'}`}>
                                    {i + 1}
                                </span>
                                <img
                                    src={`https://github.com/${contributor.username}.png`}
                                    alt={contributor.username}
                                    className="w-8 h-8 rounded-full"
                                    onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-200">@{contributor.username}</div>
                                    <div className="text-xs text-slate-500">
                                        {contributor.review_count} reviews · {contributor.mentorship_comments} mentoring
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-amber-400">{contributor.impact_score?.toFixed(0)}</div>
                                    <div className="text-xs text-slate-500">points</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Export Button */}
            <div className="mt-6 pt-4 border-t border-slate-700">
                <button
                    className="w-full py-2 bg-amber-500/20 text-amber-400 rounded-lg font-medium 
                    hover:bg-amber-500/30 transition-colors flex items-center justify-center gap-2"
                    onClick={() => alert('Coming soon: Export as PDF for your Contribution CV!')}
                >
                    <Award className="w-4 h-4" />
                    Export as Contribution CV
                </button>
            </div>
        </div>
    );
};

export default InvisibleLaborDashboard;
