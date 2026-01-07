import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const MaintainerAIChat = ({ onClose, issue }) => {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hi! I'm your maintainer assistant. I can help you with:\n\n✓ Drafting replies to this issue\n✓ Analyzing issue sentiment and classification\n✓ Suggesting labels or triage actions\n✓ Summarizing long discussions\n\nHow can I assist with Issue #${issue?.number}?`
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId] = useState(() => `maintainer-session-${issue?.id}-${Date.now()}`);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            // Add context about the issue
            const context = {
                issue_id: issue.id,
                title: issue.title,
                body: issue.body,
                repo: issue.repoName,
                number: issue.number,
                role: 'maintainer'
            };

            const response = await axios.post(`${API}/chat`, {
                message: userMessage,
                sessionId: sessionId,
                context: context
            });

            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: response.data.response }
            ]);
        } catch (error) {
            console.error('Chat error:', error);
            toast.error('Failed to get response');
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const quickActions = [
        'Draft a polite reply thanking the contributor',
        'Summarize this issue',
        'Suggest labels for this issue',
        'Is this issue beginner friendly?'
    ];

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl h-[600px] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-purple-600/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                                Maintainer Copilot
                                <Sparkles className="w-4 h-4 text-purple-400" />
                            </h2>
                            <p className="text-xs text-slate-400">Context: {issue.repoName} #{issue.number}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-900/50">
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                                }`}
                        >
                            {message.role === 'assistant' && (
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${message.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'
                                    }`}
                            >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {message.content}
                                </p>
                            </div>
                            {message.role === 'user' && (
                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                                    <User className="w-5 h-5 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none p-4 shadow-md">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-75" />
                                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                {messages.length === 1 && (
                    <div className="px-4 pb-2 bg-slate-900/50">
                        <p className="text-xs text-slate-400 mb-2 font-medium">Quick actions:</p>
                        <div className="flex flex-wrap gap-2">
                            {quickActions.map((action, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(action)}
                                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 text-slate-300 hover:text-blue-300 px-3 py-1.5 rounded-full transition-all"
                                >
                                    {action}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-slate-700 bg-slate-800">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask for help with this issue..."
                            disabled={loading}
                            className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-xl transition-all duration-300 active:scale-[0.98] disabled:scale-100 shadow-lg shadow-blue-500/20"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintainerAIChat;
