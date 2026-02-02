import { useState, useEffect } from 'react';
import axios from 'axios';
import { Compass, Sparkles, TrendingUp, BookOpen } from 'lucide-react';
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
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[hsl(210,11%,90%)] flex items-center gap-2">
                            <Compass className="w-6 h-6 text-[hsl(142,70%,55%)]" />
                            Discover Issues
                        </h1>
                        <p className="text-[hsl(210,11%,50%)] mt-1">
                            Find beginner-friendly issues to start contributing
                        </p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[hsl(220,13%,8%)] rounded-xl p-4 border border-[hsl(220,13%,15%)]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[hsl(142,70%,45%,0.15)] flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-[hsl(142,70%,55%)]" />
                            </div>
                            <div>
                                <p className="text-xs text-[hsl(210,11%,50%)]">Your Languages</p>
                                <p className="text-sm font-medium text-[hsl(210,11%,85%)]">
                                    {userLanguages.length > 0 
                                        ? userLanguages.slice(0, 3).join(', ')
                                        : 'Add skills to your profile'}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-[hsl(220,13%,8%)] rounded-xl p-4 border border-[hsl(220,13%,15%)]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[hsl(217,91%,60%,0.15)] flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-[hsl(217,91%,65%)]" />
                            </div>
                            <div>
                                <p className="text-xs text-[hsl(210,11%,50%)]">Tip</p>
                                <p className="text-sm font-medium text-[hsl(210,11%,85%)]">
                                    Start with "good first issue" labels
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-[hsl(220,13%,8%)] rounded-xl p-4 border border-[hsl(220,13%,15%)]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-xs text-[hsl(210,11%,50%)]">Getting Started</p>
                                <p className="text-sm font-medium text-[hsl(210,11%,85%)]">
                                    Read the CONTRIBUTING.md first
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Discovery Engine */}
                <DiscoveryEngine userLanguages={userLanguages} />

                {/* Help Section */}
                <div className="bg-gradient-to-r from-[hsl(142,70%,45%,0.1)] to-[hsl(217,91%,60%,0.1)] 
                    rounded-xl p-6 border border-[hsl(220,13%,15%)]">
                    <h3 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-3">
                        🚀 Tips for Your First Contribution
                    </h3>
                    <ul className="space-y-2 text-sm text-[hsl(210,11%,70%)]">
                        <li className="flex items-start gap-2">
                            <span className="text-[hsl(142,70%,55%)]">1.</span>
                            <span>Look for issues labeled "good first issue" or "beginner friendly"</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[hsl(142,70%,55%)]">2.</span>
                            <span>Read the project's README and CONTRIBUTING guide before starting</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[hsl(142,70%,55%)]">3.</span>
                            <span>Comment on the issue to claim it before starting work</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[hsl(142,70%,55%)]">4.</span>
                            <span>Don't hesitate to ask questions - maintainers are usually helpful!</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[hsl(142,70%,55%)]">5.</span>
                            <span>Start small - even documentation fixes count as contributions</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default DiscoveryPage;
