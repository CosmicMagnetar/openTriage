import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ParticipantIssueCard from './ParticipantIssueCard';
import OpportunitiesPanel from './OpportunitiesPanel';
import OrganizationsPanel from './OrganizationsPanel';
import ContributorAIChat from './ContributorAIChat';
import { FileQuestion, RefreshCw, TrendingUp, GitPullRequest, AlertCircle, Bot, ChevronDown, ArrowUpDown, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const MyIssuesDashboard = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [showOrganizations, setShowOrganizations] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);

  // Filtering and sorting state
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'prs', 'issues'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'repo'
  const [selectedRepo, setSelectedRepo] = useState('all');

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

  // Get unique repositories for the dropdown
  const repositories = useMemo(() => {
    const repos = [...new Set(issues.map(i => i.repoName).filter(Boolean))];
    return repos.sort();
  }, [issues]);

  // Filter and sort issues
  const filteredAndSortedIssues = useMemo(() => {
    let filtered = [...issues];

    // Apply type filter
    if (activeFilter === 'prs') {
      filtered = filtered.filter(i => i.isPR);
    } else if (activeFilter === 'issues') {
      filtered = filtered.filter(i => !i.isPR);
    }

    // Apply repository filter
    if (selectedRepo !== 'all') {
      filtered = filtered.filter(i => i.repoName === selectedRepo);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      } else if (sortBy === 'repo') {
        return (a.repoName || '').localeCompare(b.repoName || '');
      }
      return 0;
    });

    return filtered;
  }, [issues, activeFilter, sortBy, selectedRepo]);

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
              data-testid="organizations-button"
              onClick={() => setShowOrganizations(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-300 active:scale-[0.98]"
            >
              <Building2 className="w-5 h-5" />
              Organizations
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
            {/* Filter and Sort Controls */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-4">
              <h2 className="text-2xl font-bold text-slate-200">Your Issues & PRs</h2>

              <div className="flex flex-wrap items-center gap-3">
                {/* Type Filter Buttons */}
                <div className="flex gap-2">
                  <button
                    data-testid="filter-all"
                    onClick={() => setActiveFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'all'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-emerald-500'
                      }`}
                  >
                    All ({stats.totalContributions})
                  </button>
                  <button
                    data-testid="filter-prs"
                    onClick={() => setActiveFilter('prs')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'prs'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-emerald-500'
                      }`}
                  >
                    PRs ({stats.totalPRs})
                  </button>
                  <button
                    data-testid="filter-issues"
                    onClick={() => setActiveFilter('issues')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'issues'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-emerald-500'
                      }`}
                  >
                    Issues ({stats.totalIssues})
                  </button>
                </div>

                {/* Repository Filter */}
                <div className="relative">
                  <select
                    data-testid="repo-filter"
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="appearance-none bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="all">All Repositories</option>
                    {repositories.map(repo => (
                      <option key={repo} value={repo}>{repo}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <select
                    data-testid="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-slate-800 text-slate-300 border border-slate-700 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="repo">By Repository</option>
                  </select>
                  <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Filtered Results Count */}
            {(activeFilter !== 'all' || selectedRepo !== 'all') && (
              <div className="mb-4 text-sm text-slate-400">
                Showing {filteredAndSortedIssues.length} of {issues.length} items
                {selectedRepo !== 'all' && <span> in <span className="text-emerald-400">{selectedRepo}</span></span>}
              </div>
            )}

            {/* Issues Grid */}
            <div className="grid gap-4">
              {filteredAndSortedIssues.length > 0 ? (
                filteredAndSortedIssues.map((issue) => (
                  <ParticipantIssueCard key={issue.id} issue={issue} />
                ))
              ) : (
                <div className="bg-slate-800/50 rounded-xl p-8 text-center">
                  <p className="text-slate-400">No items match your current filters</p>
                  <button
                    onClick={() => { setActiveFilter('all'); setSelectedRepo('all'); }}
                    className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Opportunities Panel */}
      {showOpportunities && (
        <OpportunitiesPanel onClose={() => setShowOpportunities(false)} />
      )}

      {/* Organizations Panel */}
      {showOrganizations && (
        <OrganizationsPanel
          onClose={() => setShowOrganizations(false)}
          contributedRepos={[...new Set(issues.map(i => i.repoName).filter(Boolean))]}
        />
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