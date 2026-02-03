import { Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import { Bot } from 'lucide-react';
import Sidebar from './Sidebar';
import DashboardPage from './DashboardPage';
import PRManagementPage from './PRManagementPage';
import MaintainerPortal from './MaintainerPortal';
import MaintainerProfilePage from './MaintainerProfilePage';
import PublicProfilePage from '../contributor/PublicProfilePage';
import Settings from '../Settings';
import IssueDetailPanel from './IssueDetailPanel';
import AIChat from './AIChat';
import useIssueStore from '../../stores/issueStore';

const MaintainerLayout = () => {
  const { selectedIssue } = useIssueStore();
  const [showChat, setShowChat] = useState(false);

  return (
    <div className="w-full h-screen bg-[hsl(220,13%,5%)] flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="prs" element={<PRManagementPage />} />
          <Route path="hub" element={<MaintainerPortal />} />
          <Route path="profile" element={<MaintainerProfilePage />} />
          <Route path="user/:username" element={<PublicProfilePage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </div>

      {/* Issue Detail Panel */}
      {selectedIssue && <IssueDetailPanel />}

      {/* Floating AI Chat Button - Global */}
      <button
        data-testid="ai-chat-button-global"
        onClick={() => setShowChat(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all"
      >
        <Bot className="w-6 h-6" />
      </button>

      {/* AI Chat Modal */}
      {showChat && <AIChat onClose={() => setShowChat(false)} />}
    </div>
  );
};

export default MaintainerLayout;