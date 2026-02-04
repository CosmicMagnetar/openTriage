import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, ArrowLeft, Search, Pencil, Trash2, X, Check, Bot } from 'lucide-react';
import { messagingApi } from '../../services/api';
import { realtimeMessagingClient } from '../../services/realtimeMessaging';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';
import { AISuggestTextarea } from '../ui/AISuggestTextarea';
import { useChatContext } from './ContributorLayout';
import ReactMarkdown from 'react-markdown';

const MessagesPage = () => {
    const { user } = useAuthStore();
    const chatContext = useChatContext();
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const messagesEndRef = useRef(null);
    const realtimeUnsubscribeRef = useRef(null);

    // Edit state
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [menuOpenId, setMenuOpenId] = useState(null);

    useEffect(() => {
        loadConversations();
        // Connect to real-time messaging service
        realtimeMessagingClient.connect()
            .then(() => {
                setRealtimeConnected(true);
            })
            .catch(error => {
                console.error('Failed to connect to real-time messaging:', error);
                // Don't show toast - polling will work silently
            });

        return () => {
            if (realtimeUnsubscribeRef.current) {
                realtimeUnsubscribeRef.current();
            }
        };
    }, []);

    useEffect(() => {
        if (selectedChat) {
            loadChatHistory(selectedChat.user_id);
        }
    }, [selectedChat]);

    // Subscribe to real-time events when connected
    useEffect(() => {
        if (!realtimeConnected || !selectedChat) return;

        const unsubscribe = realtimeMessagingClient.subscribe({
            onMessageReceived: (message) => {
                // Only add if it's from the current chat
                if (message.sender_id === selectedChat.user_id || message.receiver_id === selectedChat.user_id) {
                    setMessages(prev => {
                        // Avoid duplicates
                        if (prev.some(m => m.id === message.id)) {
                            return prev;
                        }
                        return [...prev, message];
                    });
                }
                
                // Update conversation list with new message info
                setConversations(prev => {
                    const otherUserId = message.sender_id !== user?.id ? message.sender_id : message.receiver_id;
                    return prev.map(conv => {
                        if (conv.user_id === otherUserId) {
                            return {
                                ...conv,
                                last_message: message.content,
                                last_message_timestamp: message.created_at,
                                unread_count: conv.user_id === selectedChat?.user_id ? 0 : (conv.unread_count || 0) + 1
                            };
                        }
                        return conv;
                    }).sort((a, b) => {
                        const aTime = a.last_message_timestamp || '';
                        const bTime = b.last_message_timestamp || '';
                        return bTime.localeCompare(aTime);
                    });
                });
            },
            onMessageEdited: (message) => {
                if (message.sender_id === selectedChat.user_id || message.receiver_id === selectedChat.user_id) {
                    setMessages(prev => prev.map(m =>
                        m.id === message.id ? { ...m, content: message.content, edited_at: message.edited_at } : m
                    ));
                    toast.success('Message updated');
                }
            },
            onMessageDeleted: (messageId) => {
                setMessages(prev => prev.filter(m => m.id !== messageId));
                toast.success('Message deleted');
            },
            onMessageRead: (messageId) => {
                setMessages(prev => prev.map(m =>
                    m.id === messageId ? { ...m, read: true } : m
                ));
            },
            onConnectionClose: () => {
                setRealtimeConnected(false);
                console.warn('Real-time connection closed, falling back to polling');
            },
            onError: (error) => {
                console.error('Real-time error:', error);
            },
        });

        realtimeUnsubscribeRef.current = unsubscribe;

        return () => {
            unsubscribe();
        };
    }, [realtimeConnected, selectedChat]);

    // Fallback polling when real-time is not available
    useEffect(() => {
        if (realtimeConnected) return;

        // Poll for new messages in the current chat
        const pollMessages = async () => {
            if (!selectedChat || chatLoading) return;
            
            try {
                const history = await messagingApi.getHistory(selectedChat.user_id);
                if (history && history.length > 0) {
                    // Only update if there are new messages
                    if (history.length !== messages.length || 
                        (history[history.length - 1]?.id !== messages[messages.length - 1]?.id)) {
                        setMessages(history);
                    }
                }
            } catch (error) {
                console.debug('Message poll error:', error);
            }
        };

        // Poll for conversations updates
        const pollConversations = async () => {
            try {
                const data = await messagingApi.getConversations();
                const sortedConversations = (data.conversations || []).sort((a, b) => {
                    const aTime = a.last_message_timestamp || '';
                    const bTime = b.last_message_timestamp || '';
                    return bTime.localeCompare(aTime);
                });
                setConversations(sortedConversations);
            } catch (error) {
                console.debug('Conversations poll error:', error);
            }
        };

        // Poll every 2 seconds for faster updates
        const pollInterval = setInterval(() => {
            pollMessages();
            pollConversations();
        }, 2000);

        return () => clearInterval(pollInterval);
    }, [realtimeConnected, selectedChat, messages, chatLoading]);

    // Scroll to bottom when messages change or chat finishes loading
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [messages, chatLoading]);

    const loadConversations = async () => {
        try {
            setLoading(true);
            const data = await messagingApi.getConversations();
            // Sort conversations by last message timestamp (most recent first)
            const sortedConversations = (data.conversations || []).sort((a, b) => {
                const aTime = a.last_message_timestamp || '';
                const bTime = b.last_message_timestamp || '';
                return bTime.localeCompare(aTime);
            });
            setConversations(sortedConversations);
            // Auto-select the most recent conversation if none selected
            if (!selectedChat && sortedConversations.length > 0) {
                setSelectedChat(sortedConversations[0]);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadChatHistory = async (userId) => {
        try {
            // Clear existing messages and show loading state immediately
            setMessages([]);
            setChatLoading(true);
            const history = await messagingApi.getHistory(userId);
            setMessages(history || []);
            await messagingApi.markRead(userId);
            // Update unread count in conversations list
            setConversations(prev =>
                prev.map(c => c.user_id === userId ? { ...c, unread_count: 0 } : c)
            );
        } catch (error) {
            console.error('Failed to load chat history:', error);
        } finally {
            setChatLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat || sending) return;

        const messageContent = newMessage.trim();
        setNewMessage(''); // Clear input immediately for better UX

        try {
            setSending(true);
            const sent = await messagingApi.sendMessage(selectedChat.user_id, messageContent);
            // Ensure sender_id is correctly set using current user's ID
            // This handles any potential format mismatch from backend
            const messageWithCorrectSender = {
                ...sent,
                sender_id: user?.id, // Always use current user's ID for sent messages
            };
            setMessages(prev => [...prev, messageWithCorrectSender]);
        } catch (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
            setNewMessage(messageContent); // Restore message on error
        } finally {
            setSending(false);
        }
    };

    const handleEditMessage = async (messageId) => {
        if (!editContent.trim()) return;

        try {
            const updated = await messagingApi.editMessage(messageId, editContent.trim());
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, content: updated.content, edited_at: updated.edited_at } : msg
            ));
            setEditingMessageId(null);
            setEditContent('');
            toast.success('Message updated');
        } catch (error) {
            console.error('Failed to edit message:', error);
            toast.error('Failed to edit message');
        }
    };

    const handleDeleteMessage = async (messageId) => {
        try {
            await messagingApi.deleteMessage(messageId);
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
            setMenuOpenId(null);
            toast.success('Message deleted');
        } catch (error) {
            console.error('Failed to delete message:', error);
            toast.error('Failed to delete message');
        }
    };

    const startEditing = (msg) => {
        setEditingMessageId(msg.id);
        setEditContent(msg.content);
        setMenuOpenId(null);
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditContent('');
    };

    const filteredConversations = conversations.filter(c =>
        c.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && conversations.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(142,70%,55%)]" />
            </div>
        );
    }

    return (
        <div className="h-full flex overflow-hidden">
            {/* Left Panel - Conversations List - Always visible on md+ screens */}
            <div className={`w-80 min-w-[320px] border-r border-[hsl(220,13%,12%)] flex flex-col bg-[hsl(220,13%,6%)] ${selectedChat ? 'hidden md:flex' : 'flex w-full md:w-80 md:min-w-[320px]'}`}>
                <div className="p-4 border-b border-[hsl(220,13%,15%)]">
                    <h1 className="text-xl font-bold text-[hsl(210,11%,90%)] mb-3">Messages</h1>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(210,11%,40%)]" />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg pl-10 pr-4 py-2 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,40%)] focus:outline-none focus:border-[hsl(217,91%,60%)]"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredConversations.length > 0 ? (
                        filteredConversations.map(conv => (
                            <button
                                key={conv.user_id}
                                onClick={() => setSelectedChat(conv)}
                                className={`w-full p-4 flex items-center gap-3 hover:bg-[hsl(220,13%,10%)] transition-colors border-b border-[hsl(220,13%,12%)] ${selectedChat?.user_id === conv.user_id ? 'bg-[hsl(220,13%,10%)]' : ''
                                    }`}
                            >
                                <div className="relative">
                                    <img
                                        src={conv.avatar_url || `https://github.com/${conv.username}.png`}
                                        alt={conv.username}
                                        className="w-12 h-12 rounded-full"
                                        onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                    />
                                    {conv.unread_count > 0 && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(217,91%,60%)] text-white text-xs rounded-full flex items-center justify-center">
                                            {conv.unread_count}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="font-medium text-[hsl(210,11%,90%)] truncate">@{conv.username}</div>
                                    <p className="text-sm text-[hsl(210,11%,40%)] truncate">{conv.last_message}</p>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="p-8 text-center text-[hsl(210,11%,40%)]">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No conversations yet</p>
                            <p className="text-sm mt-1">Start chatting with mentors from the Find a Mentor panel!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Chat */}
            <div className={`flex-1 flex flex-col min-w-0 ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {selectedChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-[hsl(220,13%,15%)] flex items-center gap-3 bg-[hsl(220,13%,8%)]">
                            <button
                                onClick={() => setSelectedChat(null)}
                                className="md:hidden p-2 text-[hsl(210,11%,50%)] hover:text-white"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <img
                                src={selectedChat.avatar_url || `https://github.com/${selectedChat.username}.png`}
                                alt={selectedChat.username}
                                className="w-10 h-10 rounded-full"
                                onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                            />
                            <div>
                                <div className="font-bold text-[hsl(210,11%,90%)]">@{selectedChat.username}</div>
                                <div className="text-xs text-[hsl(210,11%,50%)]">Click to view profile</div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {chatLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-[hsl(142,70%,55%)]" />
                                </div>
                            ) : messages.length > 0 ? (
                                messages.map(msg => {
                                    const isMe = msg.sender_id === user?.id || msg.sender_id === user?.username;
                                    const isEditing = editingMessageId === msg.id;

                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                            <div className={`relative max-w-[70%] rounded-2xl px-4 py-2 ${isMe
                                                ? 'bg-[hsl(217,91%,50%)] text-white rounded-br-none'
                                                : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,90%)] rounded-bl-none border border-[hsl(220,13%,18%)]'
                                                }`}>

                                                {isEditing ? (
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            value={editContent}
                                                            onChange={(e) => setEditContent(e.target.value)}
                                                            className="w-full bg-[hsl(220,13%,15%)] text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(142,70%,45%)]"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleEditMessage(msg.id);
                                                                if (e.key === 'Escape') cancelEditing();
                                                            }}
                                                        />
                                                        <div className="flex gap-1 justify-end">
                                                            <button
                                                                onClick={cancelEditing}
                                                                className="p-1 hover:bg-[hsl(220,13%,20%)] rounded"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleEditMessage(msg.id)}
                                                                className="p-1 hover:bg-[hsl(142,70%,45%,0.3)] rounded text-[hsl(142,70%,55%)]"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className={`prose prose-sm max-w-none break-words overflow-hidden ${isMe ? 'prose-invert prose-p:text-white prose-code:text-blue-100 prose-pre:bg-blue-600/30' : 'prose-invert prose-p:text-[hsl(210,11%,90%)] prose-code:text-[hsl(142,70%,60%)] prose-pre:bg-[hsl(220,13%,8%)]'} prose-p:my-0 prose-p:leading-relaxed prose-pre:my-1 prose-pre:p-2 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:max-w-full prose-code:text-xs prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none`}>
                                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                        </div>
                                                        <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-[hsl(210,11%,40%)]'}`}>
                                                            {msg.edited_at && <span className="mr-1">(edited)</span>}
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </>
                                                )}

                                                {/* Edit/Delete buttons for own messages - inline on hover */}
                                                {isMe && !isEditing && (
                                                    <div className="absolute -left-20 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                        <div className="flex items-center gap-1.5 bg-[hsl(220,13%,8%)] backdrop-blur-sm rounded-lg p-1 border border-[hsl(220,13%,18%)] shadow-lg">
                                                            <button
                                                                onClick={() => startEditing(msg)}
                                                                className="p-2 bg-[hsl(220,13%,12%)] hover:bg-[hsl(217,91%,60%,0.2)] text-[hsl(210,11%,55%)] hover:text-[hsl(217,91%,65%)] rounded-md transition-all duration-150 border border-transparent hover:border-[hsl(217,91%,60%,0.3)]"
                                                                title="Edit message"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('Delete this message?')) {
                                                                        handleDeleteMessage(msg.id);
                                                                    }
                                                                }}
                                                                className="p-2 bg-[hsl(220,13%,12%)] hover:bg-red-500/20 text-[hsl(210,11%,55%)] hover:text-red-400 rounded-md transition-all duration-150 border border-transparent hover:border-red-500/30"
                                                                title="Delete message"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center text-[hsl(210,11%,40%)] py-8">
                                    <p>No messages yet. Start the conversation!</p>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input with AI suggestions based on conversation history */}
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-[hsl(220,13%,15%)] bg-[hsl(220,13%,8%)]">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <AISuggestTextarea
                                        value={newMessage}
                                        onChange={(val) => {
                                            setNewMessage(val);
                                            // Close AI chatbot when user starts typing
                                            if (val && chatContext?.showAIChat) {
                                                chatContext.closeAIChat();
                                            }
                                        }}
                                        contextType="direct_message"
                                        conversationHistory={messages.map(m => ({
                                            sender: m.sender_id === user?.userId ? 'user' : 'other',
                                            content: m.content
                                        }))}
                                        placeholder="Type a message..."
                                        disabled={sending}
                                        rows={1}
                                        className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2.5 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(220,13%,28%)] resize-none min-h-[40px] max-h-[120px]"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending}
                                    className="flex-shrink-0 p-2.5 bg-[hsl(142,70%,45%)] text-black rounded-lg hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] transition-colors"
                                >
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                                {/* AI Chatbot Button - inline to prevent overlap */}
                                <button
                                    type="button"
                                    onClick={() => chatContext?.toggleAIChat()}
                                    className={`flex-shrink-0 p-2.5 rounded-lg transition-all ${chatContext?.showAIChat
                                        ? 'bg-[hsl(220,13%,15%)] text-[hsl(210,11%,60%)]'
                                        : 'bg-[hsl(217,91%,50%)] hover:bg-[hsl(217,91%,55%)] text-white'
                                        }`}
                                    title="AI Assistant"
                                >
                                    <Bot className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-[10px] text-[hsl(210,11%,35%)] mt-1.5">AI suggests completions based on your conversation</p>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[hsl(210,11%,40%)]">
                        <div className="text-center">
                            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p className="text-lg">Select a conversation</p>
                            <p className="text-sm mt-1">Choose from your messages on the left</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesPage;
