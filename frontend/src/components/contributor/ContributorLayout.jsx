import { Routes, Route } from 'react-router-dom';
import ContributorSidebar from './ContributorSidebar';
import MyIssuesDashboard from './MyIssuesDashboard';
import ContributorMetrics from './ContributorMetrics';
import ProfilePage from './ProfilePage';
import MessagesPage from './MessagesPage';
import Settings from '../Settings';

const ContributorLayout = () => {
  return (
    <div className="w-full h-screen bg-slate-900 flex overflow-hidden">
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
    </div>
  );
};

export default ContributorLayout;