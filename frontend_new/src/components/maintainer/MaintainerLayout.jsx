import { Routes, Route } from 'react-router-dom';
import WorkspaceSidebar from '../workspace/WorkspaceSidebar';
import TodayPage from '../workspace/TodayPage';
import IssueWorkspacePage from '../workspace/IssueWorkspacePage';
import RepoLensPage from '../workspace/RepoLensPage';
import DashboardPage from './DashboardPage';
import PRManagementPage from './PRManagementPage';
import Settings from '../Settings';
import { IssueDetailPage } from './issue-detail';
import AIDisabledBanner from '../settings/AIDisabledBanner';

/**
 * Maintainer workspace: today (what waits on you), triage inbox, PRs, repo lens.
 * The generic AI chatbot, hub (hype/cookie-licking/mentors) and profile pages are
 * no longer part of the workspace.
 */
const MaintainerLayout = () => (
  <div className="w-full h-screen bg-[hsl(220,13%,5%)] flex overflow-hidden">
    <WorkspaceSidebar />
    <div className="flex-1 overflow-hidden flex flex-col">
      <AIDisabledBanner />
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route index element={<TodayPage />} />
          <Route path="inbox" element={<DashboardPage />} />
          <Route path="prs" element={<PRManagementPage />} />
          <Route path="issue/:issueId" element={<IssueDetailPage />} />
          <Route path="work/:owner/:repo/:number" element={<IssueWorkspacePage />} />
          <Route path="lens" element={<RepoLensPage />} />
          <Route path="lens/:owner/:repo" element={<RepoLensPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<TodayPage />} />
        </Routes>
      </div>
    </div>
  </div>
);

export default MaintainerLayout;
