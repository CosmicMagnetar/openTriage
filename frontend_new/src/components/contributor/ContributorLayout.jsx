import { Routes, Route } from 'react-router-dom';
import WorkspaceSidebar from '../workspace/WorkspaceSidebar';
import TodayPage from '../workspace/TodayPage';
import FindWorkPage from '../workspace/FindWorkPage';
import IssueWorkspacePage from '../workspace/IssueWorkspacePage';
import RepoLensPage from '../workspace/RepoLensPage';
import MyIssuesDashboard from './MyIssuesDashboard';
import Settings from '../Settings';
import AIDisabledBanner from '../settings/AIDisabledBanner';

/**
 * Contributor workspace: discovery (find work), understanding (issue workspace,
 * repo lens) and coordination (today). The generic AI chatbot, messaging,
 * metrics and profile pages are no longer part of the workspace.
 */
const ContributorLayout = () => (
  <div className="w-full h-screen bg-[hsl(220,13%,5%)] flex overflow-hidden relative">
    <WorkspaceSidebar />
    <div className="flex-1 overflow-hidden flex flex-col">
      <AIDisabledBanner />
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route index element={<TodayPage />} />
          <Route path="find" element={<FindWorkPage />} />
          <Route path="work/:owner/:repo/:number" element={<IssueWorkspacePage />} />
          <Route path="lens" element={<RepoLensPage />} />
          <Route path="lens/:owner/:repo" element={<RepoLensPage />} />
          <Route path="mine" element={<MyIssuesDashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<TodayPage />} />
        </Routes>
      </div>
    </div>
  </div>
);

export default ContributorLayout;
