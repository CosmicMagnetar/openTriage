import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import DashboardPage from './DashboardPage';
import TemplatesPage from './TemplatesPage';
import MetricsPage from './MetricsPage';
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
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
        </Routes>
      </div>

      {/* Issue Detail Panel */}
      {selectedIssue && <IssueDetailPanel />}
    </div>
  );
};

export default MaintainerLayout;