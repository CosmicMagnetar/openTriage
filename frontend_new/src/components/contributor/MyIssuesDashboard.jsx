import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ParticipantIssueCard from './ParticipantIssueCard';
import OpportunitiesPanel from './OpportunitiesPanel';
import OrganizationsPanel from './OrganizationsPanel';
import { FileQuestion, RefreshCw, TrendingUp, GitPullRequest, AlertCircle, ChevronDown, ArrowUpDown, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 10;

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const MyIssuesDashboard = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [showOrganizations, setShowOrganizations] = useState(false);

  // Filtering, sorting, and pagination state
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'prs', 'issues'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'repo'
  const [selectedRepo, setSelectedRepo] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadDashboardData();

    // Auto-fetch data every 30 seconds
    const intervalId = setInterval(() => {
      loadDashboardData(true); // Pass true to indicate auto-sync
    }, 30000); // 30 seconds

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Reload when page changes
  useEffect(() => {
    loadDashboardData();
  }, [currentPage]);

  const loadDashboardData = async (isAutoSync = false) => {
    if (!isAutoSync) {
      setLoading(true);
    } else {
      setAutoSyncing(true);
    }

    try {
      // Fetch both issues (with pagination) and dashboard summary
      const [issuesResponse, statsResponse] = await Promise.all([
        axios.get(`${API}/contributor/my-issues`, {
          params: { page: currentPage, limit: ITEMS_PER_PAGE }
        }),
        axios.get(`${API}/contributor/dashboard-summary`)
      ]);

      // Backend returns { items, total, page, pages, limit }
      const { items, total, pages } = issuesResponse.data;
      setIssues(items || []);
      setTotalItems(total || 0);
      setTotalPages(pages || 1);
      setDashboardStats(statsResponse.data);

      if ((items || []).length === 0 && !isAutoSync && currentPage === 1) {
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

  // Client-side filtering/sorting still works - pagination is handled by backend
  // paginatedIssues is now just the filtered/sorted issues (already paginated from backend)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, selectedRepo, sortBy]);

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
          <div className="animate-spin w-12 h-12 border-4 border-[hsl(142,70%,45%)] border-t-transparent rounded-full" />
          <p className="text-[hsl(210,11%,50%)]">Loading your contributions...</p>
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
            <h1 className="text-4xl font-bold text-[hsl(210,11%,90%)] mb-2 flex items-center gap-3">
              My Contributions
              {autoSyncing && (
                <span className="text-xs bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] px-3 py-1 rounded-full border border-[hsl(142,70%,45%,0.25)] flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing...
                </span>
              )}
            </h1>
            <p className="text-[hsl(210,11%,50%)]">
              Track your issues and pull requests across all repositories • Auto-syncs every 30s
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadIssues}
              className="bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,18%)] text-white px-4 py-3 rounded-lg font-medium transition-all duration-300 active:scale-[0.98] border border-[hsl(220,13%,18%)]"
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
              className="bg-[hsl(217,91%,50%)] hover:bg-[hsl(217,91%,55%)] text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-300 active:scale-[0.98]"
            >
              <Building2 className="w-5 h-5" />
              Organizations
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
          <div className="bg-[hsl(220,13%,8%)] rounded-xl p-12 text-center border border-[hsl(220,13%,15%)]">
            <FileQuestion className="w-16 h-16 text-[hsl(220,13%,20%)] mx-auto mb-4" />
            <p className="text-[hsl(210,11%,50%)] mb-2">No contributions found yet</p>
            <p className="text-sm text-[hsl(210,11%,40%)] mb-4">
              Start contributing to open source projects!
            </p>
            <button
              onClick={() => setShowOpportunities(true)}
              className="bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black px-6 py-3 rounded-lg font-medium transition-all duration-300"
            >
              Explore Opportunities
            </button>
          </div>
        ) : (
          <div>
            {/* Filter and Sort Controls */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-4">
              <h2 className="text-2xl font-bold text-[hsl(210,11%,90%)]">Your Issues & PRs</h2>

              <div className="flex flex-wrap items-center gap-3">
                {/* Type Filter Buttons */}
                <div className="flex gap-2">
                  <button
                    data-testid="filter-all"
                    onClick={() => setActiveFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'all'
                      ? 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.25)]'
                      : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,50%)] border border-[hsl(220,13%,18%)] hover:border-[hsl(142,70%,45%)]'
                      }`}
                  >
                    All ({stats.totalContributions})
                  </button>
                  <button
                    data-testid="filter-prs"
                    onClick={() => setActiveFilter('prs')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'prs'
                      ? 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.25)]'
                      : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,50%)] border border-[hsl(220,13%,18%)] hover:border-[hsl(142,70%,45%)]'
                      }`}
                  >
                    PRs ({stats.totalPRs})
                  </button>
                  <button
                    data-testid="filter-issues"
                    onClick={() => setActiveFilter('issues')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'issues'
                      ? 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.25)]'
                      : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,50%)] border border-[hsl(220,13%,18%)] hover:border-[hsl(142,70%,45%)]'
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
                    className="appearance-none bg-[hsl(220,13%,10%)] text-[hsl(210,11%,75%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:border-[hsl(142,70%,45%)] transition-all cursor-pointer"
                  >
                    <option value="all">All Repositories</option>
                    {repositories.map(repo => (
                      <option key={repo} value={repo}>{repo}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(210,11%,50%)] pointer-events-none" />
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <select
                    data-testid="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-[hsl(220,13%,10%)] text-[hsl(210,11%,75%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:border-[hsl(142,70%,45%)] transition-all cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="repo">By Repository</option>
                  </select>
                  <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(210,11%,50%)] pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Filtered Results Count */}
            {(activeFilter !== 'all' || selectedRepo !== 'all' || totalPages > 1) && (
              <div className="mb-4 text-sm text-[hsl(210,11%,50%)]">
                Showing {filteredAndSortedIssues.length} of {totalItems} items
                {selectedRepo !== 'all' && <span> in <span className="text-[hsl(142,70%,55%)]">{selectedRepo}</span></span>}
                {totalPages > 1 && <span> • Page {currentPage} of {totalPages}</span>}
              </div>
            )}

            {/* Issues Grid */}
            <div className="grid gap-4">
              {filteredAndSortedIssues.length > 0 ? (
                filteredAndSortedIssues.map((issue) => (
                  <ParticipantIssueCard key={issue.id} issue={issue} />
                ))
              ) : (
                <div className="bg-[hsl(220,13%,8%)] rounded-xl p-8 text-center border border-[hsl(220,13%,15%)]">
                  <p className="text-[hsl(210,11%,50%)]">No items match your current filters</p>
                  <button
                    onClick={() => { setActiveFilter('all'); setSelectedRepo('all'); }}
                    className="mt-3 text-sm text-[hsl(142,70%,55%)] hover:text-[hsl(142,70%,65%)] transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,15%)] hover:text-[hsl(210,11%,80%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${currentPage === pageNum
                          ? 'bg-[hsl(142,70%,45%)] text-black'
                          : 'bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,15%)]'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,15%)] hover:text-[hsl(210,11%,80%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
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
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    emerald: 'bg-[hsl(142,70%,45%,0.1)] border-[hsl(142,70%,45%,0.25)] text-[hsl(142,70%,55%)]',
    purple: 'bg-purple-500/10 border-purple-500/25 text-purple-400',
    blue: 'bg-[hsl(217,91%,60%,0.1)] border-[hsl(217,91%,60%,0.25)] text-[hsl(217,91%,65%)]',
    red: 'bg-red-500/10 border-red-500/25 text-red-400'
  };

  return (
    <div
      className={`bg-[hsl(220,13%,8%)] backdrop-blur-sm border rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] ${colors[color]
        }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-6 h-6" />
        <span className="text-sm font-medium text-[hsl(210,11%,50%)]">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
};

export default MyIssuesDashboard;