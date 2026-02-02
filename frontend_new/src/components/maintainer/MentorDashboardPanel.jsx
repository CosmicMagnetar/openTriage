import { useState, useEffect, useRef } from 'react';
import { Users, MessageSquare, Check, X, UserMinus, Send, Loader2, Sparkles, Bell, Pencil, Trash2, GraduationCap, Clock, Heart } from 'lucide-react';
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
    const [chatLoading, setChatLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedChat) {
            loadChatHistory(selectedChat.user_id);
        }
    }, [selectedChat]);

    // Scroll to bottom when messages change or chat finishes loading
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [chatMessages, chatLoading]);

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
            // Clear existing messages and show loading state immediately
            setChatMessages([]);
            setChatLoading(true);
            const history = await messagingApi.getHistory(userId);
            setChatMessages(history || []);
            // Mark as read
            await messagingApi.markRead(userId);
        } catch (error) {
            console.error('Failed to load chat history:', error);
        } finally {
            setChatLoading(false);
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

        const messageContent = newMessage.trim();
        setNewMessage(''); // Clear input immediately for better UX

        try {
            setSending(true);
            const sent = await messagingApi.sendMessage(selectedChat.user_id, messageContent);
            // Ensure sender_id is correctly set using current user's ID
            const messageWithCorrectSender = {
                ...sent,
                sender_id: user?.id, // Always use current user's ID for sent messages
            };
            setChatMessages(prev => [...prev, messageWithCorrectSender]);
        } catch (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
            setNewMessage(messageContent); // Restore message on error
        } finally {
            setSending(false);
        }
    };

    const handleEditMessage = async (messageId) => {
        if (!editContent.trim()) return;
        try {
            await messagingApi.editMessage(messageId, editContent.trim());
            setChatMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, content: editContent.trim(), edited_at: new Date().toISOString() } : msg
            ));
            setEditingMessageId(null);
            setEditContent('');
            toast.success('Message updated');
        } catch (error) {
            console.error('Failed to edit message:', error);
            toast.error('Failed to edit message');
        }
    };

    const handleDeleteMessage = async (messageId) => {
        try {
            await messagingApi.deleteMessage(messageId);
            setChatMessages(prev => prev.filter(msg => msg.id !== messageId));
            toast.success('Message deleted');
        } catch (error) {
            console.error('Failed to delete message:', error);
            toast.error('Failed to delete message');
        }
    };

    const startEditing = (msg) => {
        setEditingMessageId(msg.id);
        setEditContent(msg.content);
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditContent('');
    };

    // Tab configuration
    const tabs = [
        { id: 'conversations', label: 'Messages', icon: MessageSquare, count: conversations.length },
        { id: 'requests', label: 'Requests', icon: Bell, count: requests.length, highlight: requests.length > 0 },
        { id: 'mentees', label: 'Mentees', icon: GraduationCap, count: mentees.length }
    ];

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-[hsl(220,13%,8%)] to-[hsl(220,13%,6%)] rounded-2xl border border-[hsl(220,13%,15%)] overflow-hidden">
                <div className="p-6 border-b border-[hsl(220,13%,15%)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-xl">
                            <Heart className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[hsl(210,11%,95%)]">Mentorship Dashboard</h2>
                            <p className="text-sm text-[hsl(210,11%,50%)]">Guide and connect with your mentees</p>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-pink-400" />
                        <p className="text-sm text-[hsl(210,11%,50%)]">Loading dashboard...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-[hsl(220,13%,8%)] to-[hsl(220,13%,6%)] rounded-2xl border border-[hsl(220,13%,15%)] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-[hsl(220,13%,15%)] bg-gradient-to-r from-pink-500/5 to-purple-500/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-xl border border-pink-500/20">
                            <Heart className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[hsl(210,11%,95%)]">Mentorship Dashboard</h2>
                            <p className="text-sm text-[hsl(210,11%,50%)]">Guide and connect with your mentees</p>
                        </div>
                    </div>
                    
                    {/* Stats Summary */}
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-pink-400">{mentees.length}</p>
                            <p className="text-xs text-[hsl(210,11%,50%)]">Active Mentees</p>
                        </div>
                        {requests.length > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
                                <span className="text-amber-400 font-semibold">{requests.length}</span>
                                <span className="text-amber-400/70 text-sm">pending</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[hsl(220,13%,15%)] bg-[hsl(220,13%,7%)]">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSelectedChat(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all duration-200 relative ${
                            activeTab === tab.id
                                ? 'text-pink-400 bg-pink-500/5'
                                : 'text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,80%)] hover:bg-[hsl(220,13%,10%)]'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                        {tab.count > 0 && (
                            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                tab.highlight 
                                    ? 'bg-amber-500/20 text-amber-400' 
                                    : 'bg-[hsl(220,13%,15%)] text-[hsl(210,11%,60%)]'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500" />
                        )}
                    </button>
                ))}
            </div>

            <div className="flex h-[450px]">
                {/* Left Panel - List */}
                <div className="w-80 border-r border-[hsl(220,13%,15%)] overflow-y-auto bg-[hsl(220,13%,6%)]">
                    {activeTab === 'conversations' && (
                        conversations.length > 0 ? (
                            <div className="divide-y divide-[hsl(220,13%,12%)]">
                                {conversations.map(conv => (
                                    <button
                                        key={conv.user_id}
                                        onClick={() => setSelectedChat(conv)}
                                        className={`w-full p-4 flex items-center gap-3 transition-all duration-150 ${
                                            selectedChat?.user_id === conv.user_id 
                                                ? 'bg-gradient-to-r from-pink-500/10 to-transparent border-l-2 border-pink-500' 
                                                : 'hover:bg-[hsl(220,13%,10%)]'
                                        }`}
                                    >
                                        <div className="relative">
                                            <img
                                                src={conv.avatar_url || `https://github.com/${conv.username}.png`}
                                                alt={conv.username}
                                                className="w-12 h-12 rounded-full ring-2 ring-[hsl(220,13%,15%)]"
                                                onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                            />
                                            {conv.unread_count > 0 && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <span className="font-semibold text-[hsl(210,11%,90%)] truncate block">@{conv.username}</span>
                                            <p className="text-xs text-[hsl(210,11%,45%)] truncate mt-0.5">{conv.last_message || 'No messages yet'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[hsl(220,13%,10%)] flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8 text-[hsl(210,11%,25%)]" />
                                </div>
                                <p className="text-[hsl(210,11%,50%)] font-medium">No conversations yet</p>
                                <p className="text-xs text-[hsl(210,11%,40%)] mt-1">Messages with mentees will appear here</p>
                            </div>
                        )
                    )}

                    {activeTab === 'requests' && (
                        requests.length > 0 ? (
                            <div className="p-3 space-y-3">
                                {requests.map(req => (
                                    <div key={req.id} className="bg-[hsl(220,13%,10%)] rounded-xl p-4 border border-[hsl(220,13%,18%)] hover:border-amber-500/30 transition-colors">
                                        <div className="flex items-center gap-3 mb-3">
                                            <img
                                                src={req.mentee_avatar || `https://github.com/${req.mentee_username}.png`}
                                                alt={req.mentee_username}
                                                className="w-12 h-12 rounded-full ring-2 ring-amber-500/20"
                                                onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-semibold text-[hsl(210,11%,90%)] block">@{req.mentee_username}</span>
                                                <div className="flex items-center gap-1 text-xs text-[hsl(210,11%,45%)] mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {req.message && (
                                            <p className="text-sm text-[hsl(210,11%,60%)] bg-[hsl(220,13%,8%)] rounded-lg p-3 mb-3 italic">
                                                "{req.message}"
                                            </p>
                                        )}
                                        
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAcceptRequest(req.id)}
                                                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 text-emerald-400 rounded-lg text-sm font-semibold hover:from-emerald-500/30 hover:to-emerald-600/30 flex items-center justify-center gap-2 transition-all border border-emerald-500/20"
                                            >
                                                <Check className="w-4 h-4" /> Accept
                                            </button>
                                            <button
                                                onClick={() => handleDeclineRequest(req.id)}
                                                className="flex-1 py-2.5 bg-red-500/10 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/20 flex items-center justify-center gap-2 transition-all border border-red-500/20"
                                            >
                                                <X className="w-4 h-4" /> Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[hsl(220,13%,10%)] flex items-center justify-center">
                                    <Bell className="w-8 h-8 text-[hsl(210,11%,25%)]" />
                                </div>
                                <p className="text-[hsl(210,11%,50%)] font-medium">No pending requests</p>
                                <p className="text-xs text-[hsl(210,11%,40%)] mt-1">New mentorship requests will appear here</p>
                            </div>
                        )
                    )}

                    {activeTab === 'mentees' && (
                        mentees.length > 0 ? (
                            <div className="p-3 space-y-2">
                                {mentees.map(mentee => (
                                    <div key={mentee.user_id} className="bg-[hsl(220,13%,10%)] rounded-xl p-4 border border-[hsl(220,13%,18%)] hover:border-pink-500/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={mentee.avatar_url || `https://github.com/${mentee.username}.png`}
                                                alt={mentee.username}
                                                className="w-12 h-12 rounded-full ring-2 ring-pink-500/20"
                                                onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-semibold text-[hsl(210,11%,90%)] block">@{mentee.username}</span>
                                                <div className="flex items-center gap-1 text-xs text-[hsl(210,11%,45%)] mt-0.5">
                                                    <GraduationCap className="w-3 h-3" />
                                                    <span>Since {new Date(mentee.since).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setSelectedChat({ user_id: mentee.user_id, username: mentee.username, avatar_url: mentee.avatar_url })}
                                                    className="p-2.5 text-pink-400 hover:bg-pink-500/20 rounded-lg transition-colors"
                                                    title="Send message"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveMentee(mentee.user_id)}
                                                    className="p-2.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                    title="End mentorship"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[hsl(220,13%,10%)] flex items-center justify-center">
                                    <GraduationCap className="w-8 h-8 text-[hsl(210,11%,25%)]" />
                                </div>
                                <p className="text-[hsl(210,11%,50%)] font-medium">No active mentees</p>
                                <p className="text-xs text-[hsl(210,11%,40%)] mt-1">Accept requests to start mentoring</p>
                            </div>
                        )
                    )}
                </div>

                {/* Right Panel - Chat */}
                <div className="flex-1 flex flex-col bg-[hsl(220,13%,5%)]">
                    {selectedChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-[hsl(220,13%,15%)] flex items-center gap-4 bg-gradient-to-r from-[hsl(220,13%,8%)] to-transparent">
                                <img
                                    src={selectedChat.avatar_url || `https://github.com/${selectedChat.username}.png`}
                                    alt={selectedChat.username}
                                    className="w-10 h-10 rounded-full ring-2 ring-pink-500/30"
                                    onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                />
                                <div>
                                    <span className="font-semibold text-[hsl(210,11%,90%)] block">@{selectedChat.username}</span>
                                    <span className="text-xs text-[hsl(210,11%,45%)]">Mentee</span>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {chatLoading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
                                            <p className="text-sm text-[hsl(210,11%,45%)]">Loading messages...</p>
                                        </div>
                                    </div>
                                ) : chatMessages.length > 0 ? (
                                    chatMessages.map(msg => {
                                        const isMe = msg.sender_id === user?.id || msg.sender_id === user?.username;
                                        const isEditing = editingMessageId === msg.id;
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                                <div className={`relative flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                    {/* Edit/Delete buttons for own messages */}
                                                    {isMe && !isEditing && (
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                                                            <button
                                                                onClick={() => startEditing(msg)}
                                                                className="p-1.5 bg-[hsl(220,13%,15%)] hover:bg-pink-500/20 text-[hsl(210,11%,50%)] hover:text-pink-400 rounded-lg transition-colors"
                                                                title="Edit message"
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('Delete this message?')) {
                                                                        handleDeleteMessage(msg.id);
                                                                    }
                                                                }}
                                                                className="p-1.5 bg-[hsl(220,13%,15%)] hover:bg-red-500/20 text-[hsl(210,11%,50%)] hover:text-red-400 rounded-lg transition-colors"
                                                                title="Delete message"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className={`max-w-[65%] rounded-2xl px-4 py-2.5 text-sm shadow-lg ${isMe
                                                        ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-br-md'
                                                        : 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,90%)] rounded-bl-md border border-[hsl(220,13%,18%)]'
                                                        }`}>
                                                        {isEditing ? (
                                                            <div className="space-y-2">
                                                                <input
                                                                    type="text"
                                                                    value={editContent}
                                                                    onChange={(e) => setEditContent(e.target.value)}
                                                                    className="w-full bg-white/10 text-white px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleEditMessage(msg.id);
                                                                        if (e.key === 'Escape') cancelEditing();
                                                                    }}
                                                                />
                                                                <div className="flex gap-1 justify-end">
                                                                    <button
                                                                        onClick={cancelEditing}
                                                                        className="p-1 hover:bg-white/20 rounded"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleEditMessage(msg.id)}
                                                                        className="p-1 hover:bg-white/20 rounded"
                                                                    >
                                                                        <Check className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p>{msg.content}</p>
                                                                <p className={`text-[10px] mt-1.5 text-right ${isMe ? 'text-pink-200' : 'text-[hsl(210,11%,40%)]'}`}>
                                                                    {msg.edited_at && <span className="mr-1">(edited)</span>}
                                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="w-16 h-16 mb-4 rounded-full bg-pink-500/10 flex items-center justify-center">
                                            <Sparkles className="w-8 h-8 text-pink-400" />
                                        </div>
                                        <p className="text-[hsl(210,11%,60%)] font-medium">Start the conversation!</p>
                                        <p className="text-xs text-[hsl(210,11%,45%)] mt-1">Send a message to begin mentoring</p>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <form onSubmit={handleSendMessage} className="p-4 border-t border-[hsl(220,13%,15%)] bg-[hsl(220,13%,7%)]">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-xl px-4 py-3 text-sm text-[hsl(210,11%,90%)] placeholder-[hsl(210,11%,40%)] focus:outline-none focus:border-pink-500/50 focus:ring-2 focus:ring-pink-500/20 transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim() || sending}
                                        className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl hover:from-pink-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-500/20 disabled:shadow-none"
                                    >
                                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 flex items-center justify-center">
                                    <MessageSquare className="w-10 h-10 text-pink-400/50" />
                                </div>
                                <p className="text-[hsl(210,11%,60%)] font-medium">Select a conversation</p>
                                <p className="text-sm text-[hsl(210,11%,45%)] mt-1">Choose someone from the list to chat</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MentorDashboardPanel;
