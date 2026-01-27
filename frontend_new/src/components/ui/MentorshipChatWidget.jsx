import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Loader2, Trash2 } from 'lucide-react';
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

    return (
        <div className="fixed bottom-4 right-20 w-80 h-[450px] bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg shadow-xl flex flex-col z-40 overflow-hidden">
            {/* Header */}
            <div className="bg-[hsl(220,13%,10%)] p-3 border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img
                            src={recipientAvatar || `https://github.com/${recipientName}.png`}
                            alt={recipientName}
                            className="w-8 h-8 rounded-full"
                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[hsl(142,70%,50%)] rounded-full border-2 border-[hsl(220,13%,10%)]"></span>
                    </div>
                    <div>
                        <h3 className="font-medium text-[hsl(210,11%,90%)] text-sm">{recipientName}</h3>
                        <p className="text-xs text-[hsl(210,11%,50%)]">Mentor</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,15%)] rounded transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-[hsl(210,11%,50%)] gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading...</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-6 text-[hsl(210,11%,40%)]">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No messages yet</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_id === user?.id || msg.sender_id === user?._id;
                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                            >
                                <div className={`relative flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                                    {/* Delete button - shows on hover for own messages */}
                                    {isMe && !msg.pending && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Delete this message?')) {
                                                    handleDeleteMessage(msg.id);
                                                }
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 bg-[hsl(220,13%,12%)] hover:bg-red-500/20 text-[hsl(210,11%,50%)] hover:text-red-400 rounded-md transition-all border border-[hsl(220,13%,18%)]"
                                            title="Delete message"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <div
                                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isMe
                                            ? 'bg-[hsl(217,91%,50%)] text-white'
                                            : 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,85%)] border border-[hsl(220,13%,18%)]'
                                            } ${msg.pending ? 'opacity-70' : ''}`}
                                    >
                                        {msg.content}
                                        <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-[hsl(210,11%,40%)]'}`}>
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

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-3 bg-[hsl(220,13%,10%)] border-t border-[hsl(220,13%,15%)]">
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 min-w-0 bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,18%)] rounded-md px-3 py-2 text-sm text-[hsl(210,11%,85%)] focus:outline-none focus:border-[hsl(217,91%,60%)] placeholder-[hsl(210,11%,35%)]"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="flex-shrink-0 p-2 bg-[hsl(217,91%,50%)] text-white rounded-md hover:bg-[hsl(217,91%,55%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default MentorshipChatWidget;
