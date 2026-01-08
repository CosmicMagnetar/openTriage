import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, Bot, User, Sparkles, ChevronDown, BookOpen, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { ragApi } from '../../services/api';
import ReactMarkdown from 'react-markdown';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const ContributorAIChat = ({ onClose, issues: propIssues }) => {
  const [internalIssues, setInternalIssues] = useState([]);
  const issues = propIssues || internalIssues;

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm your Project Assistant.\n\n**Select a specific repository** above to chat about its documentation and code.\n\nOr keep it on **"All Repositories"** for general advice about open source!`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('all');
  const [sessionId] = useState(() => `contributor-session-${Date.now()}`);
  const messagesEndRef = useRef(null);

  // Fetch issues if not provided (for global usage)
  useEffect(() => {
    if (!propIssues) {
      const fetchIssues = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) return;
          const response = await axios.get(`${API}/contributor/my-issues`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setInternalIssues(response.data);
        } catch (error) {
          console.error('Failed to fetch issues for chat context:', error);
        }
      };
      fetchIssues();
    }
  }, [propIssues]);

  const repositories = useMemo(() => {
    return [...new Set(issues.map(i => i.repoName).filter(Boolean))].sort();
  }, [issues]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-index when repo changes
  useEffect(() => {
    const indexRepo = async () => {
      if (selectedRepo !== 'all') {
        setIsIndexing(true);
        const toastId = toast.loading(`Reading ${selectedRepo} documentation...`);
        try {
          await ragApi.indexRepository(selectedRepo);
          toast.success('Documentation loaded!', { id: toastId });
          // Add a system message confirming mode switch
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `I've read the documentation for **${selectedRepo}**. Ask me anything about the codebase!`
            }
          ]);
        } catch (error) {
          console.error('Indexing failed:', error);
          toast.error('Failed to load documentation', { id: toastId });
        } finally {
          setIsIndexing(false);
        }
      }
    };

    indexRepo();
  }, [selectedRepo]);

  const handleSend = async () => {
    if (!input.trim() || loading || isIndexing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      let responseContent;
      let sources = [];
      let relatedIssues = [];

      if (selectedRepo !== 'all') {
        // Use RAG API for specific repo
        const response = await ragApi.askQuestion(userMessage, selectedRepo);
        responseContent = response.answer;
        sources = response.sources || [];
        relatedIssues = response.related_issues || [];
      } else {
        // Use General Chat API
        // Add context about user's contributions and selected repo
        const context = {
          totalContributions: issues.length,
          pullRequests: issues.filter(i => i.isPR).length,
          openIssues: issues.filter(i => !i.isPR && i.state === 'open').length,
          repositories: repositories,
          selectedRepo: selectedRepo,
          role: 'contributor'
        };

        const response = await axios.post(`${API}/chat`, {
          message: userMessage,
          sessionId: sessionId,
          context: context
        });
        responseContent = response.data.response;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: responseContent,
          sources: sources,
          relatedIssues: relatedIssues
        }
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get response');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', isError: true }
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

  const quickQuestions = [
    'How can I get started with GSoC?',
    'What makes a good pull request?',
    'Which program should I apply to?',
    'How to find beginner-friendly issues?'
  ];

  return (
    <div
      data-testid="contributor-ai-chat"
      className="fixed bottom-24 right-6 z-50 w-[450px] h-[500px] flex flex-col pointer-events-none"
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl w-full h-full flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-10 origin-bottom-right duration-200 pointer-events-auto"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-emerald-600/10 to-blue-600/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                  Project Assistant
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </h2>
                <p className="text-xs text-slate-400">Your guide to the codebase</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Repo Selector */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                disabled={loading || isIndexing}
                className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                <option value="all">General Chat (All Repos)</option>
                {repositories.map(repo => (
                  <option key={repo} value={repo}>Project: {repo}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {selectedRepo !== 'all' && (
              <button
                onClick={async () => {
                  if (isIndexing) return;
                  setIsIndexing(true);
                  const toastId = toast.loading('Refreshing documentation...');
                  try {
                    await ragApi.indexRepository(selectedRepo);
                    toast.success('Documentation updated!', { id: toastId });
                  } catch (error) {
                    toast.error('Failed to update', { id: toastId });
                  } finally {
                    setIsIndexing(false);
                  }
                }}
                disabled={isIndexing}
                className={`p-2 rounded-lg transition-colors border ${isIndexing
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 animate-pulse'
                  : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300'
                  }`}
                title="Refresh documentation"
              >
                <RefreshCw className={`w-4 h-4 ${isIndexing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
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
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${message.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-none'
                  : message.isError
                    ? 'bg-red-500/20 text-red-200 border border-red-500/30 rounded-bl-none'
                    : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'
                  }`}
              >
                <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-strong:text-emerald-300 prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>

                {/* Sources & Related Issues (RAG) */}
                {(message.sources?.length > 0 || message.relatedIssues?.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-slate-600/50 space-y-3">
                    {/* Sources */}
                    {message.sources?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          Sources
                        </p>
                        {message.sources.slice(0, 2).map((source, idx) => (
                          <div key={idx} className="text-xs text-slate-400 truncate bg-slate-900/30 px-2 py-1 rounded">
                            {source.title || source.source || 'Documentation'}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Related Issues */}
                    {message.relatedIssues?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Related Issues
                        </p>
                        {message.relatedIssues.slice(0, 2).map((issue, idx) => (
                          <a
                            key={idx}
                            href={issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline truncate flex items-center gap-1"
                          >
                            #{issue.number} {issue.title}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none p-4 shadow-md">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-75" />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 bg-slate-900/50">
            <p className="text-xs text-slate-400 mb-2 font-medium">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 px-3 py-1.5 rounded-full transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-slate-700 bg-slate-800">
          <div className="flex gap-2">
            <input
              data-testid="contributor-chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about opportunities, contributions, or career advice..."
              disabled={loading}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-xl transition-all duration-300 active:scale-[0.98] disabled:scale-100 shadow-lg shadow-emerald-500/20"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContributorAIChat;