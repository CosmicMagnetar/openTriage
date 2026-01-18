import { useState, useEffect, useMemo } from 'react';
import { gamificationApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const ContributionCalendar = () => {
    const { user } = useAuthStore();
    const [calendarData, setCalendarData] = useState([]);
    const [totalContributions, setTotalContributions] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hoveredDay, setHoveredDay] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Available years (current and 2 previous)
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];

    useEffect(() => {
        loadCalendar();
    }, [user, selectedYear]);

    const loadCalendar = async () => {
        if (!user) return;

        try {
            setLoading(true);
            const data = await gamificationApi.getUserCalendar(user.username, 365);
            setCalendarData(data.calendar || []);
            setTotalContributions(data.totalContributions || 0);
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

    // Generate weeks for the selected year view
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
                contributions: dayData?.contributions || dayData?.total || 0,
                level: dayData?.level || 0,
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

    // Calculate total from data
    const calculatedTotal = useMemo(() => {
        return calendarData.reduce((sum, d) => sum + (d.contributions || d.total || 0), 0);
    }, [calendarData]);

    const displayTotal = totalContributions || calculatedTotal;

    const getLevelColor = (level, isFuture) => {
        if (isFuture) return 'bg-[#161b22]';

        switch (level) {
            case 4: return 'bg-[#39d353]';
            case 3: return 'bg-[#26a641]';
            case 2: return 'bg-[#006d32]';
            case 1: return 'bg-[#0e4429]';
            default: return 'bg-[#161b22]';
        }
    };

    const handleMouseEnter = (day, e) => {
        const rect = e.target.getBoundingClientRect();
        setTooltipPos({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
        });
        setHoveredDay(day);
    };

    if (loading) {
        return (
            <div className="bg-[#0d1117] rounded-lg p-4 border border-[#30363d]">
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#238636]"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#0d1117] rounded-lg p-4 border border-[#30363d]">
            {/* Header - GitHub style */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-normal text-[#c9d1d9]">
                    <span className="font-semibold">{displayTotal.toLocaleString()}</span> contributions in the last year
                </h2>

                {/* Year Selector Tabs */}
                <div className="flex gap-1">
                    {years.map(year => (
                        <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${selectedYear === year
                                ? 'bg-[#238636] text-white'
                                : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                                }`}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-x-auto">
                <div className="min-w-[750px]">
                    {/* Month labels */}
                    <div className="flex mb-1 ml-8">
                        {months.map((month, i) => (
                            <div
                                key={i}
                                className="text-xs text-[#8b949e]"
                                style={{ marginLeft: i === 0 ? 0 : `${(month.weekIndex - (months[i - 1]?.weekIndex || 0)) * 13 - 20}px` }}
                            >
                                {month.name}
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="flex">
                        {/* Day labels */}
                        <div className="flex flex-col gap-[3px] mr-2 text-xs text-[#8b949e]">
                            <div className="h-[11px]"></div>
                            <div className="h-[11px] flex items-center">Mon</div>
                            <div className="h-[11px]"></div>
                            <div className="h-[11px] flex items-center">Wed</div>
                            <div className="h-[11px]"></div>
                            <div className="h-[11px] flex items-center">Fri</div>
                            <div className="h-[11px]"></div>
                        </div>

                        {/* Weeks */}
                        <div className="flex gap-[3px]">
                            {weeks.map((week, weekIndex) => (
                                <div key={weekIndex} className="flex flex-col gap-[3px]">
                                    {week.map((day, dayIndex) => (
                                        <div
                                            key={`${weekIndex}-${dayIndex}`}
                                            className={`w-[11px] h-[11px] rounded-sm ${getLevelColor(day.level, day.isFuture)} 
                                                cursor-pointer transition-all hover:ring-1 hover:ring-[#8b949e]`}
                                            onMouseEnter={(e) => handleMouseEnter(day, e)}
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
                            <div
                                key={level}
                                className={`w-[11px] h-[11px] rounded-sm ${getLevelColor(level, false)}`}
                            />
                        ))}
                        <span>More</span>
                    </div>
                </div>
            </div>

            {/* Floating Tooltip - GitHub style */}
            {hoveredDay && (
                <div
                    className="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-[#24292f] rounded-md shadow-lg pointer-events-none"
                    style={{
                        left: tooltipPos.x,
                        top: tooltipPos.y,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <div className="whitespace-nowrap">
                        {hoveredDay.contributions > 0 ? (
                            <>
                                <span className="font-bold">{hoveredDay.contributions}</span> contribution{hoveredDay.contributions !== 1 ? 's' : ''} on {new Date(hoveredDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </>
                        ) : (
                            <>No contributions on {new Date(hoveredDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContributionCalendar;
