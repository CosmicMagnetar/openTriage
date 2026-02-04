import { useState, useEffect, useRef } from 'react';
import { Users, MessageSquare, Check, X, UserMinus, Send, Loader2, Sparkles, Bell, Pencil, Trash2, GraduationCap, Clock } from 'lucide-react';
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
            await messagingApi.acceptMentorship(requestId, "Hey! I've accepted your mentorship request. Looking forward to helping you on your open source journey! Feel free to reach out anytime.");
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
            <div className="bg-[hsl(220,13%,9%)] rounded-xl border border-[hsl(220,13%,18%)]">
                <div className="p-5 border-b border-[hsl(220,13%,18%)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[hsl(210,11%,93%)]">Mentorship Dashboard</h2>
                            <p className="text-xs text-[hsl(210,11%,50%)]">Guide and connect with your mentees</p>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[hsl(220,13%,9%)] rounded-xl border border-[hsl(220,13%,18%)] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-[hsl(220,13%,18%)]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <Users className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[hsl(210,11%,93%)]">Mentorship Dashboard</h2>
                            <p className="text-xs text-[hsl(210,11%,50%)]">Guide and connect with your mentees</p>
                        </div>
                    </div>
                    
                    {/* Stats Summary */}
                    <div className="flex items-center gap-4">
                        <div className="text-center px-3">
                            <p className="text-xl font-bold text-emerald-400">{mentees.length}</p>
                            <p className="text-[10px] text-[hsl(210,11%,50%)] uppercase tracking-wide">Mentees</p>
                        </div>
                        {requests.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <Bell className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-amber-400 font-medium text-sm">{requests.length} pending</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[hsl(220,13%,18%)]">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSelectedChat(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
                            activeTab === tab.id
                                ? 'text-emerald-400 bg-emerald-500/5'
                                : 'text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,12%)]'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                        {tab.count > 0 && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                tab.highlight 
                                    ? 'bg-amber-500/20 text-amber-400' 
                                    : 'bg-[hsl(220,13%,15%)] text-[hsl(210,11%,60%)]'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                        )}
                    </button>
                ))}
            </div>

            <div className="flex h-[420px]">
                {/* Left Panel - List */}
                <div className="w-72 border-r border-[hsl(220,13%,18%)] overflow-y-auto">
                    {activeTab === 'conversations' && (
                        conversations.length > 0 ? (
                            <div className="divide-y divide-[hsl(220,13%,15%)]">
                                {conversations.map(conv => (
                                    <button
                                        key={conv.user_id}
                                        onClick={() => setSelectedChat(conv)}
                                        className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                            selectedChat?.user_id === conv.user_id 
                                                ? 'bg-emerald-500/10 border-l-2 border-emerald-500' 
                                                : 'hover:bg-[hsl(220,13%,12%)] border-l-2 border-transparent'
                                        }`}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <img
                                                src={conv.avatar_url || `https://github.com/${conv.username}.png`}
                                                alt={conv.username}
                                                className="w-10 h-10 rounded-full"
                                                onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                            />
                                            {conv.unread_count > 0 && (
                                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <span className="font-medium text-sm text-[hsl(210,11%,90%)] truncate block">@{conv.username}</span>
                                            <p className="text-xs text-[hsl(210,11%,45%)] truncate">{conv.last_message || 'No messages yet'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center">
                                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-[hsl(210,11%,25%)]" />
                                <p className="text-sm text-[hsl(210,11%,50%)]">No conversations yet</p>
                                <p className="text-xs text-[hsl(210,11%,40%)] mt-1">Messages will appear here</p>
                            </div>
                        )
                    )}

                    {activeTab === 'requests' && (
                        requests.length > 0 ? (
                            <div className="p-2 space-y-2">
                                {requests.map(req => (
                                    <div key={req.id} className="bg-[hsl(220,13%,11%)] rounded-lg p-3 border border-[hsl(220,13%,18%)]">
                                        <div className="flex items-center gap-2.5 mb-2">
                                            <img
                                                src={req.mentee_avatar || `https://github.com/${req.mentee_username}.png`}
                                                alt={req.mentee_username}
                                                className="w-9 h-9 rounded-full"
                                                onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium text-sm text-[hsl(210,11%,90%)] block truncate">@{req.mentee_username}</span>
                                                <div className="flex items-center gap-1 text-[10px] text-[hsl(210,11%,45%)]">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {req.message && (
                                            <p className="text-xs text-[hsl(210,11%,55%)] bg-[hsl(220,13%,7%)] rounded p-2 mb-2 line-clamp-2">
                                                {req.message}
                                            </p>
                                        )}
                                        
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => handleAcceptRequest(req.id)}
                                                className="flex-1 py-1.5 bg-emerald-500/15 text-emerald-400 rounded text-xs font-medium hover:bg-emerald-500/25 flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Check className="w-3 h-3" /> Accept
                                            </button>
                                            <button
                                                onClick={() => handleDeclineRequest(req.id)}
                                                className="flex-1 py-1.5 bg-red-500/10 text-red-400 rounded text-xs font-medium hover:bg-red-500/20 flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <X className="w-3 h-3" /> Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center">
                                <Bell className="w-10 h-10 mx-auto mb-3 text-[hsl(210,11%,25%)]" />
                                <p className="text-sm text-[hsl(210,11%,50%)]">No pending requests</p>
                                <p className="text-xs text-[hsl(210,11%,40%)] mt-1">Requests will appear here</p>
                            </div>
                        )
                    )}

                    {activeTab === 'mentees' && (
                        mentees.length > 0 ? (
                            <div className="p-2 space-y-1.5">
                                {mentees.map(mentee => (
                                    <div key={mentee.user_id} className="bg-[hsl(220,13%,11%)] rounded-lg p-3 border border-[hsl(220,13%,18%)] hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-center gap-2.5">
                                            <img
                                                src={mentee.avatar_url || `https://github.com/${mentee.username}.png`}
                                                alt={mentee.username}
                                                className="w-9 h-9 rounded-full"
                                                onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium text-sm text-[hsl(210,11%,90%)] block truncate">@{mentee.username}</span>
                                                <div className="flex items-center gap-1 text-[10px] text-[hsl(210,11%,45%)]">
                                                    <GraduationCap className="w-2.5 h-2.5" />
                                                    <span>Since {new Date(mentee.since).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-0.5">
                                                <button
                                                    onClick={() => setSelectedChat({ user_id: mentee.user_id, username: mentee.username, avatar_url: mentee.avatar_url })}
                                                    className="p-1.5 text-emerald-400 hover:bg-emerald-500/15 rounded transition-colors"
                                                    title="Send message"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveMentee(mentee.user_id)}
                                                    className="p-1.5 text-red-400 hover:bg-red-500/15 rounded transition-colors"
                                                    title="End mentorship"
                                                >
                                                    <UserMinus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center">
                                <GraduationCap className="w-10 h-10 mx-auto mb-3 text-[hsl(210,11%,25%)]" />
                                <p className="text-sm text-[hsl(210,11%,50%)]">No active mentees</p>
                                <p className="text-xs text-[hsl(210,11%,40%)] mt-1">Accept requests to start</p>
                            </div>
                        )
                    )}
                </div>

                {/* Right Panel - Chat */}
                <div className="flex-1 flex flex-col bg-[hsl(220,13%,6%)]">
                    {selectedChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-3 border-b border-[hsl(220,13%,18%)] flex items-center gap-3 bg-[hsl(220,13%,9%)]">
                                <img
                                    src={selectedChat.avatar_url || `https://github.com/${selectedChat.username}.png`}
                                    alt={selectedChat.username}
                                    className="w-8 h-8 rounded-full"
                                    onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                />
                                <div>
                                    <span className="font-medium text-sm text-[hsl(210,11%,90%)]">@{selectedChat.username}</span>
                                    <span className="text-[10px] text-[hsl(210,11%,45%)] ml-2">Mentee</span>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                                {chatLoading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                                            <p className="text-xs text-[hsl(210,11%,45%)]">Loading messages...</p>
                                        </div>
                                    </div>
                                ) : chatMessages.length > 0 ? (
                                    chatMessages.map(msg => {
                                        // Debug: Compare sender_id with user.id
                                        const isMe = String(msg.sender_id) === String(user?.id);
                                        const isEditing = editingMessageId === msg.id;
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                                <div className={`relative flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                    {/* Edit/Delete buttons for own messages */}
                                                    {isMe && !isEditing && (
                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                                                            <button
                                                                onClick={() => startEditing(msg)}
                                                                className="p-1 bg-[hsl(220,13%,15%)] hover:bg-emerald-500/20 text-[hsl(210,11%,50%)] hover:text-emerald-400 rounded transition-colors"
                                                                title="Edit message"
                                                            >
                                                                <Pencil className="w-2.5 h-2.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('Delete this message?')) {
                                                                        handleDeleteMessage(msg.id);
                                                                    }
                                                                }}
                                                                className="p-1 bg-[hsl(220,13%,15%)] hover:bg-red-500/20 text-[hsl(210,11%,50%)] hover:text-red-400 rounded transition-colors"
                                                                title="Delete message"
                                                            >
                                                                <Trash2 className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${isMe
                                                        ? 'bg-emerald-600 text-white rounded-br-sm'
                                                        : 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,90%)] rounded-bl-sm border border-[hsl(220,13%,18%)]'
                                                        }`}>
                                                        {isEditing ? (
                                                            <div className="space-y-1.5">
                                                                <textarea
                                                                    value={editContent}
                                                                    onChange={(e) => setEditContent(e.target.value)}
                                                                    className="w-full bg-white/15 text-white px-2 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-white/30 resize-none min-w-[180px]"
                                                                    rows={2}
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            handleEditMessage(msg.id);
                                                                        }
                                                                        if (e.key === 'Escape') cancelEditing();
                                                                    }}
                                                                />
                                                                <div className="flex gap-1 justify-end">
                                                                    <button
                                                                        onClick={cancelEditing}
                                                                        className="px-2 py-0.5 text-xs bg-white/10 hover:bg-white/20 rounded flex items-center gap-1"
                                                                    >
                                                                        <X className="w-3 h-3" /> Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleEditMessage(msg.id)}
                                                                        className="px-2 py-0.5 text-xs bg-white/20 hover:bg-white/30 rounded flex items-center gap-1"
                                                                    >
                                                                        <Check className="w-3 h-3" /> Save
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p>{msg.content}</p>
                                                                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-emerald-200' : 'text-[hsl(210,11%,40%)]'}`}>
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
                                        <div className="w-12 h-12 mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                            <Sparkles className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <p className="text-sm text-[hsl(210,11%,60%)]">Start the conversation!</p>
                                        <p className="text-xs text-[hsl(210,11%,45%)] mt-1">Send a message to begin</p>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <form onSubmit={handleSendMessage} className="p-3 border-t border-[hsl(220,13%,18%)] bg-[hsl(220,13%,8%)]">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-[hsl(220,13%,11%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm text-[hsl(210,11%,90%)] placeholder-[hsl(210,11%,40%)] focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim() || sending}
                                        className="flex-shrink-0 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                    <MessageSquare className="w-7 h-7 text-emerald-400/50" />
                                </div>
                                <p className="text-sm text-[hsl(210,11%,60%)]">Select a conversation</p>
                                <p className="text-xs text-[hsl(210,11%,45%)] mt-1">Choose someone to chat</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MentorDashboardPanel;
