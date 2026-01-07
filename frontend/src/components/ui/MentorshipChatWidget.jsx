import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Loader2, Sparkles } from 'lucide-react';
import { messagingApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';

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
                        // Avoid duplicates just in case
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
        }, 2000); // Poll every 2 seconds for "freely possible" real-time
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        try {
            setSending(true);
            const sentMessage = await messagingApi.sendMessage(recipientId, newMessage);

            // Add immediately to UI
            setMessages(prev => [...prev, sentMessage]);
            lastMessageIdRef.current = sentMessage.id;
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img
                            src={recipientAvatar || `https://github.com/${recipientName}.png`}
                            alt={recipientName}
                            className="w-10 h-10 rounded-full border border-slate-600"
                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-800"></span>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-200">{recipientName}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            Mentor
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/95">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-slate-500 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading chat...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>No messages yet.</p>
                        <p className="text-sm">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_id === user?.id || msg.sender_id === user?._id; // Handle both id formats if inconsistent
                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                                        }`}
                                >
                                    {msg.content}
                                    <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-slate-800 border-t border-slate-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-500"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default MentorshipChatWidget;
