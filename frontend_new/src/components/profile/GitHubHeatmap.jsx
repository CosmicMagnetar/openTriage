import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

/**
 * GitHubHeatmap - A 2D SVG-based contribution heatmap similar to GitHub's
 * Enhanced with better colors and visual effects
 */
const GitHubHeatmap = ({ data = [], totalContributions = 0 }) => {
    const CELL_SIZE = 12;
    const CELL_GAP = 3;
    const WEEKS = 53;
    const DAYS = 7;
    const MONTH_LABELS_HEIGHT = 22;
    const DAY_LABELS_WIDTH = 32;

    // Generate dates for the past year
    const dateMap = useMemo(() => {
        const map = new Map();
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        oneYearAgo.setDate(oneYearAgo.getDate() - oneYearAgo.getDay()); // Start from Sunday

        // Map data array to dates
        for (let i = 0; i < WEEKS * DAYS; i++) {
            const date = new Date(oneYearAgo);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            map.set(dateStr, {
                date,
                value: data[i] || 0,
                dateStr
            });
        }
        return map;
    }, [data]);

    // Get color based on contribution level - Enhanced gradient
    const getColor = (value) => {
        if (value === 0) return 'hsl(220, 13%, 14%)';
        if (value <= 2) return 'hsl(142, 55%, 25%)';
        if (value <= 5) return 'hsl(142, 60%, 35%)';
        if (value <= 10) return 'hsl(142, 65%, 45%)';
        return 'hsl(142, 70%, 55%)'; // Bright green for high activity
    };
    
    // Get glow effect intensity based on value
    const getGlowOpacity = (value) => {
        if (value === 0) return 0;
        if (value <= 2) return 0.1;
        if (value <= 5) return 0.2;
        if (value <= 10) return 0.3;
        return 0.4;
    };

    // Generate month labels
    const monthLabels = useMemo(() => {
        const labels = [];
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        oneYearAgo.setDate(oneYearAgo.getDate() - oneYearAgo.getDay());

        let currentMonth = -1;
        for (let week = 0; week < WEEKS; week++) {
            const date = new Date(oneYearAgo);
            date.setDate(date.getDate() + week * 7);
            const month = date.getMonth();

            if (month !== currentMonth) {
                currentMonth = month;
                labels.push({
                    month: date.toLocaleDateString('en-US', { month: 'short' }),
                    x: DAY_LABELS_WIDTH + week * (CELL_SIZE + CELL_GAP)
                });
            }
        }
        return labels;
    }, []);

    // Day labels
    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

    // Generate grid cells
    const cells = useMemo(() => {
        const result = [];
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        oneYearAgo.setDate(oneYearAgo.getDate() - oneYearAgo.getDay());

        for (let week = 0; week < WEEKS; week++) {
            for (let day = 0; day < DAYS; day++) {
                const idx = week * 7 + day;
                const date = new Date(oneYearAgo);
                date.setDate(date.getDate() + idx);

                // Skip future dates
                if (date > today) continue;

                const value = data[idx] || 0;
                const dateStr = date.toISOString().split('T')[0];

                result.push({
                    key: dateStr,
                    x: DAY_LABELS_WIDTH + week * (CELL_SIZE + CELL_GAP),
                    y: MONTH_LABELS_HEIGHT + day * (CELL_SIZE + CELL_GAP),
                    value,
                    date: date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    })
                });
            }
        }
        return result;
    }, [data]);

    const svgWidth = DAY_LABELS_WIDTH + WEEKS * (CELL_SIZE + CELL_GAP);
    const svgHeight = MONTH_LABELS_HEIGHT + DAYS * (CELL_SIZE + CELL_GAP) + 10;

    return (
        <div className="w-full">
            <TooltipProvider delayDuration={0}>
                <svg
                    width="100%"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="overflow-visible"
                >
                    {/* Subtle glow filter for high activity cells */}
                    <defs>
                        <filter id="cellGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    
                    {/* Month Labels */}
                    {monthLabels.map((label, i) => (
                        <text
                            key={i}
                            x={label.x}
                            y={14}
                            className="fill-[hsl(210,11%,55%)] font-medium"
                            style={{ fontSize: '10px' }}
                        >
                            {label.month}
                        </text>
                    ))}

                    {/* Day Labels */}
                    {dayLabels.map((label, i) => (
                        <text
                            key={i}
                            x={0}
                            y={MONTH_LABELS_HEIGHT + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2}
                            className="fill-[hsl(210,11%,55%)] font-medium"
                            style={{ fontSize: '10px' }}
                        >
                            {label}
                        </text>
                    ))}

                    {/* Contribution Cells */}
                    {cells.map((cell) => (
                        <Tooltip key={cell.key}>
                            <TooltipTrigger asChild>
                                <rect
                                    x={cell.x}
                                    y={cell.y}
                                    width={CELL_SIZE}
                                    height={CELL_SIZE}
                                    rx={3}
                                    fill={getColor(cell.value)}
                                    className="cursor-pointer transition-all duration-200 hover:brightness-125"
                                    style={{
                                        filter: cell.value > 5 ? 'url(#cellGlow)' : 'none',
                                    }}
                                />
                            </TooltipTrigger>
                            <TooltipContent
                                side="top"
                                className="bg-[hsl(220,13%,8%)] border-[hsl(220,13%,20%)] text-[hsl(210,11%,95%)] shadow-xl"
                            >
                                <p className="text-sm font-semibold">
                                    {cell.value === 0 ? 'No' : cell.value} contribution{cell.value !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-[hsl(210,11%,50%)]">{cell.date}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </svg>
            </TooltipProvider>

            {/* Legend - Enhanced */}
            <div className="flex items-center justify-between mt-4 px-1">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-400">
                        🔥 {totalContributions.toLocaleString()}
                    </span>
                    <span className="text-xs text-[hsl(210,11%,50%)]">
                        contributions this year
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[hsl(210,11%,50%)]">
                    <span className="font-medium">Less</span>
                    <div className="flex gap-1">
                        {[0, 2, 5, 10, 15].map((level) => (
                            <div
                                key={level}
                                className="w-[11px] h-[11px] rounded-sm transition-transform hover:scale-110"
                                style={{ backgroundColor: getColor(level) }}
                            />
                        ))}
                    </div>
                    <span className="font-medium">More</span>
                </div>
            </div>
        </div>
    );
};

export default GitHubHeatmap;
