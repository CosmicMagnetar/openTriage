import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import DashboardPage from './DashboardPage';
import PRManagementPage from './PRManagementPage';
import MaintainerPortal from './MaintainerPortal';
import ProfilePage from '../contributor/ProfilePage';
import Settings from '../Settings';
import IssueDetailPanel from './IssueDetailPanel';
import useIssueStore from '../../stores/issueStore';

const MaintainerLayout = () => {
  const { selectedIssue } = useIssueStore();

  return (
    <div className="w-full h-screen bg-slate-900 flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/prs" element={<PRManagementPage />} />
          <Route path="/hub" element={<MaintainerPortal />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </div>

      {/* Issue Detail Panel */}
      {selectedIssue && <IssueDetailPanel />}
    </div>
  );
};

export default MaintainerLayout;