import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, ArrowLeft, Search } from 'lucide-react';
import { messagingApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';
import { AISuggestTextarea } from '../ui/AISuggestTextarea';

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
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(142,70%,55%)]" />
            </div>
        );
    }

    return (
        <div className="h-full flex">
            {/* Left Panel - Conversations List */}
            <div className={`w-80 border-r border-[hsl(220,13%,12%)] flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-[hsl(220,13%,15%)]">
                    <h1 className="text-xl font-bold text-[hsl(210,11%,90%)] mb-3">Messages</h1>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(210,11%,40%)]" />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg pl-10 pr-4 py-2 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,40%)] focus:outline-none focus:border-[hsl(217,91%,60%)]"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredConversations.length > 0 ? (
                        filteredConversations.map(conv => (
                            <button
                                key={conv.user_id}
                                onClick={() => setSelectedChat(conv)}
                                className={`w-full p-4 flex items-center gap-3 hover:bg-[hsl(220,13%,10%)] transition-colors border-b border-[hsl(220,13%,12%)] ${selectedChat?.user_id === conv.user_id ? 'bg-[hsl(220,13%,10%)]' : ''
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
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(217,91%,60%)] text-white text-xs rounded-full flex items-center justify-center">
                                            {conv.unread_count}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="font-medium text-[hsl(210,11%,90%)] truncate">@{conv.username}</div>
                                    <p className="text-sm text-[hsl(210,11%,40%)] truncate">{conv.last_message}</p>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="p-8 text-center text-[hsl(210,11%,40%)]">
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
                        <div className="p-4 border-b border-[hsl(220,13%,15%)] flex items-center gap-3 bg-[hsl(220,13%,8%)]">
                            <button
                                onClick={() => setSelectedChat(null)}
                                className="md:hidden p-2 text-[hsl(210,11%,50%)] hover:text-white"
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
                                <div className="font-bold text-[hsl(210,11%,90%)]">@{selectedChat.username}</div>
                                <div className="text-xs text-[hsl(210,11%,50%)]">Click to view profile</div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length > 0 ? (
                                messages.map(msg => {
                                    const isMe = msg.sender_id === user?.id || msg.sender_id === user?.username;
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe
                                                ? 'bg-[hsl(217,91%,50%)] text-white rounded-br-none'
                                                : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,90%)] rounded-bl-none border border-[hsl(220,13%,18%)]'
                                                }`}>
                                                <p>{msg.content}</p>
                                                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-[hsl(210,11%,40%)]'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center text-[hsl(210,11%,40%)] py-8">
                                    <p>No messages yet. Start the conversation!</p>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input with AI suggestions based on conversation history */}
                        <form onSubmit={handleSendMessage} className="p-4 pr-16 border-t border-[hsl(220,13%,15%)] bg-[hsl(220,13%,8%)]">
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <AISuggestTextarea
                                        value={newMessage}
                                        onChange={setNewMessage}
                                        contextType="direct_message"
                                        conversationHistory={messages.map(m => ({
                                            sender: m.sender_id === user?.userId ? 'user' : 'other',
                                            content: m.content
                                        }))}
                                        placeholder="Type a message..."
                                        disabled={sending}
                                        rows={1}
                                        className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2.5 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(220,13%,28%)] resize-none min-h-[40px] max-h-[120px]"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending}
                                    className="p-2.5 bg-[hsl(142,70%,45%)] text-black rounded-lg hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] transition-colors"
                                >
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-[hsl(210,11%,35%)] mt-1.5">AI suggests completions based on your conversation</p>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[hsl(210,11%,40%)]">
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
