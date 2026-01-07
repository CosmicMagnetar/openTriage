import { useState, useEffect } from 'react';
import { Flame, Calendar, TrendingUp, Zap, Trophy } from 'lucide-react';
import { gamificationApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

// Mock data for when API is unavailable
const MOCK_STREAK = {
    current_streak: 5,
    longest_streak: 12,
    total_contribution_days: 45,
    is_active: true
};

const MOCK_CALENDAR = {
    calendar: Array.from({ length: 365 }, (_, i) => ({
        date: new Date(Date.now() - (364 - i) * 86400000).toISOString().split('T')[0],
        contributions: Math.random() > 0.6 ? Math.floor(Math.random() * 5) : 0
    }))
};

const StreakDisplay = () => {
    const { user } = useAuthStore();
    const [streak, setStreak] = useState(null);
    const [calendar, setCalendar] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) {
            setStreak(MOCK_STREAK);
            setCalendar(MOCK_CALENDAR.calendar);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const [streakData, calendarData] = await Promise.all([
                gamificationApi.getUserStreak(user.username),
                gamificationApi.getUserCalendar(user.username, 365)
            ]);
            setStreak(streakData);
            setCalendar(calendarData.calendar || []);
        } catch (error) {
            console.error('Failed to load streak data:', error);
            setStreak(MOCK_STREAK);
            setCalendar(MOCK_CALENDAR.calendar);
        } finally {
            setLoading(false);
        }
    };

    const getStreakIntensity = (days) => {
        if (days >= 30) return 'text-red-500';
        if (days >= 14) return 'text-orange-500';
        if (days >= 7) return 'text-yellow-500';
        return 'text-slate-400';
    };

    const getFireAnimation = (days) => {
        if (days >= 7) return 'animate-pulse';
        return '';
    };

    const getContributionColor = (count) => {
        if (count === 0) return 'bg-slate-700';
        if (count === 1) return 'bg-emerald-900';
        if (count === 2) return 'bg-emerald-700';
        if (count === 3) return 'bg-emerald-500';
        return 'bg-emerald-400';
    };

    // Generate last 52 weeks of calendar data
    const generateCalendarGrid = () => {
        const weeks = [];
        const today = new Date();
        const calendarMap = new Map(calendar.map(d => [d.date, d.contributions]));

        // Start from 52 weeks ago, Sunday
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 364 - startDate.getDay());

        for (let week = 0; week < 53; week++) {
            const days = [];
            for (let day = 0; day < 7; day++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + week * 7 + day);
                const dateStr = date.toISOString().split('T')[0];
                const contributions = calendarMap.get(dateStr) || 0;

                if (date <= today) {
                    days.push({ date: dateStr, contributions, display: date });
                } else {
                    days.push(null);
                }
            }
            weeks.push(days);
        }
        return weeks;
    };

    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="animate-pulse bg-slate-700 rounded-full w-12 h-12"></div>
                    <div className="flex-1">
                        <div className="animate-pulse bg-slate-700 rounded h-4 w-24 mb-2"></div>
                        <div className="animate-pulse bg-slate-700 rounded h-3 w-16"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!streak) {
        return null;
    }

    const calendarGrid = generateCalendarGrid();

    return (
        <div className="bg-gradient-to-r from-slate-800/50 to-orange-900/20 rounded-xl p-4 border border-orange-500/20">
            <div className="flex items-center justify-between mb-4">
                {/* Streak Display */}
                <div className="flex items-center gap-4">
                    <div className={`relative ${getFireAnimation(streak.current_streak)}`}>
                        <Flame className={`w-12 h-12 ${getStreakIntensity(streak.current_streak)}`} />
                        {streak.current_streak >= 7 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                                <Zap className="w-3 h-3 text-white" />
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-bold ${getStreakIntensity(streak.current_streak)}`}>
                                {streak.current_streak}
                            </span>
                            <span className="text-slate-400 text-sm">day streak</span>
                        </div>

                        {streak.is_active ? (
                            <p className="text-emerald-400 text-sm flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" />
                                Keep it going!
                            </p>
                        ) : (
                            <p className="text-yellow-400 text-sm flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Contribute today to continue!
                            </p>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="text-right">
                    <div className="flex items-center gap-1 text-slate-400 text-sm">
                        <span>Longest:</span>
                        <span className="font-bold text-slate-200">{streak.longest_streak} days</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        {streak.total_contribution_days} total active days
                    </div>
                </div>
            </div>

            {/* Contribution Calendar */}
            <div className="mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-400">Contribution Activity</span>
                </div>

                <div className="overflow-x-auto">
                    <div className="flex gap-[2px] min-w-max">
                        {calendarGrid.map((week, weekIdx) => (
                            <div key={weekIdx} className="flex flex-col gap-[2px]">
                                {week.map((day, dayIdx) => (
                                    <div
                                        key={dayIdx}
                                        className={`w-2.5 h-2.5 rounded-sm ${day ? getContributionColor(day.contributions) : 'bg-transparent'
                                            }`}
                                        title={day ? `${day.date}: ${day.contributions} contributions` : ''}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end gap-2 mt-2">
                    <span className="text-xs text-slate-500">Less</span>
                    <div className="flex gap-[2px]">
                        <div className="w-2.5 h-2.5 rounded-sm bg-slate-700" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-900" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-700" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                    </div>
                    <span className="text-xs text-slate-500">More</span>
                </div>
            </div>

            {/* Progress to next milestone */}
            {streak.current_streak > 0 && streak.current_streak < 30 && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Progress to 30-day streak</span>
                        <span>{streak.current_streak}/30</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                            style={{ width: `${(streak.current_streak / 30) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Achievement unlocked at 30 days */}
            {streak.current_streak >= 30 && (
                <div className="mt-3 flex items-center gap-2 text-sm bg-yellow-500/10 rounded-lg px-3 py-2 border border-yellow-500/30">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-400 font-medium">Streak Warrior status achieved!</span>
                </div>
            )}
        </div>
    );
};

export default StreakDisplay;
