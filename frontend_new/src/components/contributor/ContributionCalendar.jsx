import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Code, GitPullRequest, MessageSquare, Eye } from 'lucide-react';
import { gamificationApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const ContributionCalendar = () => {
    const { user } = useAuthStore();
    const [calendarData, setCalendarData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hoveredDay, setHoveredDay] = useState(null);

    useEffect(() => {
        loadCalendar();
    }, [user]);

    const loadCalendar = async () => {
        if (!user) return;

        try {
            setLoading(true);
            const data = await gamificationApi.getUserCalendar(user.username, 365);
            setCalendarData(data.calendar || []);
        } catch (error) {
            console.error('Failed to load calendar:', error);
        } finally {
            setLoading(false);
        }
    };

    // Create a map for quick lookup
    const dataMap = useMemo(() => {
        const map = new Map();
        calendarData.forEach(day => {
            map.set(day.date, day);
        });
        return map;
    }, [calendarData]);

    // Generate last 365 days
    const weeks = useMemo(() => {
        const result = [];
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 364);

        // Adjust to start on Sunday
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);

        let currentWeek = [];
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + (6 - today.getDay()));

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dayData = dataMap.get(dateStr);

            currentWeek.push({
                date: dateStr,
                ...dayData,
                isFuture: d > today
            });

            if (currentWeek.length === 7) {
                result.push(currentWeek);
                currentWeek = [];
            }
        }

        if (currentWeek.length > 0) {
            result.push(currentWeek);
        }

        return result;
    }, [dataMap]);

    // Get months for labels
    const months = useMemo(() => {
        const result = [];
        let lastMonth = -1;

        weeks.forEach((week, weekIndex) => {
            const firstDay = new Date(week[0].date);
            const month = firstDay.getMonth();

            if (month !== lastMonth) {
                result.push({
                    name: firstDay.toLocaleString('default', { month: 'short' }),
                    weekIndex
                });
                lastMonth = month;
            }
        });

        return result;
    }, [weeks]);

    const getLevelColor = (level, isFuture) => {
        if (isFuture) return 'bg-slate-800/30';

        switch (level) {
            case 4: return 'bg-emerald-400';
            case 3: return 'bg-emerald-500';
            case 2: return 'bg-emerald-600';
            case 1: return 'bg-emerald-700';
            default: return 'bg-slate-700/50';
        }
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <CalendarIcon className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-semibold text-slate-200">Contribution Calendar</h3>
                </div>
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-semibold text-slate-200">Contribution Calendar</h3>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Less</span>
                    <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(level => (
                            <div
                                key={level}
                                className={`w-3 h-3 rounded-sm ${getLevelColor(level, false)}`}
                            />
                        ))}
                    </div>
                    <span>More</span>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-x-auto">
                <div className="min-w-[750px]">
                    {/* Month labels */}
                    <div className="flex mb-2 ml-8">
                        {months.map((month, i) => (
                            <div
                                key={i}
                                className="text-xs text-slate-500"
                                style={{ marginLeft: i === 0 ? 0 : `${(month.weekIndex - (months[i - 1]?.weekIndex || 0)) * 14 - 14}px` }}
                            >
                                {month.name}
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="flex">
                        {/* Day labels */}
                        <div className="flex flex-col gap-1 mr-2 text-xs text-slate-500">
                            {weekDays.map((day, i) => (
                                <div key={i} className="h-3 flex items-center" style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Weeks */}
                        <div className="flex gap-1">
                            {weeks.map((week, weekIndex) => (
                                <div key={weekIndex} className="flex flex-col gap-1">
                                    {week.map((day, dayIndex) => (
                                        <div
                                            key={`${weekIndex}-${dayIndex}`}
                                            className={`w-3 h-3 rounded-sm ${getLevelColor(day.level || 0, day.isFuture)} 
                                 cursor-pointer transition-all hover:ring-2 hover:ring-white/30`}
                                            onMouseEnter={() => setHoveredDay(day)}
                                            onMouseLeave={() => setHoveredDay(null)}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tooltip */}
            {hoveredDay && (hoveredDay.contributions > 0 || hoveredDay.total > 0) && (
                <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                    <div className="text-sm font-medium text-slate-200 mb-2">
                        {new Date(hoveredDay.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </div>
                    <div className="text-xs text-emerald-400 font-medium mb-2">
                        {hoveredDay.contributions || hoveredDay.total || 0} contribution{(hoveredDay.contributions || hoveredDay.total || 0) !== 1 ? 's' : ''}
                    </div>
                    {/* Breakdown if available */}
                    <div className="flex gap-4 text-xs text-slate-400">
                        {hoveredDay.issues > 0 && (
                            <div className="flex items-center gap-1">
                                <Code className="w-3 h-3 text-blue-400" />
                                <span>{hoveredDay.issues} issues</span>
                            </div>
                        )}
                        {hoveredDay.prs > 0 && (
                            <div className="flex items-center gap-1">
                                <GitPullRequest className="w-3 h-3 text-purple-400" />
                                <span>{hoveredDay.prs} PRs</span>
                            </div>
                        )}
                        {hoveredDay.comments > 0 && (
                            <div className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-green-400" />
                                <span>{hoveredDay.comments} comments</span>
                            </div>
                        )}
                        {hoveredDay.reviews > 0 && (
                            <div className="flex items-center gap-1">
                                <Eye className="w-3 h-3 text-yellow-400" />
                                <span>{hoveredDay.reviews} reviews</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Summary stats */}
            <div className="mt-4 flex justify-between text-sm text-slate-400">
                <span>
                    {calendarData.filter(d => (d.contributions || d.total || 0) > 0).length} active days in the last year
                </span>
                <span>
                    Total: {calendarData.reduce((sum, d) => sum + (d.contributions || d.total || 0), 0)} contributions
                </span>
            </div>
        </div>
    );
};

export default ContributionCalendar;
