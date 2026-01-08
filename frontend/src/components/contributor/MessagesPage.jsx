import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, ArrowLeft, Search } from 'lucide-react';
import { messagingApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';

const MessagesPage = () => {
    const { user } = useAuthStore();
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        if (selectedChat) {
            loadChatHistory(selectedChat.user_id);
        }
    }, [selectedChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadConversations = async () => {
        try {
            setLoading(true);
            const data = await messagingApi.getConversations();
            setConversations(data.conversations || []);
        } catch (error) {
            console.error('Failed to load conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadChatHistory = async (userId) => {
        try {
            const history = await messagingApi.getHistory(userId);
            setMessages(history || []);
            await messagingApi.markRead(userId);
            // Update unread count in conversations list
            setConversations(prev =>
                prev.map(c => c.user_id === userId ? { ...c, unread_count: 0 } : c)
            );
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat || sending) return;

        try {
            setSending(true);
            const sent = await messagingApi.sendMessage(selectedChat.user_id, newMessage);
            setMessages(prev => [...prev, sent]);
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const filteredConversations = conversations.filter(c =>
        c.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && conversations.length === 0) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-900">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
        );
    }

    return (
        <div className="h-full flex bg-slate-900">
            {/* Left Panel - Conversations List */}
            <div className={`w-80 border-r border-slate-700 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-700">
                    <h1 className="text-xl font-bold text-slate-200 mb-3">Messages</h1>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredConversations.length > 0 ? (
                        filteredConversations.map(conv => (
                            <button
                                key={conv.user_id}
                                onClick={() => setSelectedChat(conv)}
                                className={`w-full p-4 flex items-center gap-3 hover:bg-slate-800/50 transition-colors border-b border-slate-700/50 ${selectedChat?.user_id === conv.user_id ? 'bg-slate-800' : ''
                                    }`}
                            >
                                <div className="relative">
                                    <img
                                        src={conv.avatar_url || `https://github.com/${conv.username}.png`}
                                        alt={conv.username}
                                        className="w-12 h-12 rounded-full"
                                        onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                    />
                                    {conv.unread_count > 0 && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                                            {conv.unread_count}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="font-medium text-slate-200 truncate">@{conv.username}</div>
                                    <p className="text-sm text-slate-500 truncate">{conv.last_message}</p>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No conversations yet</p>
                            <p className="text-sm mt-1">Start chatting with mentors from the Find a Mentor panel!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Chat */}
            <div className={`flex-1 flex flex-col ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {selectedChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-700 flex items-center gap-3 bg-slate-800">
                            <button
                                onClick={() => setSelectedChat(null)}
                                className="md:hidden p-2 text-slate-400 hover:text-white"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <img
                                src={selectedChat.avatar_url || `https://github.com/${selectedChat.username}.png`}
                                alt={selectedChat.username}
                                className="w-10 h-10 rounded-full"
                                onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                            />
                            <div>
                                <div className="font-bold text-slate-200">@{selectedChat.username}</div>
                                <div className="text-xs text-slate-400">Click to view profile</div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length > 0 ? (
                                messages.map(msg => {
                                    const isMe = msg.sender_id === user?.id;
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                                                }`}>
                                                <p>{msg.content}</p>
                                                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center text-slate-500 py-8">
                                    <p>No messages yet. Start the conversation!</p>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700 bg-slate-800">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-slate-900 border border-slate-600 rounded-full px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending}
                                    className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        <div className="text-center">
                            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p className="text-lg">Select a conversation</p>
                            <p className="text-sm mt-1">Choose from your messages on the left</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesPage;
