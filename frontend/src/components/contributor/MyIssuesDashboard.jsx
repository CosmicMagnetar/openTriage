import { useEffect, useState } from 'react';
import axios from 'axios';
import ParticipantIssueCard from './ParticipantIssueCard';
import OpportunitiesPanel from './OpportunitiesPanel';
import ContributorAIChat from './ContributorAIChat';
import { FileQuestion, RefreshCw, TrendingUp, GitPullRequest, AlertCircle, Bot } from 'lucide-react';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const MyIssuesDashboard = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);

  useEffect(() => {
    loadDashboardData();

    // Auto-fetch data every 30 seconds
    const intervalId = setInterval(() => {
      loadDashboardData(true); // Pass true to indicate auto-sync
    }, 30000); // 30 seconds

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  const loadDashboardData = async (isAutoSync = false) => {
    if (!isAutoSync) {
      setLoading(true);
    } else {
      setAutoSyncing(true);
    }

    try {
      // Fetch both issues and dashboard summary
      const [issuesResponse, statsResponse] = await Promise.all([
        axios.get(`${API}/contributor/my-issues`),
        axios.get(`${API}/contributor/dashboard-summary`)
      ]);

      setIssues(issuesResponse.data);
      setDashboardStats(statsResponse.data);

      if (issuesResponse.data.length === 0 && !isAutoSync) {
        toast.info('Fetching your issues from GitHub...');
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (!isAutoSync) {
        toast.error('Failed to load dashboard data');
      }
      setIssues([]);
    } finally {
      if (!isAutoSync) {
        setLoading(false);
      } else {
        setAutoSyncing(false);
      }
    }
  };

  const loadIssues = async () => {
    await loadDashboardData();
  };

  const stats = dashboardStats || {
    totalContributions: issues.length,
    totalPRs: issues.filter(i => i.isPR).length,
    openPRs: issues.filter(i => i.isPR && i.state === 'open').length,
    mergedPRs: issues.filter(i => i.isPR && i.state === 'closed').length,
    totalIssues: issues.filter(i => !i.isPR).length,
    openIssues: issues.filter(i => !i.isPR && i.state === 'open').length,
    closedIssues: issues.filter(i => !i.isPR && i.state === 'closed').length,
    repositoriesContributed: 0
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full" />
          <p className="text-slate-400">Loading your contributions...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="contributor-dashboard" className="w-full h-full overflow-auto p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-200 mb-2 flex items-center gap-3">
              My Contributions
              {autoSyncing && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing...
                </span>
              )}
            </h1>
            <p className="text-slate-400">
              Track your issues and pull requests across all repositories • Auto-syncs every 30s
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadIssues}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-medium transition-all duration-300 active:scale-[0.98]"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              data-testid="opportunities-button"
              onClick={() => setShowOpportunities(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-300 active:scale-[0.98]"
            >
              <TrendingUp className="w-5 h-5" />
              Opportunities
            </button>
            <button
              data-testid="ai-assistant-button"
              onClick={() => setShowChat(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-300 active:scale-[0.98]"
            >
              <Bot className="w-5 h-5" />
              AI Assistant
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={FileQuestion}
            label="Total Contributions"
            value={stats.totalContributions}
            color="emerald"
          />
          <StatCard
            icon={GitPullRequest}
            label="Open PRs"
            value={stats.openPRs}
            color="purple"
          />
          <StatCard
            icon={GitPullRequest}
            label="Merged PRs"
            value={stats.mergedPRs}
            color="blue"
          />
          <StatCard
            icon={AlertCircle}
            label="Repositories"
            value={stats.repositoriesContributed}
            color="red"
          />
        </div>

        {/* Issues List */}
        {issues.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-12 text-center">
            <FileQuestion className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No contributions found yet</p>
            <p className="text-sm text-slate-500 mb-4">
              Start contributing to open source projects!
            </p>
            <button
              onClick={() => setShowOpportunities(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300"
            >
              Explore Opportunities
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-slate-200">Your Issues & PRs</h2>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium">
                  All ({stats.totalContributions})
                </button>
                <button className="px-4 py-2 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-sm font-medium hover:border-emerald-500 transition-all">
                  PRs ({stats.totalPRs})
                </button>
                <button className="px-4 py-2 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-sm font-medium hover:border-emerald-500 transition-all">
                  Issues ({stats.totalIssues})
                </button>
              </div>
            </div>
            <div className="grid gap-4">
              {issues.map((issue) => (
                <ParticipantIssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Opportunities Panel */}
      {showOpportunities && (
        <OpportunitiesPanel onClose={() => setShowOpportunities(false)} />
      )}

      {/* AI Chat */}
      {showChat && (
        <ContributorAIChat
          onClose={() => setShowChat(false)}
          issues={issues}
        />
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400'
  };

  return (
    <div
      className={`bg-slate-800/80 backdrop-blur-sm border rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] ${colors[color]
        }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-6 h-6" />
        <span className="text-sm font-medium text-slate-400">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
};

export default MyIssuesDashboard;