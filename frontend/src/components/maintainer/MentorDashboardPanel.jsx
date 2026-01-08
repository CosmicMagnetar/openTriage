import { useState, useEffect } from 'react';
import { Users, MessageSquare, Check, X, UserMinus, Send, Loader2, Sparkles, Bell } from 'lucide-react';
import { messagingApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';

const MentorDashboardPanel = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('conversations');
    const [conversations, setConversations] = useState([]);
    const [requests, setRequests] = useState([]);
    const [mentees, setMentees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedChat, setSelectedChat] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedChat) {
            loadChatHistory(selectedChat.user_id);
        }
    }, [selectedChat]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [convData, reqData, menteeData] = await Promise.all([
                messagingApi.getConversations(),
                messagingApi.getMentorshipRequests(),
                messagingApi.getMentees()
            ]);
            setConversations(convData.conversations || []);
            setRequests(reqData.requests || []);
            setMentees(menteeData.mentees || []);
        } catch (error) {
            console.error('Failed to load mentor dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadChatHistory = async (userId) => {
        try {
            const history = await messagingApi.getHistory(userId);
            setChatMessages(history || []);
            // Mark as read
            await messagingApi.markRead(userId);
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    };

    const handleAcceptRequest = async (requestId) => {
        try {
            await messagingApi.acceptMentorship(requestId, "Welcome! I'm excited to be your mentor. Feel free to ask me anything!");
            toast.success('Mentorship request accepted!');
            loadData();
        } catch (error) {
            console.error('Failed to accept request:', error);
            toast.error('Failed to accept request');
        }
    };

    const handleDeclineRequest = async (requestId) => {
        try {
            await messagingApi.declineMentorship(requestId);
            toast.success('Request declined');
            loadData();
        } catch (error) {
            console.error('Failed to decline request:', error);
            toast.error('Failed to decline request');
        }
    };

    const handleRemoveMentee = async (menteeId) => {
        if (!confirm('Are you sure you want to end this mentorship?')) return;
        try {
            await messagingApi.removeMentee(menteeId);
            toast.success('Mentorship ended');
            loadData();
        } catch (error) {
            console.error('Failed to remove mentee:', error);
            toast.error('Failed to end mentorship');
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat || sending) return;

        try {
            setSending(true);
            const sent = await messagingApi.sendMessage(selectedChat.user_id, newMessage);
            setChatMessages(prev => [...prev, sent]);
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-purple-400" />
                    <h2 className="text-lg font-bold text-slate-200">Mentorship Dashboard</h2>
                </div>
                <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="w-6 h-6 text-purple-400" />
                        <div>
                            <h2 className="text-lg font-bold text-slate-200">Mentorship Dashboard</h2>
                            <p className="text-xs text-slate-400">Manage your mentees and conversations</p>
                        </div>
                    </div>
                    {requests.length > 0 && (
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            {requests.length} pending
                        </span>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700">
                {[
                    { id: 'conversations', label: 'Conversations', count: conversations.length },
                    { id: 'requests', label: 'Requests', count: requests.length },
                    { id: 'mentees', label: 'Mentees', count: mentees.length }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSelectedChat(null); }}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                                ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-500/10'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 bg-slate-700 rounded text-xs">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="flex h-[400px]">
                {/* Left Panel - List */}
                <div className="w-1/3 border-r border-slate-700 overflow-y-auto">
                    {activeTab === 'conversations' && (
                        conversations.length > 0 ? (
                            conversations.map(conv => (
                                <button
                                    key={conv.user_id}
                                    onClick={() => setSelectedChat(conv)}
                                    className={`w-full p-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors ${selectedChat?.user_id === conv.user_id ? 'bg-slate-700/50' : ''
                                        }`}
                                >
                                    <img
                                        src={conv.avatar_url || `https://github.com/${conv.username}.png`}
                                        alt={conv.username}
                                        className="w-10 h-10 rounded-full"
                                        onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                    />
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-slate-200 truncate">@{conv.username}</span>
                                            {conv.unread_count > 0 && (
                                                <span className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">{conv.last_message}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-6 text-center text-slate-500">
                                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No conversations yet</p>
                            </div>
                        )
                    )}

                    {activeTab === 'requests' && (
                        requests.length > 0 ? (
                            requests.map(req => (
                                <div key={req.id} className="p-3 border-b border-slate-700">
                                    <div className="flex items-center gap-3 mb-2">
                                        <img
                                            src={req.mentee_avatar || `https://github.com/${req.mentee_username}.png`}
                                            alt={req.mentee_username}
                                            className="w-10 h-10 rounded-full"
                                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                        />
                                        <div className="flex-1">
                                            <span className="font-medium text-slate-200">@{req.mentee_username}</span>
                                            <p className="text-xs text-slate-500">{req.message || 'Wants to connect'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAcceptRequest(req.id)}
                                            className="flex-1 py-1.5 bg-emerald-500/20 text-emerald-400 rounded text-sm font-medium hover:bg-emerald-500/30 flex items-center justify-center gap-1"
                                        >
                                            <Check className="w-4 h-4" /> Accept
                                        </button>
                                        <button
                                            onClick={() => handleDeclineRequest(req.id)}
                                            className="flex-1 py-1.5 bg-red-500/20 text-red-400 rounded text-sm font-medium hover:bg-red-500/30 flex items-center justify-center gap-1"
                                        >
                                            <X className="w-4 h-4" /> Decline
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-slate-500">
                                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No pending requests</p>
                            </div>
                        )
                    )}

                    {activeTab === 'mentees' && (
                        mentees.length > 0 ? (
                            mentees.map(mentee => (
                                <div key={mentee.user_id} className="p-3 flex items-center gap-3 border-b border-slate-700">
                                    <img
                                        src={mentee.avatar_url || `https://github.com/${mentee.username}.png`}
                                        alt={mentee.username}
                                        className="w-10 h-10 rounded-full"
                                        onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium text-slate-200">@{mentee.username}</span>
                                        <p className="text-xs text-slate-500">Since {new Date(mentee.since).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setSelectedChat({ user_id: mentee.user_id, username: mentee.username, avatar_url: mentee.avatar_url })}
                                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleRemoveMentee(mentee.user_id)}
                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded"
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-slate-500">
                                <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No active mentees</p>
                            </div>
                        )
                    )}
                </div>

                {/* Right Panel - Chat */}
                <div className="flex-1 flex flex-col">
                    {selectedChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-3 border-b border-slate-700 flex items-center gap-3">
                                <img
                                    src={selectedChat.avatar_url || `https://github.com/${selectedChat.username}.png`}
                                    alt={selectedChat.username}
                                    className="w-8 h-8 rounded-full"
                                    onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                />
                                <span className="font-medium text-slate-200">@{selectedChat.username}</span>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {chatMessages.length > 0 ? (
                                    chatMessages.map(msg => {
                                        const isMe = msg.sender_id === user?.id;
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${isMe
                                                        ? 'bg-purple-600 text-white rounded-br-none'
                                                        : 'bg-slate-700 text-slate-200 rounded-bl-none'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center text-slate-500 py-8">
                                        <p>No messages yet. Start the conversation!</p>
                                    </div>
                                )}
                            </div>

                            {/* Input */}
                            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-700 flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending}
                                    className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-500">
                            <div className="text-center">
                                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Select a conversation to start chatting</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MentorDashboardPanel;
