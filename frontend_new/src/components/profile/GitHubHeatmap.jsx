import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

/**
 * GitHubHeatmap - Clean GitHub-style contribution graph
 */
const GitHubHeatmap = ({ data = [], totalContributions = 0 }) => {
    const CELL_SIZE = 10;
    const CELL_GAP = 3;
    const WEEKS = 53;
    const DAYS = 7;
    const MONTH_LABELS_HEIGHT = 18;
    const DAY_LABELS_WIDTH = 28;

    // GitHub's actual contribution colors
    const getColor = (value) => {
        if (value === 0) return '#161b22';
        if (value <= 3) return '#0e4429';
        if (value <= 6) return '#006d32';
        if (value <= 9) return '#26a641';
        return '#39d353';
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

                if (date > today) continue;

                const value = data[idx] || 0;

                result.push({
                    key: `${week}-${day}`,
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
    const svgHeight = MONTH_LABELS_HEIGHT + DAYS * (CELL_SIZE + CELL_GAP) + 5;

    return (
        <div className="w-full">
            <TooltipProvider delayDuration={0}>
                <svg
                    width="100%"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="overflow-visible"
                >
                    {/* Month Labels */}
                    {monthLabels.map((label, i) => (
                        <text
                            key={i}
                            x={label.x}
                            y={12}
                            fill="#7d8590"
                            fontSize="10"
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
                            fill="#7d8590"
                            fontSize="9"
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
                                    rx={2}
                                    fill={getColor(cell.value)}
                                    className="cursor-pointer outline-none"
                                    style={{
                                        outline: '1px solid rgba(27, 31, 35, 0.06)'
                                    }}
                                />
                            </TooltipTrigger>
                            <TooltipContent
                                side="top"
                                className="bg-[#1f2937] border-[#30363d] text-[#e6edf3]"
                            >
                                <p className="text-xs font-medium">
                                    {cell.value === 0 ? 'No' : cell.value} contribution{cell.value !== 1 ? 's' : ''} on {cell.date}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </svg>
            </TooltipProvider>

            {/* Legend */}
            <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#7d8590]">
                    {totalContributions.toLocaleString()} contributions in the last year
                </span>
                <div className="flex items-center gap-1 text-xs text-[#7d8590]">
                    <span>Less</span>
                    <div className="flex gap-[2px]">
                        {[0, 3, 6, 9, 12].map((level) => (
                            <div
                                key={level}
                                className="w-[10px] h-[10px] rounded-sm"
                                style={{ backgroundColor: getColor(level) }}
                            />
                        ))}
                    </div>
                    <span>More</span>
                </div>
            </div>
        </div>
    );
};

export default GitHubHeatmap;
