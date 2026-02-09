import { useState } from 'react';
import { User, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../stores/authStore';
import AISettingsPanel from './settings/AISettingsPanel';

const Settings = () => {
    const { user, role, updateRole } = useAuthStore();
    const [loading, setLoading] = useState(false);

    const handleRoleSwitch = async () => {
        setLoading(true);
        const newRole = role === 'MAINTAINER' ? 'CONTRIBUTOR' : 'MAINTAINER';

        try {
            const success = await updateRole(newRole);
            if (success) {
                toast.success(`Switched to ${newRole.toLowerCase()} view`);
            } else {
                toast.error('Failed to switch role');
            }
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto h-full overflow-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[hsl(210,11%,90%)]">Settings</h1>
                <p className="text-[hsl(210,11%,50%)] text-sm mt-1">Manage your account</p>
            </div>

            <div className="space-y-6">
                {/* Profile Section */}
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

                {/* AI Configuration - Bento Panel */}
                <AISettingsPanel />

                {/* Role Switching */}
                <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-[hsl(220,13%,15%)] flex items-center gap-3">
                        <Shield className="w-5 h-5 text-[hsl(142,70%,55%)]" />
                        <h2 className="text-base font-semibold text-[hsl(210,11%,90%)]">Role</h2>
                    </div>
                    <div className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-[hsl(210,11%,90%)]">
                                    <span className="font-medium">Current:</span>
                                    <span className="text-[hsl(217,91%,65%)]">{role}</span>
                                </div>
                                <p className="text-sm text-[hsl(210,11%,45%)] mt-1">
                                    {role === 'MAINTAINER'
                                        ? "Switch to Contributor to find issues and track contributions."
                                        : "Switch to Maintainer to manage repositories and triage issues."}
                                </p>
                            </div>
                            <button
                                onClick={handleRoleSwitch}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-[hsl(217,91%,50%)] hover:bg-[hsl(217,91%,55%)] text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                Switch to {role === 'MAINTAINER' ? 'Contributor' : 'Maintainer'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
