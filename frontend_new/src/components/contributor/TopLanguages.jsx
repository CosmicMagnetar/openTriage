import { useState, useEffect } from 'react';
import { Code2, RefreshCw } from 'lucide-react';
import { profileApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

/**
 * TopLanguages Component
 * 
 * Displays the user's top programming languages from their GitHub repositories.
 */
const TopLanguages = () => {
    const { user } = useAuthStore();
    const [languages, setLanguages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadLanguages();
    }, [user]);

    const loadLanguages = async () => {
        if (!user?.username) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const data = await profileApi.getUserLanguages(user.username);
            setLanguages(data.languages || []);
            setError(null);
        } catch (err) {
            console.error('Failed to load languages:', err);
            setError('Failed to load languages');
            setLanguages([]);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Code2 className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-medium text-[hsl(210,11%,90%)]">Top Languages</h3>
                </div>
                <div className="flex justify-center py-4">
                    <div className="animate-spin w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full" />
                </div>
            </div>
        );
    }

    if (error || languages.length === 0) {
        return (
            <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-purple-400" />
                        <h3 className="text-sm font-medium text-[hsl(210,11%,90%)]">Top Languages</h3>
                    </div>
                    <button
                        onClick={loadLanguages}
                        className="p-1 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,70%)]"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-sm text-[hsl(210,11%,50%)]">
                    No language data available. Create repositories to see your languages.
                </p>
            </div>
        );
    }

    // Calculate total for progress bars
    const totalBytes = languages.reduce((sum, lang) => sum + lang.bytes, 0);

    return (
        <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-medium text-[hsl(210,11%,90%)]">Top Languages</h3>
                </div>
                <button
                    onClick={loadLanguages}
                    className="p-1 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,70%)]"
                    title="Refresh"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Language bars */}
            <div className="space-y-3">
                {languages.slice(0, 5).map((lang, index) => (
                    <div key={lang.language}>
                        <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: lang.color }}
                                />
                                <span className="text-[hsl(210,11%,85%)]">{lang.language}</span>
                            </div>
                            <span className="text-[hsl(210,11%,50%)]">{lang.percentage}%</span>
                        </div>
                        <div className="h-1.5 bg-[hsl(220,13%,12%)] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ 
                                    width: `${lang.percentage}%`,
                                    backgroundColor: lang.color
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Show more languages if available */}
            {languages.length > 5 && (
                <div className="mt-3 pt-3 border-t border-[hsl(220,13%,15%)]">
                    <div className="flex flex-wrap gap-2">
                        {languages.slice(5).map(lang => (
                            <span 
                                key={lang.language}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-[hsl(220,13%,12%)] rounded text-xs text-[hsl(210,11%,60%)]"
                            >
                                <div 
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: lang.color }}
                                />
                                {lang.language} ({lang.percentage}%)
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TopLanguages;
