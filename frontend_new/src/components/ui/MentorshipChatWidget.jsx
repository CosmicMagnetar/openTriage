import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Loader2, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { messagingApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const MentorshipChatWidget = ({ recipientId, recipientName, recipientAvatar, onClose }) => {
    const { user } = useAuthStore();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef(null);
    const pollIntervalRef = useRef(null);
    const lastMessageIdRef = useRef(null);

    useEffect(() => {
        loadHistory();
        startPolling();

        return () => stopPolling();
    }, [recipientId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadHistory = async () => {
        try {
            setLoading(true);
            const history = await messagingApi.getHistory(recipientId);
            setMessages(history);
            if (history.length > 0) {
                lastMessageIdRef.current = history[history.length - 1].id;
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
            toast.error('Failed to load chat history');
        } finally {
            setLoading(false);
        }
    };

    const startPolling = () => {
        stopPolling();
        pollIntervalRef.current = setInterval(async () => {
            try {
                const newMessages = await messagingApi.pollMessages(recipientId, lastMessageIdRef.current);
                if (newMessages && newMessages.length > 0) {
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
                        if (uniqueNew.length === 0) return prev;

                        lastMessageIdRef.current = uniqueNew[uniqueNew.length - 1].id;
                        return [...prev, ...uniqueNew];
                    });
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 2000);
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        const messageContent = newMessage.trim();
        const tempId = uuidv4();
        const optimisticMessage = {
            id: tempId,
            sender_id: user?.id,
            receiver_id: recipientId,
            content: messageContent,
            timestamp: new Date().toISOString(),
            pending: true,
        };

        // Optimistic update - add message immediately
        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');
        setSending(true);

        try {
            const sentMessage = await messagingApi.sendMessage(recipientId, messageContent);
            // Replace optimistic message with real message
            setMessages(prev => prev.map(msg =>
                msg.id === tempId ? { ...sentMessage, pending: false } : msg
            ));
            lastMessageIdRef.current = sentMessage.id;
        } catch (error) {
            console.error('Failed to send message:', error);
            // Remove optimistic message on failure
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
            setNewMessage(messageContent); // Restore message
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        try {
            await messagingApi.deleteMessage(messageId);
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
            toast.success('Message deleted');
        } catch (error) {
            console.error('Failed to delete message:', error);
            toast.error('Failed to delete message');
        }
    };

    // Dynamic sizing based on expanded state
    const widgetClasses = isExpanded
        ? "fixed bottom-4 right-4 w-[450px] h-[600px]"
        : "fixed bottom-4 right-20 w-96 h-[500px]";

    return (
        <div className={`${widgetClasses} bg-[hsl(220,13%,6%)] border border-[hsl(330,70%,50%,0.3)] rounded-xl shadow-2xl flex flex-col z-40 overflow-hidden transition-all duration-300`}>
            {/* Header with gradient accent */}
            <div className="bg-gradient-to-r from-[hsl(330,70%,45%,0.15)] to-[hsl(280,70%,45%,0.15)] p-4 border-b border-[hsl(330,70%,50%,0.2)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img
                            src={recipientAvatar || `https://github.com/${recipientName}.png`}
                            alt={recipientName}
                            className="w-10 h-10 rounded-full ring-2 ring-[hsl(330,70%,50%,0.4)] ring-offset-2 ring-offset-[hsl(220,13%,6%)]"
                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[hsl(142,70%,50%)] rounded-full border-2 border-[hsl(220,13%,6%)]"></span>
                    </div>
                    <div>
                        <h3 className="font-semibold text-[hsl(210,11%,95%)] text-sm">@{recipientName}</h3>
                        <p className="text-xs text-[hsl(330,70%,65%)] font-medium">Mentor • Online</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(330,70%,65%)] hover:bg-[hsl(330,70%,50%,0.1)] rounded-lg transition-colors"
                        title={isExpanded ? "Minimize" : "Expand"}
                    >
                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-[hsl(210,11%,50%)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[hsl(220,13%,5%)]">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-[hsl(210,11%,50%)] gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[hsl(330,70%,55%)]" />
                        <span className="text-sm">Loading messages...</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-[hsl(210,11%,40%)]">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[hsl(330,70%,50%,0.1)] flex items-center justify-center">
                            <MessageSquare className="w-7 h-7 text-[hsl(330,70%,55%)]" />
                        </div>
                        <p className="text-sm font-medium text-[hsl(210,11%,60%)]">No messages yet</p>
                        <p className="text-xs text-[hsl(210,11%,40%)] mt-1">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_id === user?.id || msg.sender_id === user?._id;
                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                            >
                                <div className={`relative flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''} max-w-[85%]`}>
                                    {/* Avatar for received messages */}
                                    {!isMe && (
                                        <img
                                            src={recipientAvatar || `https://github.com/${recipientName}.png`}
                                            alt={recipientName}
                                            className="w-6 h-6 rounded-full flex-shrink-0"
                                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                        />
                                    )}

                                    {/* Delete button - shows on hover for own messages */}
                                    {isMe && !msg.pending && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Delete this message?')) {
                                                    handleDeleteMessage(msg.id);
                                                }
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 bg-[hsl(220,13%,10%)] hover:bg-red-500/20 text-[hsl(210,11%,50%)] hover:text-red-400 rounded-md transition-all"
                                            title="Delete message"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}

                                    <div
                                        className={`rounded-2xl px-4 py-2.5 text-sm ${isMe
                                            ? 'bg-gradient-to-br from-[hsl(330,70%,45%)] to-[hsl(300,60%,40%)] text-white rounded-br-md'
                                            : 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,90%)] border border-[hsl(220,13%,20%)] rounded-bl-md'
                                            } ${msg.pending ? 'opacity-60' : ''}`}
                                    >
                                        <p className="leading-relaxed">{msg.content}</p>
                                        <p className={`text-[10px] mt-1.5 ${isMe ? 'text-white/60' : 'text-[hsl(210,11%,45%)]'}`}>
                                            {msg.pending ? 'Sending...' : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 bg-[hsl(220,13%,8%)] border-t border-[hsl(330,70%,50%,0.15)]">
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 min-w-0 bg-[hsl(220,13%,5%)] border border-[hsl(220,13%,20%)] rounded-xl px-4 py-3 text-sm text-[hsl(210,11%,90%)] focus:outline-none focus:border-[hsl(330,70%,50%)] focus:ring-2 focus:ring-[hsl(330,70%,50%,0.2)] placeholder-[hsl(210,11%,35%)] transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="flex-shrink-0 p-3 bg-gradient-to-r from-[hsl(330,70%,45%)] to-[hsl(300,60%,45%)] text-white rounded-xl hover:from-[hsl(330,70%,50%)] hover:to-[hsl(300,60%,50%)] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-[hsl(330,70%,40%,0.2)]"
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
                <p className="text-xs text-[hsl(210,11%,35%)] mt-2 text-center">Press Enter to send</p>
            </form>
        </div>
    );
};

export default MentorshipChatWidget;
