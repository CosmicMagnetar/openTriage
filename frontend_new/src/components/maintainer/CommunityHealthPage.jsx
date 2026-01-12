import SentimentAlerts from './SentimentAlerts';
import { ShieldAlert } from 'lucide-react';

const CommunityHealthPage = () => {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="w-6 h-6 text-red-400" />
                        <h1 className="text-2xl font-bold text-slate-200">Community Health</h1>
                    </div>
                    <span className="text-sm text-slate-400">Monitor sentiment and toxicity</span>
                </div>
                <SentimentAlerts />
            </div>
        </div>
    );
};

export default CommunityHealthPage;
