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
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-[hsl(210,11%,90%)] mb-8">Settings</h1>

            <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-xl overflow-hidden">
                <div className="p-6 border-b border-[hsl(220,13%,15%)]">
                    <h2 className="text-xl font-semibold text-[hsl(210,11%,90%)] flex items-center gap-2">
                        <User className="w-5 h-5 text-[hsl(142,70%,55%)]" />
                        Profile & Role
                    </h2>
                </div>

                <div className="p-6 space-y-8">
                    {/* User Info */}
                    <div className="flex items-center gap-4">
                        <img
                            src={user?.avatarUrl || 'https://github.com/ghost.png'}
                            alt={user?.username}
                            className="w-16 h-16 rounded-full border-2 border-[hsl(220,13%,20%)]"
                        />
                        <div>
                            <h3 className="text-lg font-medium text-[hsl(210,11%,90%)]">{user?.username}</h3>
                            <p className="text-[hsl(210,11%,50%)]">GitHub ID: {user?.githubId}</p>
                        </div>
                    </div>

                    {/* Role Switcher */}
                    <div className="bg-[hsl(220,13%,6%)] rounded-lg p-6 border border-[hsl(220,13%,15%)]">
                        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-medium text-[hsl(210,11%,90%)] flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-[hsl(217,91%,60%)]" />
                                    Current Role: <span className="text-[hsl(217,91%,65%)]">{role}</span>
                                </h3>
                                <p className="text-[hsl(210,11%,50%)] mt-2 max-w-xl">
                                    Switching roles allows you to access different features of the platform.
                                    {role === 'MAINTAINER'
                                        ? " Switch to Contributor view to see your personal contribution metrics and find issues."
                                        : " Switch to Maintainer view to manage your repositories and triage issues."}
                                </p>
                            </div>

                            <button
                                onClick={handleRoleSwitch}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-[hsl(217,91%,50%)] hover:bg-[hsl(217,91%,55%)] text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
