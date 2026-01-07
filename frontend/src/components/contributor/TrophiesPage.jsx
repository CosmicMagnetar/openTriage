import TrophyCabinet from './TrophyCabinet';
import StreakDisplay from './StreakDisplay';

const TrophiesPage = () => {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-slate-200">My Achievements</h1>
                    <span className="text-sm text-slate-400">Track your open source journey</span>
                </div>
                <StreakDisplay />
                <TrophyCabinet />
            </div>
        </div>
    );
};

export default TrophiesPage;
