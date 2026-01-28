import { useState, useEffect, useRef } from 'react';
import { Users, MessageSquare, Check, X, UserMinus, Send, Loader2, Sparkles, Bell, Pencil, Trash2 } from 'lucide-react';
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

    if (loading) {
        return (
            <div className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]">
                <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-[hsl(142,70%,55%)]" />
                    <h2 className="text-lg font-bold text-[hsl(210,11%,90%)]">Mentorship Dashboard</h2>
                </div>
                <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-[hsl(142,70%,55%)]" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[hsl(220,13%,8%)] rounded-xl border border-[hsl(220,13%,15%)] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[hsl(220,13%,15%)]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="w-6 h-6 text-[hsl(142,70%,55%)]" />
                        <div>
                            <h2 className="text-lg font-bold text-[hsl(210,11%,90%)]">Mentorship Dashboard</h2>
                            <p className="text-xs text-[hsl(210,11%,50%)]">Manage your mentees and conversations</p>
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
            <div className="flex border-b border-[hsl(220,13%,15%)]">
                {[
                    { id: 'conversations', label: 'Conversations', count: conversations.length },
                    { id: 'requests', label: 'Requests', count: requests.length },
                    { id: 'mentees', label: 'Mentees', count: mentees.length }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSelectedChat(null); }}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                            ? 'text-[hsl(142,70%,55%)] border-b-2 border-[hsl(142,70%,50%)] bg-[hsl(142,70%,50%,0.1)]'
                            : 'text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,80%)]'
                            }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 bg-[hsl(220,13%,15%)] rounded text-xs">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="flex h-[400px]">
                {/* Left Panel - List */}
                <div className="w-1/3 border-r border-[hsl(220,13%,15%)] overflow-y-auto">
                    {activeTab === 'conversations' && (
                        conversations.length > 0 ? (
                            conversations.map(conv => (
                                <button
                                    key={conv.user_id}
                                    onClick={() => setSelectedChat(conv)}
                                    className={`w-full p-3 flex items-center gap-3 hover:bg-[hsl(220,13%,12%)] transition-colors ${selectedChat?.user_id === conv.user_id ? 'bg-[hsl(220,13%,12%)]' : ''
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
                                            <span className="font-medium text-[hsl(210,11%,90%)] truncate">@{conv.username}</span>
                                            {conv.unread_count > 0 && (
                                                <span className="w-5 h-5 bg-[hsl(142,70%,50%)] text-white text-xs rounded-full flex items-center justify-center">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[hsl(210,11%,40%)] truncate">{conv.last_message}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-6 text-center text-[hsl(210,11%,50%)]">
                                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No conversations yet</p>
                            </div>
                        )
                    )}

                    {activeTab === 'requests' && (
                        requests.length > 0 ? (
                            requests.map(req => (
                                <div key={req.id} className="p-3 border-b border-[hsl(220,13%,15%)]">
                                    <div className="flex items-center gap-3 mb-2">
                                        <img
                                            src={req.mentee_avatar || `https://github.com/${req.mentee_username}.png`}
                                            alt={req.mentee_username}
                                            className="w-10 h-10 rounded-full"
                                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                        />
                                        <div className="flex-1">
                                            <span className="font-medium text-[hsl(210,11%,90%)]">@{req.mentee_username}</span>
                                            <p className="text-xs text-[hsl(210,11%,40%)]">{req.message || 'Wants to connect'}</p>
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
                            <div className="p-6 text-center text-[hsl(210,11%,50%)]">
                                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No pending requests</p>
                            </div>
                        )
                    )}

                    {activeTab === 'mentees' && (
                        mentees.length > 0 ? (
                            mentees.map(mentee => (
                                <div key={mentee.user_id} className="p-3 flex items-center gap-3 border-b border-[hsl(220,13%,15%)]">
                                    <img
                                        src={mentee.avatar_url || `https://github.com/${mentee.username}.png`}
                                        alt={mentee.username}
                                        className="w-10 h-10 rounded-full"
                                        onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium text-[hsl(210,11%,90%)]">@{mentee.username}</span>
                                        <p className="text-xs text-[hsl(210,11%,40%)]">Since {new Date(mentee.since).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setSelectedChat({ user_id: mentee.user_id, username: mentee.username, avatar_url: mentee.avatar_url })}
                                            className="p-2 text-[hsl(142,70%,55%)] hover:bg-[hsl(142,70%,50%,0.2)] rounded transition-colors"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleRemoveMentee(mentee.user_id)}
                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-[hsl(210,11%,50%)]">
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
                            <div className="p-3 border-b border-[hsl(220,13%,15%)] flex items-center gap-3">
                                <img
                                    src={selectedChat.avatar_url || `https://github.com/${selectedChat.username}.png`}
                                    alt={selectedChat.username}
                                    className="w-8 h-8 rounded-full"
                                    onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                />
                                <span className="font-medium text-[hsl(210,11%,90%)]">@{selectedChat.username}</span>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {chatLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-[hsl(142,70%,55%)]" />
                                    </div>
                                ) : chatMessages.length > 0 ? (
                                    chatMessages.map(msg => {
                                        const isMe = msg.sender_id === user?.id || msg.sender_id === user?.username;
                                        const isEditing = editingMessageId === msg.id;
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                                <div className={`relative flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                    {/* Edit/Delete buttons for own messages */}
                                                    {isMe && !isEditing && (
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => startEditing(msg)}
                                                                className="p-1.5 bg-[hsl(220,13%,12%)] hover:bg-[hsl(142,70%,50%,0.2)] text-[hsl(210,11%,50%)] hover:text-[hsl(142,70%,55%)] rounded-md transition-colors border border-[hsl(220,13%,18%)]"
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
                                                                className="p-1.5 bg-[hsl(220,13%,12%)] hover:bg-red-500/20 text-[hsl(210,11%,50%)] hover:text-red-400 rounded-md transition-colors border border-[hsl(220,13%,18%)]"
                                                                title="Delete message"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${isMe
                                                        ? 'bg-[hsl(142,70%,45%)] text-white rounded-br-none'
                                                        : 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,90%)] rounded-bl-none border border-[hsl(220,13%,18%)]'
                                                        }`}>
                                                        {isEditing ? (
                                                            <div className="space-y-2">
                                                                <input
                                                                    type="text"
                                                                    value={editContent}
                                                                    onChange={(e) => setEditContent(e.target.value)}
                                                                    className="w-full bg-[hsl(220,13%,15%)] text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(142,70%,50%)]"
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleEditMessage(msg.id);
                                                                        if (e.key === 'Escape') cancelEditing();
                                                                    }}
                                                                />
                                                                <div className="flex gap-1 justify-end">
                                                                    <button
                                                                        onClick={cancelEditing}
                                                                        className="p-1 hover:bg-[hsl(220,13%,20%)] rounded"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleEditMessage(msg.id)}
                                                                        className="p-1 hover:bg-[hsl(142,70%,45%,0.3)] rounded text-[hsl(142,70%,55%)]"
                                                                    >
                                                                        <Check className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {msg.content}
                                                                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-green-200' : 'text-[hsl(210,11%,40%)]'}`}>
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
                                    <div className="text-center text-[hsl(210,11%,50%)] py-8">
                                        <p>No messages yet. Start the conversation!</p>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <form onSubmit={handleSendMessage} className="p-3 border-t border-[hsl(220,13%,15%)] flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-[hsl(220,13%,5%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm text-[hsl(210,11%,90%)] placeholder-[hsl(210,11%,40%)] focus:outline-none focus:border-[hsl(142,70%,50%)]"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending}
                                    className="flex-shrink-0 p-2 bg-[hsl(142,70%,45%)] text-black rounded-lg hover:bg-[hsl(142,70%,50%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-[hsl(210,11%,50%)]">
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
