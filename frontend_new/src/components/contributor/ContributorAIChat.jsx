import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChannelProvider, useChannel, useConnectionStateListener } from 'ably/react';
import { X, Send, Bot, User, ChevronDown, BookOpen, ExternalLink, AlertCircle, RefreshCw, Loader2, WifiOff } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { ragApi } from '../../services/api';
import ReactMarkdown from 'react-markdown';
import useRagStageUpdates from '../../hooks/useRagStageUpdates';
import RagStatusBar from '../ui/RagStatusBar';
import useOramaIndex from '../../hooks/useOramaIndex';
import useAuthStore from '../../stores/authStore';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const ContributorAIChatInner = ({ onClose, issues: propIssues, selectedRepo, setSelectedRepo, channelName }) => {
  const { token } = useAuthStore();
  const oramaIndex = useOramaIndex();
  const { indexReadme: oramaIndexReadme } = oramaIndex;
  
  const [internalIssues, setInternalIssues] = useState([]);
  const issues = propIssues || internalIssues;

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: selectedRepo === 'all'
        ? `Hi! I'm your Project Assistant.\n\n**Select a specific repository** above to chat about its documentation and code.\n\nOr keep it on **"All Repositories"** for general advice about open source!`
        : `Joined **${selectedRepo}** chat. Ask questions about the codebase!`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [sessionId] = useState(() => `contributor-session-${Date.now()}`);
  const [ragSessionId, setRagSessionId] = useState(null);
  const [ablyConnected, setAblyConnected] = useState(false);
  const [ablyError, setAblyError] = useState(null);
  const ablyErrorRef = useRef(false);
  const indexedRepoRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Socket.io – listen for RAG pipeline stage updates
  const { stage, label, progress, isConnected: socketConnected } = useRagStageUpdates(ragSessionId);

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
          // Backend returns { items: [...], total, pages, limit }
          // Extract items array or use empty array as fallback
          setInternalIssues(response.data?.items || response.data || []);
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

  // Auto-index README with Orama when repo changes
  useEffect(() => {
    if (selectedRepo === 'all') return;
    // Guard: skip if this repo is already indexed
    if (indexedRepoRef.current === selectedRepo) return;

    let cancelled = false;
    const indexRepo = async () => {
      setIsIndexing(true);
      const toastId = toast.loading(`Reading ${selectedRepo} documentation...`);
      try {
        const [owner, repo] = selectedRepo.split('/');
        if (!owner || !repo) {
          throw new Error(`Invalid repo format: ${selectedRepo}`);
        }

        // Pass null for githubToken — the app JWT is not a GitHub PAT
        const result = await oramaIndexReadme(owner, repo, null);
        if (cancelled) return;

        if (!result.success) {
          throw new Error(result.error || 'Failed to index README');
        }

        // Mark this repo as indexed so we don't re-index on re-renders
        indexedRepoRef.current = selectedRepo;

        toast.success(`Documentation loaded! (${result.sectionsIndexed} sections indexed)`, { id: toastId });
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `I've read the documentation for **${selectedRepo}** (${result.sectionsIndexed} sections). Ask me anything about the codebase!`
          }
        ]);
      } catch (error) {
        if (cancelled) return;
        console.error('Orama indexing failed:', error);
        toast.error(`Failed to load documentation: ${error.message}`, { id: toastId });
      } finally {
        if (!cancelled) setIsIndexing(false);
      }
    };

    indexRepo();
    return () => { cancelled = true; };
  }, [selectedRepo, oramaIndexReadme]);

  // Ably Connection State Listener
  useConnectionStateListener((stateChange) => {
    if (stateChange.current === 'connected') {
      setAblyConnected(true);
      setAblyError(null);
    } else if (stateChange.current === 'failed' || stateChange.current === 'suspended') {
      setAblyConnected(false);
      setAblyError('Real-time connection unavailable. Using direct mode.');
    }
  });

  // Safe channel message handler
  const handleChannelMessage = useCallback((message) => {
    if (message?.data) {
      setMessages(prev => [...prev, message.data]);
    }
  }, []);

  // Use channel with error boundary and rewind for history
  // Rewind fetches the last 50 messages when subscribing
  const channelResult = useChannel(
    { channelName, options: { params: { rewind: '50' } } },
    handleChannelMessage
  );
  const channel = channelResult?.channel ?? null;

  // Track Ably errors via effect (not during render)
  useEffect(() => {
    if (!channelResult?.channel && !ablyErrorRef.current) {
      ablyErrorRef.current = true;
      setAblyError('Real-time features unavailable. Using direct mode.');
    }
  }, [channelResult]);

  const handleSend = async () => {
    if (!input.trim() || loading || isIndexing) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Optimistically add user message locally
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);

    try {
      // Only publish to Ably if connected
      if (channel && ablyConnected) {
        await channel.publish('message', { role: 'user', content: userMessage, timestamp: Date.now() });
      }

      // AI Processing
      let responseContent;
      let sources = [];
      let relatedIssues = [];

      if (selectedRepo !== 'all') {
        // Use local Orama search (instant, no backend call!)
        const searchResults = await oramaIndex.performSearch(userMessage, 5, selectedRepo);
        
        if (!searchResults || searchResults.length === 0) {
          responseContent = `I searched the documentation for "${userMessage}" but didn't find a direct match. Try asking with different words or phrasing. Here are some tips:\n\n- Check the README's table of contents\n- Ask about setup, installation, or usage\n- Try searching for specific features or APIs`;
        } else {
          // Format top search results as readable response
          const topResults = searchResults.slice(0, 3);
          const formattedResults = topResults.map(r => `**${r.section}**\n${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}`).join('\n\n');
          responseContent = `Based on the documentation, here's what I found:\n\n${formattedResults}`;
          
          // Convert Orama results to sources format for display
          sources = searchResults.map(r => ({
            title: r.section,
            source: r.section,
            url: r.sourceUrl
          }));
        }
      } else {
        // Global chat - use backend with RAG pipeline monitoring
        const currentRagSession = `rag-${Date.now()}`;
        setRagSessionId(currentRagSession);

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
        responseContent = response.data?.response || response.data?.answer || 'I received your question but couldn\'t generate a proper response.';
      }

      // Publish AI Response (or add locally if Ably unavailable)
      const aiMessage = {
        role: 'assistant',
        content: responseContent,
        sources: sources,
        relatedIssues: relatedIssues,
        timestamp: Date.now()
      };

      if (channel && ablyConnected) {
        await channel.publish('message', aiMessage);
      } else {
        // Direct mode - add message locally
        setMessages(prev => [...prev, aiMessage]);
      }

    } catch (error) {
      console.error('Chat error:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: error.code
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to get AI response';
      let actionMessage = '';
      
      if (error.response?.status === 503) {
        errorMessage = 'AI service is unavailable';
        actionMessage = ' - The AI engine may not be running. Contact admin or try again later.';
      } else if (error.response?.status === 502) {
        errorMessage = 'AI service connection failed';
        actionMessage = ' - Check if the AI engine is running.';
      } else if (error.response?.status === 500) {
        errorMessage = 'AI service error';
        actionMessage = ' - Internal AI engine error. Check logs.';
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network')) {
        errorMessage = 'Network connection error';
        actionMessage = ' - Check your internet connection.';
      }
      
      toast.error(errorMessage + actionMessage);
      
      // Publish error as local only? Or broadcast error? Better local.
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
      className="fixed bottom-24 right-6 z-50 w-[420px] h-[480px] flex flex-col pointer-events-none"
    >
      <div
        className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg w-full h-full flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in-95 slide-in-from-bottom-10 origin-bottom-right duration-200 pointer-events-auto"
      >
        {/* Header */}
        <div className="p-4 border-b border-[hsl(220,13%,15%)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[hsl(142,70%,45%)] rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[hsl(210,11%,90%)]">
                  Project Assistant
                </h2>
                <p className="text-xs text-[hsl(210,11%,50%)]">Your guide to the codebase</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] transition-colors p-2 hover:bg-[hsl(220,13%,12%)] rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Repo Selector */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                disabled={loading || isIndexing}
                className="w-full appearance-none bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-md pl-3 pr-8 py-2 text-sm text-[hsl(210,11%,85%)] focus:outline-none focus:border-[hsl(142,70%,45%)] transition-colors cursor-pointer disabled:opacity-50"
              >
                <option value="all">General Chat (All Repos)</option>
                {repositories.map(repo => (
                  <option key={repo} value={repo}>Project: {repo}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(210,11%,50%)] pointer-events-none" />
            </div>

            {selectedRepo !== 'all' && (
              <button
                onClick={async () => {
                  if (isIndexing) return;
                  setIsIndexing(true);
                  const toastId = toast.loading('Refreshing documentation...');
                  try {
                    const [owner, repo] = selectedRepo.split('/');
                    const result = await oramaIndex.indexReadme(owner, repo, null);
                    if (result.success) {
                      toast.success('Documentation refreshed!', { id: toastId });
                    } else {
                      toast.error(result.error, { id: toastId });
                    }
                  } catch (error) {
                    toast.error('Failed to refresh', { id: toastId });
                  } finally {
                    setIsIndexing(false);
                  }
                }}
                disabled={isIndexing}
                className={`p-2 rounded-md transition-colors border ${isIndexing
                  ? 'bg-[hsl(142,70%,45%,0.15)] border-[hsl(142,70%,45%,0.3)] text-[hsl(142,70%,55%)]'
                  : 'bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,15%)] border-[hsl(220,13%,18%)] text-[hsl(210,11%,60%)]'
                  }`}
                title="Refresh documentation"
              >
                <RefreshCw className={`w-4 h-4 ${isIndexing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* RAG Pipeline Status Bar */}
        {loading && selectedRepo !== 'all' && (
          <div className="px-4 pt-2">
            <RagStatusBar
              stage={stage}
              label={label}
              progress={progress}
              isConnected={socketConnected}
            />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 bg-[hsl(142,70%,45%)] rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${message.role === 'user'
                  ? 'bg-[hsl(142,70%,45%)] text-white'
                  : message.isError
                    ? 'bg-red-500/15 text-red-200 border border-red-500/25'
                    : 'bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] text-[hsl(210,11%,85%)]'
                  }`}
              >
                <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-strong:text-[hsl(142,70%,60%)] prose-a:text-[hsl(217,91%,65%)] prose-a:no-underline hover:prose-a:underline">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>

                {/* Sources & Related Issues (RAG) */}
                {(message.sources?.length > 0 || message.relatedIssues?.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-[hsl(220,13%,20%)] space-y-2">
                    {/* Sources */}
                    {message.sources?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-[hsl(142,70%,55%)] flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          Sources
                        </p>
                        {message.sources.slice(0, 2).map((source, idx) => (
                          <div key={idx} className="text-xs text-[hsl(210,11%,50%)] truncate bg-[hsl(220,13%,8%)] px-2 py-1 rounded">
                            {source.title || source.source || 'Documentation'}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Related Issues */}
                    {message.relatedIssues?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-[hsl(217,91%,65%)] flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Related Issues
                        </p>
                        {message.relatedIssues.slice(0, 2).map((issue, idx) => (
                          <a
                            key={idx}
                            href={issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[hsl(217,91%,65%)] hover:underline truncate flex items-center gap-1"
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
                <div className="w-7 h-7 bg-[hsl(220,13%,15%)] rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[hsl(210,11%,60%)]" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 bg-[hsl(142,70%,45%)] rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-lg p-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-[hsl(142,70%,55%)] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[hsl(142,70%,55%)] rounded-full animate-bounce delay-75" />
                  <div className="w-2 h-2 bg-[hsl(142,70%,55%)] rounded-full animate-bounce delay-150" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-[hsl(210,11%,40%)] mb-2">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="text-xs bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,15%)] border border-[hsl(220,13%,18%)] text-[hsl(210,11%,60%)] hover:text-[hsl(210,11%,80%)] px-3 py-1.5 rounded-md transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-[hsl(220,13%,15%)]">
          <div className="flex gap-2">
            <input
              data-testid="contributor-chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about opportunities, contributions, or career advice..."
              disabled={loading}
              className="flex-1 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-md px-3 py-2 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)] transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,15%)] disabled:text-[hsl(210,11%,40%)] text-white px-3 py-2 rounded-md transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ContributorAIChat = ({ onClose, issues: propIssues }) => {
  const [selectedRepo, setSelectedRepo] = useState('all');
  const channelName = selectedRepo === 'all'
    ? 'OpenTriage-Global-Chat'
    : `OpenTriage-Chat-${selectedRepo.replace('/', '-')}`;

  return (
    <ChannelProvider channelName={channelName} key={channelName}>
      <ContributorAIChatInner
        onClose={onClose}
        issues={propIssues}
        selectedRepo={selectedRepo}
        setSelectedRepo={setSelectedRepo}
        channelName={channelName}
      />
    </ChannelProvider>
  );
};

export default ContributorAIChat;