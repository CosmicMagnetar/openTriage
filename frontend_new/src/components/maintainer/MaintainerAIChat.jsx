import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { AISuggestTextarea } from '../ui/AISuggestTextarea';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

// Quick reply chips for maintainers
const QUICK_ACTIONS = [
    { id: 'reply', label: 'Draft Reply', prompt: 'Draft a polite reply thanking the contributor' },
    { id: 'summarize', label: 'Summarize', prompt: 'Summarize this issue concisely' },
    { id: 'labels', label: 'Suggest Labels', prompt: 'Suggest appropriate labels for this issue' },
    { id: 'beginner', label: 'Beginner Friendly?', prompt: 'Is this issue beginner friendly?' },
];

const MaintainerAIChat = ({ onClose, issue }) => {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hi! I'm your maintainer assistant. I can help you with:\n\n• Drafting replies to this issue\n• Analyzing sentiment and classification\n• Suggesting labels or triage actions\n• Summarizing long discussions\n\nHow can I assist with Issue #${issue?.number}?`
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
            // Add context about the issue for RAG
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

    const handleQuickAction = (prompt) => {
        setInput(prompt);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg w-full max-w-2xl h-[600px] flex flex-col overflow-hidden">
                {/* Header - Clean */}
                <div className="px-5 py-4 border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[hsl(142,70%,45%)] rounded-lg flex items-center justify-center">
                            <Bot className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h2 className="text-base font-medium text-[hsl(210,11%,85%)] flex items-center gap-2">
                                Maintainer Copilot
                                <Sparkles className="w-3.5 h-3.5 text-[hsl(142,70%,55%)]" />
                            </h2>
                            <p className="text-xs text-[hsl(210,11%,45%)]">{issue.repoName} #{issue.number}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[hsl(210,11%,45%)] hover:text-[hsl(210,11%,75%)] p-2 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {message.role === 'assistant' && (
                                <div className="w-7 h-7 bg-[hsl(142,70%,45%)] rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-black" />
                                </div>
                            )}
                            <div
                                className={`max-w-[80%] rounded-lg px-4 py-2.5 ${message.role === 'user'
                                        ? 'bg-[hsl(142,70%,45%)] text-black'
                                        : 'bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] text-[hsl(210,11%,80%)]'
                                    }`}
                            >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {message.content}
                                </p>
                            </div>
                            {message.role === 'user' && (
                                <div className="w-7 h-7 bg-[hsl(220,13%,15%)] rounded-lg flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-[hsl(210,11%,70%)]" />
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-7 h-7 bg-[hsl(142,70%,45%)] rounded-lg flex items-center justify-center">
                                <Bot className="w-4 h-4 text-black" />
                            </div>
                            <div className="bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-lg p-3">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-[hsl(142,70%,45%)] rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-[hsl(142,70%,45%)] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                    <div className="w-2 h-2 bg-[hsl(142,70%,45%)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions - Subtle chips */}
                {messages.length === 1 && (
                    <div className="px-5 pb-3 border-t border-[hsl(220,13%,12%)]">
                        <p className="text-[10px] text-[hsl(210,11%,40%)] mb-2 mt-3">Quick actions:</p>
                        <div className="flex flex-wrap gap-1.5">
                            {QUICK_ACTIONS.map((action) => (
                                <button
                                    key={action.id}
                                    onClick={() => handleQuickAction(action.prompt)}
                                    className="text-xs px-2.5 py-1 rounded border bg-[hsl(220,13%,10%)] border-[hsl(220,13%,18%)] text-[hsl(210,11%,55%)] hover:text-[hsl(210,11%,75%)] hover:border-[hsl(220,13%,25%)] transition-colors"
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input with AI suggestions */}
                <div className="px-5 py-4 border-t border-[hsl(220,13%,15%)]">
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <AISuggestTextarea
                                value={input}
                                onChange={setInput}
                                contextType="maintainer_chat"
                                conversationHistory={messages.map(m => ({
                                    sender: m.role === 'user' ? 'user' : 'assistant',
                                    content: m.content
                                }))}
                                issueContext={{
                                    title: issue.title,
                                    body: issue.body,
                                    repoName: issue.repoName,
                                    number: issue.number
                                }}
                                placeholder="Ask for help with this issue..."
                                disabled={loading}
                                rows={1}
                                className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2.5 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(220,13%,28%)] resize-none min-h-[40px] max-h-[120px]"
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="p-2.5 bg-[hsl(142,70%,45%)] text-black rounded-lg hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] transition-colors"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                    <p className="text-[10px] text-[hsl(210,11%,35%)] mt-1.5">AI suggestions use issue context</p>
                </div>
            </div>
        </div>
    );
};

export default MaintainerAIChat;
