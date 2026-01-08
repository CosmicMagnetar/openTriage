import { Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import { Bot } from 'lucide-react';
import ContributorSidebar from './ContributorSidebar';
import MyIssuesDashboard from './MyIssuesDashboard';
import ContributorMetrics from './ContributorMetrics';
import ProfilePage from './ProfilePage';
import MessagesPage from './MessagesPage';
import Settings from '../Settings';
import ContributorAIChat from './ContributorAIChat';

const ContributorLayout = () => {
  const [showChat, setShowChat] = useState(false);

  return (
    <div className="w-full h-screen bg-[hsl(220,13%,5%)] flex overflow-hidden relative">
      <ContributorSidebar />
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<MyIssuesDashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/metrics" element={<ContributorMetrics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<MyIssuesDashboard />} />
        </Routes>
      </div>

      {/* Global AI Chat */}
      {showChat && (
        <ContributorAIChat onClose={() => setShowChat(false)} />
      )}

      {/* Floating AI Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black rounded-full shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95"
      >
        <Bot className="w-6 h-6" />
      </button>
    </div>
  );
};

export default ContributorLayout;