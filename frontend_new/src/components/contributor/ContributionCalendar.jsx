import { useState, useEffect } from 'react';
import { GitCommit, GitPullRequest, FolderPlus, ExternalLink } from 'lucide-react';
import { gamificationApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

// Contribution Activity Component - Shows activity breakdown like GitHub
const ContributionCalendar = ({ selectedYear }) => {
    const { user } = useAuthStore();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [months, setMonths] = useState([]);

    useEffect(() => {
        loadData();
    }, [user, selectedYear]);

    const loadData = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const year = selectedYear || new Date().getFullYear();
            const data = await gamificationApi.getUserEvents(user.username, year);
            setActivities(data.activities || []);
            setMonths(data.months || []);
        } catch (error) {
            console.error('Failed to load activity data:', error);
            setActivities([]);
        } finally {
            setLoading(false);
        }
    };

    // Group activities by month
    const groupedByMonth = activities.reduce((acc, activity) => {
        if (!acc[activity.month]) {
            acc[activity.month] = [];
        }
        acc[activity.month].push(activity);
        return acc;
    }, {});

    const getActivityIcon = (type) => {
        switch (type) {
            case 'commits':
                return <GitCommit className="w-4 h-4 text-[#8b949e]" />;
            case 'pr':
                return <GitPullRequest className="w-4 h-4 text-[#8b949e]" />;
            case 'repo':
                return <FolderPlus className="w-4 h-4 text-[#8b949e]" />;
            default:
                return <GitCommit className="w-4 h-4 text-[#8b949e]" />;
        }
    };

    if (loading) {
        return (
            <div className="bg-[#0d1117] rounded-lg border border-[#30363d] p-4">
                <h3 className="text-base font-semibold text-[#c9d1d9] mb-4">Contribution activity</h3>
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#238636]"></div>
                </div>
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="bg-[#0d1117] rounded-lg border border-[#30363d] p-4">
                <h3 className="text-base font-semibold text-[#c9d1d9] mb-4">Contribution activity</h3>
                <p className="text-[#8b949e] text-sm py-4">No activity found for this period.</p>
            </div>
        );
    }

    return (
        <div className="bg-[#0d1117] rounded-lg border border-[#30363d] p-4">
            <h3 className="text-base font-semibold text-[#c9d1d9] mb-6">Contribution activity</h3>

            {/* Scrollable activity list */}
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                {Object.entries(groupedByMonth).map(([month, monthActivities]) => (
                    <div key={month}>
                        {/* Month header */}
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-px h-4 bg-[#30363d]"></div>
                            <h4 className="text-sm font-medium text-[#c9d1d9]">{month}</h4>
                        </div>

                        {/* Activities for this month */}
                        <div className="space-y-4 ml-2 border-l-2 border-[#30363d] pl-4">
                            {monthActivities.map((activity, idx) => (
                                <div key={idx} className="relative">
                                    {/* Timeline dot */}
                                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-[#21262d] border-2 border-[#30363d] rounded-full"></div>

                                    {/* Activity card */}
                                    <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                                            <div className="flex-1">
                                                <p className="text-sm text-[#c9d1d9]">{activity.description}</p>

                                                {/* Repo commit bars */}
                                                {activity.type === 'commits' && activity.repos && (
                                                    <div className="mt-3 space-y-2">
                                                        {activity.repos.map((repo, repoIdx) => (
                                                            <div key={repoIdx} className="flex items-center gap-2">
                                                                <a
                                                                    href={`https://github.com/${repo.name}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-[#58a6ff] hover:underline min-w-[200px]"
                                                                >
                                                                    {repo.name}
                                                                </a>
                                                                <span className="text-xs text-[#8b949e]">{repo.count} commit{repo.count !== 1 ? 's' : ''}</span>
                                                                {/* Progress bar */}
                                                                <div className="flex-1 h-2 bg-[#21262d] rounded-full overflow-hidden max-w-[200px]">
                                                                    <div
                                                                        className="h-full bg-[#238636] rounded-full"
                                                                        style={{ width: `${repo.maxCount > 0 ? (repo.count / repo.maxCount) * 100 : 0}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Date for PRs/issues */}
                                                {activity.date && (
                                                    <p className="text-xs text-[#8b949e] mt-1">{activity.date}</p>
                                                )}
                                            </div>

                                            {/* External link */}
                                            {activity.link && (
                                                <a
                                                    href={`https://github.com/${activity.link}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#8b949e] hover:text-[#58a6ff]"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContributionCalendar;
