import { User } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import AISettingsPanel from './settings/AISettingsPanel';

/** Account + AI settings. Workspace switching lives in the sidebar. */
const Settings = () => {
    const { user } = useAuthStore();

    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto h-full overflow-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[hsl(210,11%,90%)]">Settings</h1>
                <p className="text-[hsl(210,11%,50%)] text-sm mt-1">Manage your account</p>
            </div>

            <div className="space-y-6">
                <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-[hsl(220,13%,15%)] flex items-center gap-3">
                        <User className="w-5 h-5 text-[hsl(142,70%,55%)]" />
                        <h2 className="text-base font-semibold text-[hsl(210,11%,90%)]">Profile</h2>
                    </div>
                    <div className="p-5">
                        <div className="flex items-center gap-4">
                            <img
                                src={user?.avatarUrl || 'https://github.com/ghost.png'}
                                alt={user?.username}
                                className="w-16 h-16 rounded-full border-2 border-[hsl(220,13%,18%)]"
                            />
                            <div>
                                <h3 className="text-lg font-medium text-[hsl(210,11%,90%)]">{user?.username}</h3>
                                <p className="text-sm text-[hsl(210,11%,50%)]">GitHub ID: {user?.githubId}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <AISettingsPanel />
            </div>
        </div>
    );
};

export default Settings;
