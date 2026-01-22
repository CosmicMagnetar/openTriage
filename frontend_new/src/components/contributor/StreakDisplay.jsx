import { useState, useEffect, useMemo } from 'react';
import { gamificationApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

// Generate years for selector (current and 4 previous for better historical view)
const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

const StreakDisplay = ({ selectedYear: propYear, onYearChange }) => {
    const { user } = useAuthStore();
    const [calendar, setCalendar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [internalYear, setInternalYear] = useState(propYear || currentYear);
    const [totalContributions, setTotalContributions] = useState(0);
    const [hoveredDay, setHoveredDay] = useState(null);

    // Use prop year if provided, otherwise internal state
    const selectedYear = propYear !== undefined ? propYear : internalYear;
    const setSelectedYear = (year) => {
        if (onYearChange) {
            onYearChange(year);
        } else {
            setInternalYear(year);
        }
    };

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
            const calendarData = await gamificationApi.getUserCalendar(user.username, 365, selectedYear);

            const yearData = calendarData.calendar || [];
            setCalendar(yearData);

            // Use totalContributions from API (this is year-specific from GitHub)
            setTotalContributions(calendarData.totalContributions ||
                yearData.reduce((sum, d) => sum + (d.contributions || d.total || 0), 0));
        } catch (error) {
            console.error('Failed to load calendar data:', error);
            setTotalContributions(0);
            setCalendar([]);
        } finally {
            setLoading(false);
        }
    };

    const getContributionColor = (level) => {
        switch (level) {
            case 0: return 'bg-[#161b22]';
            case 1: return 'bg-[#0e4429]';
            case 2: return 'bg-[#006d32]';
            case 3: return 'bg-[#26a641]';
            case 4: return 'bg-[#39d353]';
            default: return 'bg-[#161b22]';
        }
    };

    // Generate calendar grid for selected year
    const { weeks, monthPositions } = useMemo(() => {
        const calendarMap = new Map(calendar.map(d => [d.date, d]));
        const today = new Date();

        // Start from Jan 1 of selected year
        const startDate = new Date(selectedYear, 0, 1);
        const endDate = new Date(selectedYear, 11, 31);

        // Adjust to start from Sunday
        const firstDayOfWeek = startDate.getDay();
        const adjustedStart = new Date(startDate);
        adjustedStart.setDate(adjustedStart.getDate() - firstDayOfWeek);

        const weeksArr = [];
        const monthPos = [];
        let currentDate = new Date(adjustedStart);
        let lastMonth = -1;

        while (currentDate <= endDate || weeksArr.length < 53) {
            const week = [];

            // Track month changes for labels
            if (currentDate.getMonth() !== lastMonth && currentDate.getFullYear() === selectedYear) {
                monthPos.push({
                    name: currentDate.toLocaleDateString('en-US', { month: 'short' }),
                    weekIdx: weeksArr.length
                });
                lastMonth = currentDate.getMonth();
            }

            for (let day = 0; day < 7; day++) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const dayData = calendarMap.get(dateStr);
                const isInYear = currentDate.getFullYear() === selectedYear;
                const isFuture = currentDate > today;

                week.push({
                    date: dateStr,
                    contributions: dayData?.contributions || dayData?.total || 0,
                    level: dayData?.level || 0,
                    isInYear,
                    isFuture
                });

                currentDate.setDate(currentDate.getDate() + 1);
            }
            weeksArr.push(week);

            if (currentDate > endDate && currentDate.getDay() === 0) break;
        }

        return { weeks: weeksArr, monthPositions: monthPos };
    }, [calendar, selectedYear]);

    if (loading) {
        return (
            <div className="bg-[#0d1117] rounded-lg border border-[#30363d] p-4">
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#238636]"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#0d1117] rounded-lg border border-[#30363d] p-4">
            {/* Header: Total contributions */}
            <h2 className="text-base font-normal text-[#c9d1d9] mb-4">
                <span className="font-semibold">{totalContributions.toLocaleString()}</span> contributions in {selectedYear}
            </h2>

            {/* Main layout: Calendar + Year buttons */}
            <div className="flex gap-4">
                {/* Calendar section */}
                <div className="flex-1 overflow-x-auto border border-[#30363d] rounded-md p-3">
                    <div className="min-w-[700px]">
                        {/* Month labels */}
                        <div className="flex text-xs text-[#8b949e] mb-1 ml-[30px]">
                            {monthPositions.map((month, i) => (
                                <div
                                    key={i}
                                    style={{
                                        marginLeft: i === 0 ? `${month.weekIdx * 14}px` :
                                            `${(month.weekIdx - monthPositions[i - 1].weekIdx) * 14 - 20}px`
                                    }}
                                >
                                    {month.name}
                                </div>
                            ))}
                        </div>

                        {/* Grid with day labels */}
                        <div className="flex">
                            {/* Day labels */}
                            <div className="flex flex-col gap-[3px] mr-1 text-[10px] text-[#8b949e] w-[26px]">
                                <div className="h-[11px]"></div>
                                <div className="h-[11px] flex items-center">Mon</div>
                                <div className="h-[11px]"></div>
                                <div className="h-[11px] flex items-center">Wed</div>
                                <div className="h-[11px]"></div>
                                <div className="h-[11px] flex items-center">Fri</div>
                                <div className="h-[11px]"></div>
                            </div>

                            {/* Weeks grid */}
                            <div className="flex gap-[3px]">
                                {weeks.map((week, weekIdx) => (
                                    <div key={weekIdx} className="flex flex-col gap-[3px]">
                                        {week.map((day, dayIdx) => (
                                            <div
                                                key={`${weekIdx}-${dayIdx}`}
                                                className={`w-[11px] h-[11px] rounded-sm cursor-pointer transition-all
                                                    ${!day.isInYear ? 'bg-transparent' :
                                                        day.isFuture ? 'bg-[#161b22]' :
                                                            getContributionColor(day.level)}
                                                    ${hoveredDay?.date === day.date ? 'ring-1 ring-white' : ''}`}
                                                onMouseEnter={() => day.isInYear && !day.isFuture && setHoveredDay(day)}
                                                onMouseLeave={() => setHoveredDay(null)}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-end gap-1 mt-2 text-xs text-[#8b949e]">
                            <span>Less</span>
                            {[0, 1, 2, 3, 4].map(level => (
                                <div key={level} className={`w-[11px] h-[11px] rounded-sm ${getContributionColor(level)}`} />
                            ))}
                            <span>More</span>
                        </div>
                    </div>
                </div>

                {/* Year buttons - vertical stack on right */}
                <div className="flex flex-col gap-1">
                    {YEARS.map(year => (
                        <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`px-4 py-2 text-sm rounded-md transition-colors
                                ${selectedYear === year
                                    ? 'bg-[#238636] text-white font-medium'
                                    : 'text-[#8b949e] hover:bg-[#21262d]'
                                }`}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            </div>

            {/* Hover tooltip */}
            {hoveredDay && (
                <div className="mt-3 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-md text-sm inline-block">
                    <span className="font-medium text-[#c9d1d9]">{hoveredDay.contributions}</span>
                    <span className="text-[#8b949e]"> contribution{hoveredDay.contributions !== 1 ? 's' : ''} on </span>
                    <span className="text-[#c9d1d9]">{new Date(hoveredDay.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
            )}
        </div>
    );
};

export default StreakDisplay;
