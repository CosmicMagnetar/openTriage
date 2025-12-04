import { useState } from 'react';
import { User, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../stores/authStore';

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
                // The router will automatically redirect based on the new role
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
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-200 mb-8">Settings</h1>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2">
                        <User className="w-5 h-5 text-emerald-500" />
                        Profile & Role
                    </h2>
                </div>

                <div className="p-6 space-y-8">
                    {/* User Info */}
                    <div className="flex items-center gap-4">
                        <img
                            src={user?.avatarUrl || 'https://github.com/ghost.png'}
                            alt={user?.username}
                            className="w-16 h-16 rounded-full border-2 border-slate-600"
                        />
                        <div>
                            <h3 className="text-lg font-medium text-slate-200">{user?.username}</h3>
                            <p className="text-slate-400">GitHub ID: {user?.githubId}</p>
                        </div>
                    </div>

                    {/* Role Switcher */}
                    <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-blue-500" />
                                    Current Role: <span className="text-blue-400">{role}</span>
                                </h3>
                                <p className="text-slate-400 mt-2 max-w-xl">
                                    Switching roles allows you to access different features of the platform.
                                    {role === 'MAINTAINER'
                                        ? " Switch to Contributor view to see your personal contribution metrics and find issues."
                                        : " Switch to Maintainer view to manage your repositories and triage issues."}
                                </p>
                            </div>

                            <button
                                onClick={handleRoleSwitch}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
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
