import HypeGenerator from './HypeGenerator';
import { Sparkles } from 'lucide-react';

const HypeGeneratorPage = () => {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-purple-400" />
                        <h1 className="text-2xl font-bold text-slate-200">Milestone Hype Generator</h1>
                    </div>
                    <span className="text-sm text-slate-400">Create shareable posts</span>
                </div>
                <HypeGenerator />
            </div>
        </div>
    );
};

export default HypeGeneratorPage;
