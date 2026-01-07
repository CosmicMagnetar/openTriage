import InvisibleLaborDashboard from './InvisibleLaborDashboard';
import { Eye } from 'lucide-react';

const LaborDashboardPage = () => {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Eye className="w-6 h-6 text-amber-400" />
                        <h1 className="text-2xl font-bold text-slate-200">Invisible Labor Dashboard</h1>
                    </div>
                    <span className="text-sm text-slate-400">Track hidden contributions</span>
                </div>
                <InvisibleLaborDashboard />
            </div>
        </div>
    );
};

export default LaborDashboardPage;
