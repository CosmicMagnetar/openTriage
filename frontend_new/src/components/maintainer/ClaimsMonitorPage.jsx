import CookieLickingPanel from './CookieLickingPanel';
import { Cookie } from 'lucide-react';

const ClaimsMonitorPage = () => {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Cookie className="w-6 h-6 text-amber-400" />
                        <h1 className="text-2xl font-bold text-slate-200">Issue Claims Monitor</h1>
                    </div>
                    <span className="text-sm text-slate-400">Track claimed issues with no activity</span>
                </div>
                <CookieLickingPanel />
            </div>
        </div>
    );
};

export default ClaimsMonitorPage;
