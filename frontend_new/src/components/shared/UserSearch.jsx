import { useState, useEffect, useRef } from 'react';
import { Search, User, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const UserSearch = ({ onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const navigate = useNavigate();
    const debounceRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
        
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowResults(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            setShowResults(false);
            return;
        }

        // Debounce search
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            searchUsers();
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query]);

    const searchUsers = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API}/user/search?q=${encodeURIComponent(query)}`);
            setResults(response.data.users || []);
            setShowResults(true);
        } catch (error) {
            console.error('Search error:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectUser = (username) => {
        setQuery('');
        setResults([]);
        setShowResults(false);
        if (onClose) onClose();
        navigate(`/dashboard/user/${username}`);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowResults(false);
            if (onClose) onClose();
        }
        if (e.key === 'Enter' && results.length > 0) {
            handleSelectUser(results[0].username);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(210,11%,40%)]" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => query.length >= 2 && setShowResults(true)}
                    placeholder="Search users by username..."
                    className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg pl-10 pr-10 py-2.5 text-sm
                        text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)] transition-colors"
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(210,11%,40%)] animate-spin" />
                )}
                {!loading && query && (
                    <button
                        onClick={() => { setQuery(''); setResults([]); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(210,11%,40%)] hover:text-[hsl(210,11%,60%)]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {showResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="px-4 py-6 text-center text-[hsl(210,11%,50%)] text-sm">
                            {query.length < 2 ? 'Type at least 2 characters to search' : 'No users found'}
                        </div>
                    ) : (
                        <div className="py-2">
                            {results.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => handleSelectUser(user.username)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[hsl(220,13%,12%)] transition-colors text-left"
                                >
                                    <img
                                        src={user.avatarUrl || `https://github.com/${user.username}.png`}
                                        alt={user.username}
                                        className="w-10 h-10 rounded-full border border-[hsl(220,13%,20%)]"
                                        onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[hsl(210,11%,90%)] truncate">
                                            @{user.username}
                                        </p>
                                        {user.role && (
                                            <span className={`text-xs ${
                                                user.role === 'MAINTAINER' 
                                                    ? 'text-purple-400'
                                                    : 'text-[hsl(142,70%,55%)]'
                                            }`}>
                                                {user.role}
                                            </span>
                                        )}
                                    </div>
                                    <User className="w-4 h-4 text-[hsl(210,11%,40%)]" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UserSearch;
