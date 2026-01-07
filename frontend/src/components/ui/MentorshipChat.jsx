import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, X, Users, Clock, FileCode, Sparkles, Loader2 } from 'lucide-react';
import { chatApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const MentorshipChat = ({ sessionId, onClose }) => {
    const { user } = useAuthStore();
    const [session, setSession] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);

    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        loadSession();
        connectWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [sessionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadSession = async () => {
        try {
            setLoading(true);
            const [sessionData, historyData] = await Promise.all([
                chatApi.getSession(sessionId),
                chatApi.getChatHistory(sessionId, 100)
            ]);

            setSession(sessionData);
            setMessages(historyData.messages || []);
        } catch (error) {
            console.error('Failed to load session:', error);
        } finally {
            setLoading(false);
        }
    };

    const connectWebSocket = useCallback(() => {
        const wsUrl = chatApi.getWebSocketUrl(sessionId, user?.id || 'anonymous');

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
            setConnected(true);
            console.log('WebSocket connected');
        };

        wsRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'message') {
                setMessages(prev => [...prev, data.message]);
            } else if (data.type === 'history') {
                setMessages(data.messages || []);
            } else if (data.type === 'typing') {
                if (data.user_id !== user?.id) {
                    setTypingUsers(prev =>
                        prev.includes(data.user_id) ? prev : [...prev, data.user_id]
                    );
                    setTimeout(() => {
                        setTypingUsers(prev => prev.filter(id => id !== data.user_id));
                    }, 3000);
                }
            }
        };

        wsRef.current.onclose = () => {
            setConnected(false);
            console.log('WebSocket disconnected');
            // Attempt to reconnect after 3 seconds
            setTimeout(connectWebSocket, 3000);
        };

        wsRef.current.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }, [sessionId, user?.id]);

    const sendMessage = async () => {
        if (!input.trim() || sending) return;

        setSending(true);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message',
                content: input,
                username: user?.username || 'Anonymous',
                message_type: 'text'
            }));
            setInput('');
            setSending(false);
        } else {
            // Fallback to HTTP
            try {
                await chatApi.sendMessage(sessionId, user?.id, user?.username, {
                    content: input,
                    message_type: 'text'
                });
                setInput('');
                await loadSession();
            } catch (error) {
                console.error('Failed to send message:', error);
            } finally {
                setSending(false);
            }
        }
    };

    const handleTyping = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            // Debounce typing indicator
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            wsRef.current.send(JSON.stringify({ type: 'typing' }));

            typingTimeoutRef.current = setTimeout(() => {
                // Clear typing after 3 seconds of no input
            }, 3000);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-slate-800 rounded-2xl p-8 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
                    <p className="text-slate-300">Loading chat...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-slate-800 rounded-2xl shadow-2xl 
                   border border-slate-700 flex flex-col z-50">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-b border-slate-700 
                     flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 
                         flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-200">
                            Mentorship Session
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <span>{connected ? 'Connected' : 'Reconnecting...'}</span>
                            {session?.topic && (
                                <>
                                    <span>•</span>
                                    <span>{session.topic}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Participants Bar */}
            {session && (
                <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-700 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Mentor:</span>
                        <img
                            src={`https://github.com/${session.mentor_username}.png`}
                            alt={session.mentor_username}
                            className="w-6 h-6 rounded-full"
                        />
                        <span className="text-sm text-indigo-400">@{session.mentor_username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Mentee:</span>
                        {session.mentee_usernames?.map((username, i) => (
                            <div key={i} className="flex items-center gap-1">
                                <img
                                    src={`https://github.com/${username}.png`}
                                    alt={username}
                                    className="w-6 h-6 rounded-full"
                                />
                                <span className="text-sm text-emerald-400">@{username}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => {
                    const isOwn = msg.sender_id === user?.id;
                    const isMentor = msg.is_mentor;

                    return (
                        <div
                            key={i}
                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`flex gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                                <img
                                    src={`https://github.com/${msg.sender_username}.png`}
                                    alt={msg.sender_username}
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                />

                                <div>
                                    <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : ''}`}>
                                        <span className={`text-xs font-medium ${isMentor ? 'text-indigo-400' : 'text-slate-400'}`}>
                                            @{msg.sender_username}
                                            {isMentor && <span className="ml-1 text-indigo-500">(Mentor)</span>}
                                        </span>
                                        <span className="text-xs text-slate-600">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                    </div>

                                    <div
                                        className={`rounded-2xl px-4 py-2 ${isOwn
                                                ? 'bg-indigo-500 text-white rounded-br-md'
                                                : 'bg-slate-700 text-slate-200 rounded-bl-md'
                                            }`}
                                    >
                                        {msg.message_type === 'code' ? (
                                            <pre className="text-sm font-mono overflow-x-auto">
                                                <code>{msg.content}</code>
                                            </pre>
                                        ) : (
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        )}

                                        {msg.contains_resource && (
                                            <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-1 text-xs">
                                                <Sparkles className="w-3 h-3" />
                                                <span>Resource saved to vault</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <div className="flex gap-1">
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                        </div>
                        <span>Someone is typing...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700">
                <div className="flex gap-3">
                    <button
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="Send code snippet"
                    >
                        <FileCode className="w-5 h-5" />
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            handleTyping();
                        }}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-sm
                      text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />

                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || sending}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </div>

                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>Press Enter to send, Shift+Enter for new line</span>
                    <button
                        onClick={() => chatApi.endSession(sessionId).then(onClose)}
                        className="text-red-400 hover:text-red-300"
                    >
                        End Session
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MentorshipChat;
