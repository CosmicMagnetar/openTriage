import { useState, useEffect } from 'react';
import { Flame, Calendar, TrendingUp, Zap, Trophy, ChevronDown } from 'lucide-react';
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

// Generate years for selector (from 2020 to current year)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

const StreakDisplay = () => {
    const { user } = useAuthStore();
    const [streak, setStreak] = useState(null);
    const [calendar, setCalendar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [totalContributions, setTotalContributions] = useState(0);
    const [showYearDropdown, setShowYearDropdown] = useState(false);

    useEffect(() => {
        loadData();
    }, [user, selectedYear]);

    const loadData = async () => {
        if (!user) {
            setStreak(MOCK_STREAK);
            setCalendar(MOCK_CALENDAR.calendar);
            setTotalContributions(MOCK_CALENDAR.calendar.reduce((sum, d) => sum + d.contributions, 0));
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

            // Filter calendar data for selected year
            const yearData = (calendarData.calendar || []).filter(d =>
                d.date && d.date.startsWith(String(selectedYear))
            );
            setCalendar(yearData);

            // Calculate total contributions for the SELECTED YEAR from filtered data
            // Use contributions field (from GitHub) or total field (from local DB)
            const yearTotal = yearData.reduce((sum, d) => sum + (d.contributions || d.total || 0), 0);

            // If selected year is current year and API returned totalContributions, use it
            // Otherwise calculate from the filtered year data
            const currentYear = new Date().getFullYear();
            if (selectedYear === currentYear && calendarData.totalContributions) {
                setTotalContributions(calendarData.totalContributions);
            } else {
                setTotalContributions(yearTotal);
            }
        } catch (error) {
            console.error('Failed to load streak data:', error);
            setStreak(MOCK_STREAK);
            setCalendar(MOCK_CALENDAR.calendar);
            setTotalContributions(0);
        } finally {
            setLoading(false);
        }
    };

    const getStreakIntensity = (days) => {
        if (days >= 30) return 'text-red-500';
        if (days >= 14) return 'text-orange-500';
        if (days >= 7) return 'text-yellow-500';
        return 'text-[hsl(210,11%,50%)]';
    };

    const getFireAnimation = (days) => {
        if (days >= 7) return 'animate-pulse';
        return '';
    };

    const getContributionColor = (count, level) => {
        // Use GitHub's exact dark mode colors
        // level: 0=none, 1=first_quartile, 2=second_quartile, 3=third_quartile, 4=fourth_quartile
        if (level !== undefined) {
            switch (level) {
                case 0: return 'bg-[#161b22]'; // GitHub dark: no contributions
                case 1: return 'bg-[#0e4429]'; // GitHub dark: low
                case 2: return 'bg-[#006d32]'; // GitHub dark: medium-low
                case 3: return 'bg-[#26a641]'; // GitHub dark: medium-high
                case 4: return 'bg-[#39d353]'; // GitHub dark: high
                default: return 'bg-[#161b22]';
            }
        }
        // Fallback based on count
        if (count === 0) return 'bg-[#161b22]';
        if (count <= 2) return 'bg-[#0e4429]';
        if (count <= 4) return 'bg-[#006d32]';
        if (count <= 6) return 'bg-[#26a641]';
        return 'bg-[#39d353]';
    };

    // Generate last 52 weeks of calendar data
    const generateCalendarGrid = () => {
        const weeks = [];
        const today = new Date();
        // Map includes both contributions count and level if available
        const calendarMap = new Map(calendar.map(d => [d.date, {
            contributions: d.contributions,
            level: d.level
        }]));

        // Start from 52 weeks ago, Sunday
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 364 - startDate.getDay());

        for (let week = 0; week < 53; week++) {
            const days = [];
            for (let day = 0; day < 7; day++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + week * 7 + day);
                const dateStr = date.toISOString().split('T')[0];
                const dayData = calendarMap.get(dateStr) || { contributions: 0, level: 0 };

                if (date <= today) {
                    days.push({
                        date: dateStr,
                        contributions: dayData.contributions,
                        level: dayData.level,
                        display: date
                    });
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
            <div className="bg-[hsl(220,13%,8%)] rounded-xl p-4 border border-[hsl(220,13%,15%)]">
                <div className="flex items-center gap-3">
                    <div className="animate-pulse bg-[hsl(220,13%,12%)] rounded-full w-12 h-12"></div>
                    <div className="flex-1">
                        <div className="animate-pulse bg-[hsl(220,13%,12%)] rounded h-4 w-24 mb-2"></div>
                        <div className="animate-pulse bg-[hsl(220,13%,12%)] rounded h-3 w-16"></div>
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
        <div className="bg-gradient-to-r from-[hsl(220,13%,8%)] to-[hsl(25,80%,15%,0.2)] rounded-xl p-4 border border-orange-500/20">
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
                            <span className="text-[hsl(210,11%,50%)] text-sm">day streak</span>
                        </div>

                        {streak.is_active ? (
                            <p className="text-[hsl(142,70%,55%)] text-sm flex items-center gap-1">
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
                    <div className="flex items-center gap-1 text-[hsl(210,11%,50%)] text-sm">
                        <span>Longest:</span>
                        <span className="font-bold text-[hsl(210,11%,90%)]">{streak.longest_streak} days</span>
                    </div>
                    <div className="text-xs text-[hsl(210,11%,40%)] mt-1">
                        {streak.total_contribution_days} total active days
                    </div>
                </div>
            </div>

            {/* Contribution Calendar */}
            <div className="mt-4 pt-4 border-t border-[hsl(220,13%,15%)]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-[hsl(210,11%,90%)] font-medium">
                            {totalContributions} contributions in {selectedYear}
                        </span>
                    </div>

                    {/* Year Selector - GitHub style */}
                    <div className="relative">
                        <button
                            onClick={() => setShowYearDropdown(!showYearDropdown)}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-[hsl(210,11%,70%)] 
                                bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] rounded-md
                                hover:bg-[hsl(220,13%,15%)] hover:border-[hsl(220,13%,25%)] transition-colors"
                        >
                            {selectedYear}
                            <ChevronDown className="w-4 h-4" />
                        </button>

                        {showYearDropdown && (
                            <div className="absolute right-0 top-full mt-1 z-20 
                                bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,20%)] rounded-md shadow-lg
                                py-1 min-w-[100px]">
                                {YEARS.map(year => (
                                    <button
                                        key={year}
                                        onClick={() => {
                                            setSelectedYear(year);
                                            setShowYearDropdown(false);
                                        }}
                                        className={`block w-full text-left px-3 py-1.5 text-sm transition-colors
                                            ${year === selectedYear
                                                ? 'bg-[hsl(215,80%,50%)] text-white'
                                                : 'text-[hsl(210,11%,70%)] hover:bg-[hsl(220,13%,15%)]'
                                            }`}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="flex gap-[2px] min-w-max">
                        {calendarGrid.map((week, weekIdx) => (
                            <div key={weekIdx} className="flex flex-col gap-[2px]">
                                {week.map((day, dayIdx) => (
                                    <div
                                        key={dayIdx}
                                        className={`w-2.5 h-2.5 rounded-sm ${day ? getContributionColor(day.contributions, day.level) : 'bg-transparent'
                                            }`}
                                        title={day ? `${day.date}: ${day.contributions} contributions` : ''}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend - GitHub's exact dark mode colors */}
                <div className="flex items-center justify-end gap-2 mt-2">
                    <span className="text-xs text-[hsl(210,11%,40%)]">Less</span>
                    <div className="flex gap-[2px]">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#161b22]" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#0e4429]" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#006d32]" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#26a641]" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#39d353]" />
                    </div>
                    <span className="text-xs text-[hsl(210,11%,40%)]">More</span>
                </div>
            </div>

            {/* Progress to next milestone */}
            {streak.current_streak > 0 && streak.current_streak < 30 && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-[hsl(210,11%,50%)] mb-1">
                        <span>Progress to 30-day streak</span>
                        <span>{streak.current_streak}/30</span>
                    </div>
                    <div className="h-2 bg-[hsl(220,13%,12%)] rounded-full overflow-hidden">
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
