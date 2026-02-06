import { useState, useEffect } from 'react';
import axios from 'axios';
import DiscoveryEngine from './DiscoveryEngine';
import useAuthStore from '../../stores/authStore';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * DiscoveryPage - Main page for discovering good first issues
 */
const DiscoveryPage = () => {
    const { user } = useAuthStore();
    const [userLanguages, setUserLanguages] = useState([]);

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API}/profile/${user?.username}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const profile = res.data;

            const programmingLanguages = (profile.skills || []).filter(skill =>
                ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C', 'C++',
                    'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Haskell', 'Elixir',
                    'Clojure', 'R', 'Julia', 'Dart', 'Shell', 'Bash'].includes(skill)
            );

            setUserLanguages(programmingLanguages);
        } catch (err) {
            console.log('Could not load profile languages');
        }
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto">
                {/* Simple Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[hsl(210,11%,90%)]">
                        Discover
                    </h1>
                    <p className="text-sm text-[hsl(210,11%,50%)] mt-1">
                        Find beginner-friendly open source issues
                    </p>
                </div>

                {/* Discovery Engine */}
                <DiscoveryEngine userLanguages={userLanguages} />
            </div>
        </div>
    );
};

export default DiscoveryPage;
