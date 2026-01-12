import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

// Quick actions for maintainers
const QUICK_ACTIONS = [
  'Help me triage issues',
  'Draft a polite reply',
  'Analyze recent PRs',
  'Summarize open issues'
];

const AIChat = ({ onClose }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Maintainer Copilot. I can help you triage issues, draft replies, analyze PRs, and manage your repositories. How can I assist you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `maintainer-session-${Date.now()}`);
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
      const response = await axios.post(`${API}/chat`, {
        message: userMessage,
        sessionId: sessionId,
        context: {
          role: 'maintainer'
        }
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

  return (
    <div
      data-testid="ai-chat-panel"
      className="fixed bottom-24 right-6 z-50 w-[400px] h-[500px] flex flex-col pointer-events-none"
    >
      <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg w-full h-full flex flex-col overflow-hidden shadow-xl pointer-events-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-10 origin-bottom-right duration-200">
        {/* Header - Clean */}
        <div className="px-4 py-3 border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[hsl(142,70%,45%)] rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-[hsl(210,11%,85%)] flex items-center gap-2">
                Maintainer Copilot
                <Sparkles className="w-3 h-3 text-[hsl(142,70%,55%)]" />
              </h2>
              <p className="text-[10px] text-[hsl(210,11%,45%)]">AI Assistant</p>
            </div>
          </div>
          <button
            data-testid="close-chat-button"
            onClick={onClose}
            className="text-[hsl(210,11%,45%)] hover:text-[hsl(210,11%,75%)] p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-6 h-6 bg-[hsl(142,70%,45%)] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-black" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${message.role === 'user'
                    ? 'bg-[hsl(142,70%,45%)] text-black'
                    : 'bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] text-[hsl(210,11%,80%)]'
                  }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-6 h-6 bg-[hsl(220,13%,15%)] rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-[hsl(210,11%,60%)]" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 bg-[hsl(142,70%,45%)] rounded-lg flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-black" />
              </div>
              <div className="bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-lg p-2.5">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-[hsl(142,70%,45%)] rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-[hsl(142,70%,45%)] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1.5 h-1.5 bg-[hsl(142,70%,45%)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions - only show at start */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-[10px] text-[hsl(210,11%,40%)] mb-1.5">Suggestions:</p>
            <div className="flex flex-wrap gap-1">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => setInput(action)}
                  className="text-[11px] px-2 py-1 rounded border bg-[hsl(220,13%,10%)] border-[hsl(220,13%,18%)] text-[hsl(210,11%,55%)] hover:text-[hsl(210,11%,75%)] hover:border-[hsl(220,13%,25%)] transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-[hsl(220,13%,15%)]">
          <div className="flex gap-2">
            <input
              data-testid="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything..."
              disabled={loading}
              className="flex-1 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(220,13%,28%)] transition-colors disabled:opacity-50"
            />
            <button
              data-testid="send-message-button"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="p-2 bg-[hsl(142,70%,45%)] text-black rounded-lg hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] transition-colors"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
