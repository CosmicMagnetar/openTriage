import { useState, useEffect } from 'react';
import { User, Code, Clock, Save, CheckCircle, Users, Loader2 } from 'lucide-react';
import { mentorApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const SKILL_SUGGESTIONS = [
    'JavaScript', 'TypeScript', 'Python', 'React', 'Vue', 'Angular',
    'Node.js', 'Django', 'FastAPI', 'Ruby', 'Rails', 'Go', 'Rust',
    'Java', 'Kotlin', 'Swift', 'Docker', 'Kubernetes', 'AWS', 'MongoDB',
    'PostgreSQL', 'GraphQL', 'REST APIs', 'CI/CD', 'Testing'
];

const ProfileEditPage = () => {
    const { user } = useAuthStore();
    const [profile, setProfile] = useState({
        bio: '',
        tech_stack: [],
        availability_hours: 5,
        expertise_level: 'intermediate',
        is_active: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [newSkill, setNewSkill] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (user) loadProfile();
    }, [user]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const data = await mentorApi.getProfile(user.id);
            if (data) {
                setProfile({
                    bio: data.bio || '',
                    tech_stack: data.tech_stack || [],
                    availability_hours: data.availability_hours_per_week || 5,
                    expertise_level: data.expertise_level || 'intermediate',
                    is_active: data.is_active || false,
                });
            }
        } catch (error) {
            console.log('No existing profile found');
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        try {
            setSaving(true);
            await mentorApi.createProfile(user.id, user.username, {
                tech_stack: profile.tech_stack,
                availability_hours: profile.availability_hours,
                expertise_level: profile.expertise_level,
                bio: profile.bio,
                is_active: profile.is_active,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error('Failed to save profile:', error);
        } finally {
            setSaving(false);
        }
    };

    const addSkill = (skill) => {
        const normalizedSkill = skill.toLowerCase().trim();
        if (normalizedSkill && !profile.tech_stack.includes(normalizedSkill)) {
            setProfile(prev => ({
                ...prev,
                tech_stack: [...prev.tech_stack, normalizedSkill]
            }));
        }
        setNewSkill('');
        setShowSuggestions(false);
    };

    const removeSkill = (skill) => {
        setProfile(prev => ({
            ...prev,
            tech_stack: prev.tech_stack.filter(s => s !== skill)
        }));
    };

    const filteredSuggestions = SKILL_SUGGESTIONS.filter(
        s => s.toLowerCase().includes(newSkill.toLowerCase()) &&
            !profile.tech_stack.includes(s.toLowerCase())
    );

    if (loading) {
        return (
            <div className="h-full overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-200">Edit Profile</h1>
                        <p className="text-sm text-slate-400">Share your skills and become a mentor</p>
                    </div>
                    <button
                        onClick={saveProfile}
                        disabled={saving}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${saved
                            ? 'bg-emerald-500 text-white'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                            } disabled:opacity-50`}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            <CheckCircle className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {saved ? 'Saved!' : 'Save Profile'}
                    </button>
                </div>

                {/* Avatar and Name */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-center gap-4">
                        <img
                            src={user?.avatar_url || `https://github.com/${user?.username}.png`}
                            alt={user?.username}
                            className="w-16 h-16 rounded-full border-2 border-slate-600"
                        />
                        <div>
                            <h2 className="text-xl font-bold text-slate-200">{user?.name || user?.username}</h2>
                            <p className="text-slate-400">@{user?.username}</p>
                        </div>
                    </div>
                </div>

                {/* Bio */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-center gap-2 mb-4">
                        <User className="w-5 h-5 text-blue-400" />
                        <h3 className="font-semibold text-slate-200">About You</h3>
                    </div>
                    <textarea
                        value={profile.bio}
                        onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="Tell others about yourself, your experience, and what you enjoy working on..."
                        className="w-full h-24 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500"
                    />
                </div>

                {/* Skills */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-center gap-2 mb-4">
                        <Code className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-slate-200">Skills & Tech Stack</h3>
                    </div>

                    {/* Current Skills */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {profile.tech_stack.map(skill => (
                            <span
                                key={skill}
                                className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm flex items-center gap-2"
                            >
                                {skill}
                                <button
                                    onClick={() => removeSkill(skill)}
                                    className="text-purple-400/60 hover:text-purple-400"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        {profile.tech_stack.length === 0 && (
                            <span className="text-slate-500 text-sm">No skills added yet</span>
                        )}
                    </div>

                    {/* Add Skill */}
                    <div className="relative">
                        <input
                            type="text"
                            value={newSkill}
                            onChange={(e) => {
                                setNewSkill(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newSkill.trim()) {
                                    addSkill(newSkill);
                                }
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            placeholder="Add a skill (e.g., React, Python, Docker)"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                        {showSuggestions && newSkill && filteredSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                {filteredSuggestions.slice(0, 6).map(suggestion => (
                                    <button
                                        key={suggestion}
                                        onClick={() => addSkill(suggestion)}
                                        className="w-full text-left px-4 py-2 text-slate-200 hover:bg-slate-600 transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mentor Settings */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-semibold text-slate-200">Mentor Settings</h3>
                    </div>

                    {/* Available as Mentor Toggle */}
                    <div className="flex items-center justify-between mb-6 p-4 bg-slate-700/50 rounded-lg">
                        <div>
                            <p className="font-medium text-slate-200">Available as Mentor</p>
                            <p className="text-sm text-slate-400">Show up in mentor search for others</p>
                        </div>
                        <button
                            onClick={() => setProfile(prev => ({ ...prev, is_active: !prev.is_active }))}
                            className={`relative w-12 h-6 rounded-full transition-colors ${profile.is_active ? 'bg-emerald-500' : 'bg-slate-600'
                                }`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${profile.is_active ? 'left-7' : 'left-1'
                                }`} />
                        </button>
                    </div>

                    {/* Expertise Level */}
                    <div className="mb-4">
                        <label className="block text-sm text-slate-400 mb-2">Expertise Level</label>
                        <select
                            value={profile.expertise_level}
                            onChange={(e) => setProfile(prev => ({ ...prev, expertise_level: e.target.value }))}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                        >
                            <option value="beginner">Beginner (1-2 years)</option>
                            <option value="intermediate">Intermediate (3-5 years)</option>
                            <option value="advanced">Advanced (5-10 years)</option>
                            <option value="expert">Expert (10+ years)</option>
                        </select>
                    </div>

                    {/* Availability */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            <Clock className="w-4 h-4 inline mr-1" />
                            Hours available per week: {profile.availability_hours}
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={profile.availability_hours}
                            onChange={(e) => setProfile(prev => ({ ...prev, availability_hours: parseInt(e.target.value) }))}
                            className="w-full accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>1 hr</span>
                            <span>10 hrs</span>
                            <span>20 hrs</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileEditPage;
