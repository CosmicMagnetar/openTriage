import { Routes, Route } from 'react-router-dom';
import { useState, useCallback, createContext, useContext } from 'react';
import { Bot } from 'lucide-react';
import ContributorSidebar from './ContributorSidebar';
import MyIssuesDashboard from './MyIssuesDashboard';
import ContributorMetrics from './ContributorMetrics';
import ProfilePage from './ProfilePage';
import MessagesPage from './MessagesPage';
import Settings from '../Settings';
import ContributorAIChat from './ContributorAIChat';

// Context for managing chat states globally
const ChatContext = createContext();

export const useChatContext = () => useContext(ChatContext);

const ContributorLayout = () => {
  const [showAIChat, setShowAIChat] = useState(false);
  const [showMentorshipChat, setShowMentorshipChat] = useState(false);

  // Mutex: Opening one chat closes the other
  const openAIChat = useCallback(() => {
    setShowMentorshipChat(false);
    setShowAIChat(true);
  }, []);

  const closeAIChat = useCallback(() => {
    setShowAIChat(false);
  }, []);

  const openMentorshipChat = useCallback(() => {
    setShowAIChat(false);
    setShowMentorshipChat(true);
  }, []);

  const closeMentorshipChat = useCallback(() => {
    setShowMentorshipChat(false);
  }, []);

  const toggleAIChat = useCallback(() => {
    if (showAIChat) {
      setShowAIChat(false);
    } else {
      setShowMentorshipChat(false);
      setShowAIChat(true);
    }
  }, [showAIChat]);

  const chatContextValue = {
    showAIChat,
    showMentorshipChat,
    openAIChat,
    closeAIChat,
    openMentorshipChat,
    closeMentorshipChat,
    toggleAIChat
  };

  return (
    <ChatContext.Provider value={chatContextValue}>
      <div className="w-full h-screen bg-[hsl(220,13%,5%)] flex overflow-hidden relative">
        <ContributorSidebar />
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<MyIssuesDashboard />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="metrics" element={<ContributorMetrics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<MyIssuesDashboard />} />
          </Routes>
        </div>

        {/* Global AI Chat */}
        {showAIChat && (
          <ContributorAIChat onClose={closeAIChat} />
        )}

        {/* Floating AI Button - positioned to avoid message input overlap */}
        <button
          data-testid="ai-chat-button"
          onClick={toggleAIChat}
          className={`fixed bottom-6 right-6 z-[60] p-4 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ${showAIChat
            ? 'bg-[hsl(220,13%,15%)] text-[hsl(210,11%,60%)]'
            : 'bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black'
            }`}
        >
          <Bot className="w-6 h-6" />
        </button>
      </div>
    </ChatContext.Provider>
  );
};

export default ContributorLayout;