import { useState } from 'react';
import ContributionCalendar from './ContributionCalendar';
import StreakDisplay from './StreakDisplay';

const ActivityPage = () => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    return (
        <div className="h-full overflow-y-auto p-6 bg-[#010409]">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Contribution Calendar with year selector */}
                <StreakDisplay
                    selectedYear={selectedYear}
                    onYearChange={setSelectedYear}
                />

                {/* Contribution Activity Timeline */}
                <ContributionCalendar selectedYear={selectedYear} />
            </div>
        </div>
    );
};

export default ActivityPage;
