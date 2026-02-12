import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { gamificationApi, syncApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

// Generate years for selector (current and 4 previous for better historical view)
const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

const StreakDisplay = ({ selectedYear: propYear, onYearChange, username: propUsername, showSync = true }) => {
    const { user } = useAuthStore();
    const displayUsername = propUsername || user?.username;
    const [calendar, setCalendar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [internalYear, setInternalYear] = useState(propYear || currentYear);
    const [totalContributions, setTotalContributions] = useState(0);
    const [hoveredDay, setHoveredDay] = useState(null);
    const [needsSync, setNeedsSync] = useState(false);

    // Layer 2 Defense: useRef guard to prevent duplicate syncs
    // This ensures sync only triggers ONCE per session
    const syncInProgress = useRef(false);
    const hasTriggeredInitialSync = useRef(false);

    // Use prop year if provided, otherwise internal state
    const selectedYear = propYear !== undefined ? propYear : internalYear;
    const setSelectedYear = (year) => {
        if (onYearChange) {
            onYearChange(year);
        } else {
            setInternalYear(year);
        }
    };

    // Check if user needs initial data sync (only for own profile)
    const checkSyncStatus = useCallback(async () => {
        if (!displayUsername || !showSync) return;

        try {
            const data = await syncApi.getSyncStatus();
            setNeedsSync(data.needsSync);
            return data.needsSync;
        } catch (error) {
            console.error('Failed to check sync status:', error);
        }
        return false;
    }, [displayUsername, showSync]);

    // Load calendar data (must be declared before syncUserData which depends on it)
    const loadData = useCallback(async () => {
        if (!displayUsername) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const calendarData = await gamificationApi.getUserCalendar(displayUsername, 365, selectedYear);

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
    }, [displayUsername, selectedYear]);

    // Trigger data sync for new users (only for own profile)
    const syncUserData = useCallback(async () => {
        // Guard: Don't start if already syncing
        if (!displayUsername || syncInProgress.current || !showSync) {
            console.log('[StreakDisplay] Sync skipped:', {
                displayUsername: !!displayUsername,
                syncInProgress: syncInProgress.current,
                showSync
            });
            return;
        }

        try {
            // Set ref FIRST (before any async operations)
            syncInProgress.current = true;
            setSyncing(true);

            toast.info('Syncing your GitHub history...');
            console.log('[StreakDisplay] Starting sync for user:', displayUsername);

            const data = await syncApi.syncUserData();

            if (data.success) {
                console.log('[StreakDisplay] Sync completed:', data);
                toast.success(`Synced ${data.totalPRs} PRs and ${data.totalIssues} issues!`);
                setNeedsSync(false);
                // Reload calendar data after sync (stale-while-revalidate pattern)
                await loadData();
            } else {
                throw new Error(data.error || 'Sync failed');
            }
        } catch (error) {
            console.error('[StreakDisplay] Sync failed:', error);
            toast.error('Failed to sync your GitHub history. Please try again later.');
        } finally {
            // Always reset flags in finally block
            setSyncing(false);
            syncInProgress.current = false;
            console.log('[StreakDisplay] Sync completed, ref reset');
        }
    }, [displayUsername, showSync, loadData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Check sync status on mount (only for own profile)
    // CRITICAL: This only runs ONCE per mount using hasTriggeredInitialSync ref
    useEffect(() => {
        if (!showSync || hasTriggeredInitialSync.current) return;

        const initSync = async () => {
            if (displayUsername) {
                console.log('[StreakDisplay] Checking initial sync status for:', displayUsername);
                const shouldSync = await checkSyncStatus();
                if (shouldSync && !syncInProgress.current) {
                    console.log('[StreakDisplay] User needs sync, triggering initial sync');
                    hasTriggeredInitialSync.current = true; // Mark as triggered
                    syncUserData();
                }
            }
        };

        initSync();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayUsername, showSync]); // Removed checkSyncStatus and syncUserData to prevent re-triggers

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

    if (loading || syncing) {
        return (
            <div className="bg-[#0d1117] rounded-lg border border-[#30363d] p-4">
                <div className="flex justify-center items-center py-8 gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#238636]"></div>
                    {syncing && <span className="text-[#8b949e] text-sm">Syncing GitHub history...</span>}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#0d1117] rounded-lg border border-[#30363d] p-4">
            {/* Header: Total contributions with sync button */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-normal text-[#c9d1d9]">
                    <span className="font-semibold">{totalContributions.toLocaleString()}</span> contributions in {selectedYear}
                </h2>
                {showSync && (
                    <button
                        onClick={syncUserData}
                        disabled={syncing}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded-md transition-colors"
                        title="Sync GitHub history"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Refresh'}
                    </button>
                )}
            </div>

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
                                                className={`w-[11px] h-[11px] rounded-sm cursor-pointer heatmap-cell
                                                    ${!day.isInYear ? 'bg-transparent' :
                                                        day.isFuture ? 'bg-[#161b22]' :
                                                            getContributionColor(day.level)}
                                                    ${hoveredDay?.date === day.date ? 'ring-1 ring-white scale-125' : ''}`}
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
