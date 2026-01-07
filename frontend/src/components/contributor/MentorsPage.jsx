import MentorMatchPanel from './MentorMatchPanel';
import { useState, useEffect } from 'react';
import { chatApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { MessageCircle, Clock, Users } from 'lucide-react';

const MentorsPage = () => {
    const { user } = useAuthStore();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, [user]);

    const loadSessions = async () => {
        if (!user) return;
        try {
            const data = await chatApi.getUserSessions(user.id, true);
            setSessions(data.sessions || []);
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-slate-200">Find a Mentor</h1>
                    <span className="text-sm text-slate-400">Connect with experienced contributors</span>
                </div>

                <MentorMatchPanel />

                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                        <MessageCircle className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-lg font-semibold text-slate-200">Active Sessions</h2>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400"></div>
                        </div>
                    ) : sessions.length > 0 ? (
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <div key={session.id} className="flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg">
                                    <Users className="w-5 h-5 text-slate-400" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-200">
                                            {session.topic || 'Mentorship Session'}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            with @{session.mentor_username}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <Clock className="w-3 h-3" />
                                        <span>{session.message_count} messages</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm text-center py-4">
                            No active sessions. Connect with a mentor above to start chatting.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MentorsPage;
