import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, X, Users, Clock, FileCode, Loader2, Sparkles } from 'lucide-react';
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
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            wsRef.current.send(JSON.stringify({ type: 'typing' }));

            typingTimeoutRef.current = setTimeout(() => {
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
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
                <div className="bg-[hsl(220,13%,6%)] rounded-2xl p-8 flex flex-col items-center border border-[hsl(330,70%,50%,0.2)] shadow-2xl">
                    <Loader2 className="w-8 h-8 text-[hsl(330,70%,55%)] animate-spin mb-4" />
                    <p className="text-[hsl(210,11%,70%)] text-sm">Loading session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-6 md:inset-10 lg:inset-16 bg-[hsl(220,13%,6%)] rounded-2xl shadow-2xl 
                   border border-[hsl(330,70%,50%,0.2)] flex flex-col z-40 overflow-hidden">
            {/* Header with gradient */}
            <div className="p-5 bg-gradient-to-r from-[hsl(330,70%,45%,0.1)] to-[hsl(280,70%,45%,0.1)] border-b border-[hsl(330,70%,50%,0.15)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[hsl(330,70%,45%)] to-[hsl(300,60%,40%)] flex items-center justify-center shadow-lg shadow-[hsl(330,70%,40%,0.3)]">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-[hsl(210,11%,95%)] text-lg">
                            Mentorship Session
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-[hsl(210,11%,55%)]">
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[hsl(142,70%,50%)] animate-pulse' : 'bg-red-400'}`} />
                                <span className={connected ? 'text-[hsl(142,70%,60%)]' : 'text-red-400'}>
                                    {connected ? 'Connected' : 'Reconnecting...'}
                                </span>
                            </div>
                            {session?.topic && (
                                <>
                                    <span className="text-[hsl(210,11%,30%)]">•</span>
                                    <span className="flex items-center gap-1">
                                        <Sparkles className="w-3.5 h-3.5 text-[hsl(330,70%,60%)]" />
                                        {session.topic}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-2.5 text-[hsl(210,11%,50%)] hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Participants Bar */}
            {session && (
                <div className="px-5 py-3 bg-[hsl(220,13%,5%)] border-b border-[hsl(220,13%,12%)] flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs text-[hsl(210,11%,40%)] font-medium uppercase tracking-wide">Mentor</span>
                        <div className="flex items-center gap-2 bg-[hsl(330,70%,50%,0.1)] px-3 py-1.5 rounded-lg border border-[hsl(330,70%,50%,0.2)]">
                            <img
                                src={`https://github.com/${session.mentor_username}.png`}
                                alt={session.mentor_username}
                                className="w-5 h-5 rounded-full"
                            />
                            <span className="text-[hsl(330,70%,65%)] font-medium">@{session.mentor_username}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs text-[hsl(210,11%,40%)] font-medium uppercase tracking-wide">Mentee</span>
                        {session.mentee_usernames?.map((username, i) => (
                            <div key={i} className="flex items-center gap-2 bg-[hsl(142,70%,50%,0.1)] px-3 py-1.5 rounded-lg border border-[hsl(142,70%,50%,0.2)]">
                                <img
                                    src={`https://github.com/${username}.png`}
                                    alt={username}
                                    className="w-5 h-5 rounded-full"
                                />
                                <span className="text-[hsl(142,70%,60%)] font-medium">@{username}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[hsl(220,13%,4%)]">
                {messages.map((msg, i) => {
                    const isOwn = msg.sender_id === user?.id;
                    const isMentor = msg.is_mentor;

                    return (
                        <div
                            key={i}
                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`flex gap-3 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                                <img
                                    src={`https://github.com/${msg.sender_username}.png`}
                                    alt={msg.sender_username}
                                    className="w-8 h-8 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-offset-[hsl(220,13%,4%)] ring-[hsl(220,13%,15%)]"
                                />

                                <div>
                                    <div className={`flex items-center gap-2 mb-1.5 ${isOwn ? 'justify-end' : ''}`}>
                                        <span className={`text-xs font-medium ${isMentor ? 'text-[hsl(330,70%,65%)]' : 'text-[hsl(210,11%,55%)]'}`}>
                                            @{msg.sender_username}
                                            {isMentor && <span className="ml-1.5 px-1.5 py-0.5 bg-[hsl(330,70%,50%,0.15)] text-[hsl(330,70%,60%)] rounded text-[10px]">Mentor</span>}
                                        </span>
                                        <span className="text-xs text-[hsl(210,11%,35%)]">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                    </div>

                                    <div
                                        className={`rounded-2xl px-4 py-3 ${isOwn
                                            ? 'bg-gradient-to-br from-[hsl(330,70%,45%)] to-[hsl(300,60%,40%)] text-white rounded-br-md'
                                            : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,90%)] border border-[hsl(220,13%,18%)] rounded-bl-md'
                                            }`}
                                    >
                                        {msg.message_type === 'code' ? (
                                            <pre className="text-sm font-mono overflow-x-auto bg-black/20 rounded-lg p-3">
                                                <code>{msg.content}</code>
                                            </pre>
                                        ) : (
                                            <p className="text-sm leading-relaxed">{msg.content}</p>
                                        )}

                                        {msg.contains_resource && (
                                            <div className="mt-2.5 pt-2.5 border-t border-white/20 flex items-center gap-1.5 text-xs text-white/70">
                                                <FileCode className="w-3.5 h-3.5" />
                                                <span>Resource saved</span>
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
                    <div className="flex items-center gap-3 text-sm text-[hsl(210,11%,50%)] bg-[hsl(220,13%,8%)] px-4 py-2.5 rounded-2xl w-fit">
                        <div className="flex gap-1">
                            <span className="w-2 h-2 bg-[hsl(330,70%,55%)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-[hsl(330,70%,55%)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-[hsl(330,70%,55%)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-[hsl(210,11%,50%)]">Someone is typing...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-5 bg-[hsl(220,13%,6%)] border-t border-[hsl(330,70%,50%,0.1)]">
                <div className="flex items-center gap-4">
                    <button
                        className="flex-shrink-0 p-3 text-[hsl(210,11%,50%)] hover:text-[hsl(330,70%,65%)] hover:bg-[hsl(330,70%,50%,0.1)] rounded-xl transition-colors"
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
                        className="flex-1 min-w-0 bg-[hsl(220,13%,4%)] border border-[hsl(220,13%,15%)] rounded-xl px-5 py-3.5 text-sm
                      text-[hsl(210,11%,90%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(330,70%,50%)] focus:ring-2 focus:ring-[hsl(330,70%,50%,0.2)] transition-all"
                    />

                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || sending}
                        className="flex-shrink-0 px-5 py-3.5 bg-gradient-to-r from-[hsl(330,70%,45%)] to-[hsl(300,60%,45%)] text-white rounded-xl hover:from-[hsl(330,70%,50%)] hover:to-[hsl(300,60%,50%)] 
                      disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-[hsl(330,70%,40%,0.2)]"
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-[hsl(210,11%,40%)]">
                    <span>Press Enter to send</span>
                    <button
                        onClick={() => chatApi.endSession(sessionId).then(onClose)}
                        className="text-red-400/70 hover:text-red-400 transition-colors"
                    >
                        End Session
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MentorshipChat;
