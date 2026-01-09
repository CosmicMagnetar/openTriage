import { useState } from 'react';
import { User, Shield, RefreshCw, Bell, Bot, Users, Eye, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../stores/authStore';

const Settings = () => {
    const { user, role, updateRole } = useAuthStore();
    const [loading, setLoading] = useState(false);

    // Settings state (would persist to backend in production)
    const [settings, setSettings] = useState({
        notifications: {
            email: true,
            push: false,
            issueUpdates: true,
            prUpdates: true,
            mentorshipMessages: true
        },
        ai: {
            enabled: true,
            autoSuggest: true,
            contextAwareness: true
        },
        mentorship: {
            available: false,
            maxMentees: 3,
            preferredTopics: []
        },
        privacy: {
            profileVisible: true,
            showActivity: true,
            showBadges: true
        }
    });

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

    const updateSetting = (category, key, value) => {
        setSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: value
            }
        }));
        toast.success('Setting updated');
    };

    return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto h-full overflow-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[hsl(210,11%,90%)]">Settings</h1>
                <p className="text-[hsl(210,11%,50%)] text-sm mt-1">Manage your preferences and account settings</p>
            </div>

            <div className="space-y-6">
                {/* Profile & Role */}
                <SettingsSection icon={User} title="Profile & Role">
                    <div className="flex items-center gap-4 mb-6">
                        <img
                            src={user?.avatarUrl || 'https://github.com/ghost.png'}
                            alt={user?.username}
                            className="w-14 h-14 rounded-full border-2 border-[hsl(220,13%,18%)]"
                        />
                        <div>
                            <h3 className="text-base font-medium text-[hsl(210,11%,90%)]">{user?.username}</h3>
                            <p className="text-sm text-[hsl(210,11%,50%)]">GitHub ID: {user?.githubId}</p>
                        </div>
                    </div>

                    <div className="bg-[hsl(220,13%,6%)] rounded-lg p-4 border border-[hsl(220,13%,12%)]">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-[hsl(210,11%,90%)]">
                                    <Shield className="w-4 h-4 text-[hsl(217,91%,60%)]" />
                                    <span className="font-medium">Current Role:</span>
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
                </SettingsSection>

                {/* Notifications */}
                <SettingsSection icon={Bell} title="Notifications">
                    <ToggleSetting
                        label="Email Notifications"
                        description="Receive updates via email"
                        checked={settings.notifications.email}
                        onChange={(v) => updateSetting('notifications', 'email', v)}
                    />
                    <ToggleSetting
                        label="Issue Updates"
                        description="Get notified when issues you're involved in are updated"
                        checked={settings.notifications.issueUpdates}
                        onChange={(v) => updateSetting('notifications', 'issueUpdates', v)}
                    />
                    <ToggleSetting
                        label="PR Updates"
                        description="Get notified about pull request activity"
                        checked={settings.notifications.prUpdates}
                        onChange={(v) => updateSetting('notifications', 'prUpdates', v)}
                    />
                    <ToggleSetting
                        label="Mentorship Messages"
                        description="Receive notifications for mentorship conversations"
                        checked={settings.notifications.mentorshipMessages}
                        onChange={(v) => updateSetting('notifications', 'mentorshipMessages', v)}
                    />
                </SettingsSection>

                {/* AI & Chat */}
                <SettingsSection icon={Bot} title="AI & Chat">
                    <ToggleSetting
                        label="AI Assistance"
                        description="Enable AI-powered suggestions and analysis"
                        checked={settings.ai.enabled}
                        onChange={(v) => updateSetting('ai', 'enabled', v)}
                    />
                    <ToggleSetting
                        label="Auto-Suggestions"
                        description="Show AI suggestions while typing messages"
                        checked={settings.ai.autoSuggest}
                        onChange={(v) => updateSetting('ai', 'autoSuggest', v)}
                    />
                    <ToggleSetting
                        label="Context Awareness"
                        description="Allow AI to use conversation context for better suggestions"
                        checked={settings.ai.contextAwareness}
                        onChange={(v) => updateSetting('ai', 'contextAwareness', v)}
                    />
                </SettingsSection>

                {/* Mentorship */}
                <SettingsSection icon={Users} title="Mentorship">
                    <ToggleSetting
                        label="Available as Mentor"
                        description="Allow other contributors to request mentorship from you"
                        checked={settings.mentorship.available}
                        onChange={(v) => updateSetting('mentorship', 'available', v)}
                    />
                    <div className="py-3 border-b border-[hsl(220,13%,12%)]">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm text-[hsl(210,11%,85%)]">Maximum Mentees</span>
                                <p className="text-xs text-[hsl(210,11%,45%)] mt-0.5">How many mentees you can take on</p>
                            </div>
                            <select
                                value={settings.mentorship.maxMentees}
                                onChange={(e) => updateSetting('mentorship', 'maxMentees', parseInt(e.target.value))}
                                className="bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-1.5 text-sm text-[hsl(210,11%,80%)] focus:outline-none focus:border-[hsl(142,70%,45%)]"
                            >
                                {[1, 2, 3, 5, 10].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </SettingsSection>

                {/* Privacy */}
                <SettingsSection icon={Eye} title="Privacy & Visibility">
                    <ToggleSetting
                        label="Public Profile"
                        description="Make your profile visible to other users"
                        checked={settings.privacy.profileVisible}
                        onChange={(v) => updateSetting('privacy', 'profileVisible', v)}
                    />
                    <ToggleSetting
                        label="Show Activity"
                        description="Display your contribution activity on your profile"
                        checked={settings.privacy.showActivity}
                        onChange={(v) => updateSetting('privacy', 'showActivity', v)}
                    />
                    <ToggleSetting
                        label="Show Badges"
                        description="Display earned badges on your profile"
                        checked={settings.privacy.showBadges}
                        onChange={(v) => updateSetting('privacy', 'showBadges', v)}
                    />
                </SettingsSection>
            </div>
        </div>
    );
};

const SettingsSection = ({ icon: Icon, title, children }) => (
    <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(220,13%,15%)] flex items-center gap-3">
            <Icon className="w-5 h-5 text-[hsl(142,70%,55%)]" />
            <h2 className="text-base font-semibold text-[hsl(210,11%,90%)]">{title}</h2>
        </div>
        <div className="px-5 py-2">
            {children}
        </div>
    </div>
);

const ToggleSetting = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-3 border-b border-[hsl(220,13%,12%)] last:border-0">
        <div>
            <span className="text-sm text-[hsl(210,11%,85%)]">{label}</span>
            {description && (
                <p className="text-xs text-[hsl(210,11%,45%)] mt-0.5">{description}</p>
            )}
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`relative w-11 h-6 rounded-full transition-colors ${checked
                    ? 'bg-[hsl(142,70%,45%)]'
                    : 'bg-[hsl(220,13%,20%)]'
                }`}
        >
            <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-6' : 'left-1'
                    }`}
            />
        </button>
    </div>
);

export default Settings;
