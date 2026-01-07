import ContributionCalendar from './ContributionCalendar';
import StreakDisplay from './StreakDisplay';

const ActivityPage = () => {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-slate-200">My Activity</h1>
                    <span className="text-sm text-slate-400">Your contribution history</span>
                </div>
                <StreakDisplay />
                <ContributionCalendar />
            </div>
        </div>
    );
};

export default ActivityPage;
