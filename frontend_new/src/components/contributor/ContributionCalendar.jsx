import { useState, useEffect } from 'react';
import { GitCommit, GitPullRequest, MessageSquare, Bug, ChevronDown } from 'lucide-react';
import { gamificationApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

// Contribution Activity Component - Shows activity breakdown like GitHub
const ContributionCalendar = () => {
    const { user } = useAuthStore();
    const [calendarData, setCalendarData] = useState([]);
    const [totalContributions, setTotalContributions] = useState(0);
    const [loading, setLoading] = useState(true);
    const [expandedMonths, setExpandedMonths] = useState(new Set());

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await gamificationApi.getUserCalendar(user.username, 365);
            setCalendarData(data.calendar || []);
            setTotalContributions(data.totalContributions || 0);
        } catch (error) {
            console.error('Failed to load calendar data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Group contributions by month
    const getMonthlyActivity = () => {
        const months = {};
        const today = new Date();

        calendarData.forEach(day => {
            if (!day.date) return;
            const date = new Date(day.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            if (!months[monthKey]) {
                months[monthKey] = {
                    key: monthKey,
                    name: monthName,
                    totalContributions: 0,
                    activeDays: 0,
                    commits: 0,
                    prs: 0,
                    issues: 0,
                    reviews: 0
                };
            }

            const contributions = day.contributions || day.total || 0;
            months[monthKey].totalContributions += contributions;
            if (contributions > 0) {
                months[monthKey].activeDays += 1;
            }
            // Add detailed breakdown if available
            months[monthKey].commits += day.commits || contributions; // Fallback to total if no detail
            months[monthKey].prs += day.prs || 0;
            months[monthKey].issues += day.issues || 0;
            months[monthKey].reviews += day.reviews || 0;
        });

        // Sort by month (newest first)
        return Object.values(months).sort((a, b) => b.key.localeCompare(a.key));
    };

    const toggleMonth = (monthKey) => {
        setExpandedMonths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(monthKey)) {
                newSet.delete(monthKey);
            } else {
                newSet.add(monthKey);
            }
            return newSet;
        });
    };

    if (loading) {
        return (
            <div className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Contribution Activity</h3>
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#238636]"></div>
                </div>
            </div>
        );
    }

    const monthlyActivity = getMonthlyActivity();

    return (
        <div className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-200">Contribution Activity</h3>
                <span className="text-sm text-[#238636] font-medium">
                    {totalContributions.toLocaleString()} total contributions
                </span>
            </div>

            {monthlyActivity.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    <GitCommit className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No contribution activity yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {monthlyActivity.slice(0, 6).map((month) => (
                        <div key={month.key} className="border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleMonth(month.key)}
                                className="w-full flex items-center justify-between p-4 hover:bg-[hsl(220,13%,10%)] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#238636]/20 flex items-center justify-center">
                                        <GitCommit className="w-4 h-4 text-[#238636]" />
                                    </div>
                                    <div className="text-left">
                                        <h4 className="font-medium text-slate-200">{month.name}</h4>
                                        <p className="text-sm text-slate-400">
                                            {month.totalContributions} contributions in {month.activeDays} days
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown
                                    className={`w-5 h-5 text-slate-400 transition-transform ${expandedMonths.has(month.key) ? 'rotate-180' : ''
                                        }`}
                                />
                            </button>

                            {expandedMonths.has(month.key) && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[hsl(220,13%,6%)] border-t border-[hsl(220,13%,15%)]">
                                    <div className="flex items-center gap-2">
                                        <GitCommit className="w-4 h-4 text-[#238636]" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{month.commits}</p>
                                            <p className="text-xs text-slate-400">Commits</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <GitPullRequest className="w-4 h-4 text-purple-400" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{month.prs}</p>
                                            <p className="text-xs text-slate-400">Pull Requests</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Bug className="w-4 h-4 text-blue-400" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{month.issues}</p>
                                            <p className="text-xs text-slate-400">Issues</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-yellow-400" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{month.reviews}</p>
                                            <p className="text-xs text-slate-400">Reviews</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ContributionCalendar;
