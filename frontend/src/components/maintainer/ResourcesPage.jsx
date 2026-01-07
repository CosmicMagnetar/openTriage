import ResourceVaultPanel from './ResourceVaultPanel';
import { Archive } from 'lucide-react';

const ResourcesPage = () => {
    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Archive className="w-6 h-6 text-cyan-400" />
                        <h1 className="text-2xl font-bold text-slate-200">Resource Vault</h1>
                    </div>
                    <span className="text-sm text-slate-400">Saved links, snippets, and docs</span>
                </div>
                <ResourceVaultPanel />
            </div>
        </div>
    );
};

export default ResourcesPage;
