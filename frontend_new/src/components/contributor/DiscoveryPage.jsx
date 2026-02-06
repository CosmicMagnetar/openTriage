import { useState, useEffect } from 'react';
import axios from 'axios';
import { Compass, Sparkles, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import DiscoveryEngine from './DiscoveryEngine';
import useAuthStore from '../../stores/authStore';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * DiscoveryPage - Main page for discovering good first issues
 * Features live GitHub search filtered by user's preferred languages
 */
const DiscoveryPage = () => {
    const { user } = useAuthStore();
    const [userLanguages, setUserLanguages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTips, setShowTips] = useState(false);

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        try {
            // Fetch user profile to get their skills/languages
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API}/profile/${user?.username}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const profile = res.data;
            
            // Extract programming languages from skills
            const programmingLanguages = (profile.skills || []).filter(skill => 
                ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C', 'C++', 
                 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Haskell', 'Elixir', 
                 'Clojure', 'R', 'Julia', 'Dart', 'Shell', 'Bash'].includes(skill)
            );
            
            setUserLanguages(programmingLanguages);
        } catch (err) {
            console.log('Could not load profile languages');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-4">
                {/* Compact Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[hsl(142,70%,45%,0.15)] rounded-lg">
                            <Compass className="w-5 h-5 text-[hsl(142,70%,55%)]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-[hsl(210,11%,90%)]">
                                Discover Issues
                            </h1>
                            <p className="text-sm text-[hsl(210,11%,50%)]">
                                Find beginner-friendly issues to start contributing
                            </p>
                        </div>
                    </div>
                    
                    {/* Compact Language Tags */}
                    {userLanguages.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[hsl(142,70%,55%)]" />
                            <div className="flex gap-1">
                                {userLanguages.slice(0, 3).map(lang => (
                                    <span key={lang} className="px-2 py-0.5 text-xs bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] rounded-full">
                                        {lang}
                                    </span>
                                ))}
                                {userLanguages.length > 3 && (
                                    <span className="px-2 py-0.5 text-xs bg-[hsl(220,13%,15%)] text-[hsl(210,11%,50%)] rounded-full">
                                        +{userLanguages.length - 3}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Discovery Engine */}
                <DiscoveryEngine userLanguages={userLanguages} />

                {/* Collapsible Tips Section */}
                <div className="bg-[hsl(220,13%,8%)] rounded-xl border border-[hsl(220,13%,15%)] overflow-hidden">
                    <button
                        onClick={() => setShowTips(!showTips)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(220,13%,10%)] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-[hsl(45,93%,58%)]" />
                            <span className="text-sm font-medium text-[hsl(210,11%,75%)]">
                                Tips for Your First Contribution
                            </span>
                        </div>
                        {showTips ? (
                            <ChevronUp className="w-4 h-4 text-[hsl(210,11%,50%)]" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-[hsl(210,11%,50%)]" />
                        )}
                    </button>
                    
                    {showTips && (
                        <div className="px-4 pb-4">
                            <ul className="space-y-1.5 text-sm text-[hsl(210,11%,60%)]">
                                <li className="flex items-start gap-2">
                                    <span className="text-[hsl(142,70%,55%)] font-medium">1.</span>
                                    <span>Look for issues labeled "good first issue" or "beginner friendly"</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-[hsl(142,70%,55%)] font-medium">2.</span>
                                    <span>Read the project's README and CONTRIBUTING guide before starting</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-[hsl(142,70%,55%)] font-medium">3.</span>
                                    <span>Comment on the issue to claim it before starting work</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-[hsl(142,70%,55%)] font-medium">4.</span>
                                    <span>Don't hesitate to ask questions - maintainers are usually helpful!</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-[hsl(142,70%,55%)] font-medium">5.</span>
                                    <span>Start small - even documentation fixes count as contributions</span>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DiscoveryPage;

