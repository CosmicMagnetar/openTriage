import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle2, Clock, TrendingUp, Plus, FolderGit2, RefreshCw, ChevronLeft, ChevronRight, X, GitPullRequest } from 'lucide-react';
import IssueCard from './IssueCard';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const ITEMS_PER_PAGE = 10;

// Helper function to format relative time
const formatTimeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const DashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [issues, setIssues] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadData();
    const intervalId = setInterval(() => {
      loadData(true);
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Reload when page changes
  useEffect(() => {
    loadData();
  }, [currentPage]);

  // Reset page when repo filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRepo]);

  const loadData = async (isAutoSync = false) => {
    if (isAutoSync) {
      setAutoSyncing(true);
    }

    try {
      const [summaryRes, issuesRes, reposRes] = await Promise.all([
        axios.get(`${API}/maintainer/dashboard-summary`),
        axios.get(`${API}/maintainer/issues`, {
          params: { page: currentPage, limit: ITEMS_PER_PAGE }
        }),
        axios.get(`${API}/repositories`)
      ]);
      setSummary(summaryRes.data);

      // Handle paginated response: { items, total, page, pages, limit, lastFetchedAt }
      const issuesData = issuesRes.data;
      if (issuesData && typeof issuesData === 'object' && issuesData.items) {
        setIssues(issuesData.items || []);
        setTotalPages(issuesData.pages || 1);
        setTotalItems(issuesData.total || 0);
        if (issuesData.lastFetchedAt) {
          setLastFetchedAt(new Date(issuesData.lastFetchedAt));
        } else {
          setLastFetchedAt(new Date());
        }
      } else if (Array.isArray(issuesData)) {
        // Fallback for old API format
        setIssues(issuesData);
        setTotalPages(Math.ceil(issuesData.length / ITEMS_PER_PAGE));
        setTotalItems(issuesData.length);
        setLastFetchedAt(new Date());
      } else {
        setIssues([]);
        setTotalPages(1);
        setTotalItems(0);
        setLastFetchedAt(new Date());
      }

      setRepositories(reposRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setSummary({
        totalIssues: 0,
        pendingTriage: 0,
        criticalBugs: 0,
        avgResponseTime: 0,
        repositoriesCount: 0
      });
      setIssues([]);
      setRepositories([]);
    } finally {
      setLoading(false);
      if (isAutoSync) {
        setAutoSyncing(false);
      }
    }
  };

  // Filter by selected repo (client-side filtering on already-paginated data)
  const filteredIssues = useMemo(() => {
    if (!Array.isArray(issues)) return [];
    return selectedRepo
      ? issues.filter(issue => issue.repoId === selectedRepo)
      : issues;
  }, [issues, selectedRepo]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-[hsl(210,11%,50%)]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div data-testid="maintainer-dashboard" className="w-full h-full overflow-auto p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[hsl(210,11%,90%)] mb-2 flex items-center gap-3">
              Dashboard
              {autoSyncing && (
                <span className="text-xs bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] px-3 py-1 rounded-full border border-[hsl(142,70%,45%,0.25)] flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing...
                </span>
              )}
              {lastFetchedAt && !autoSyncing && (
                <span className="text-xs text-[hsl(210,11%,40%)] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {formatTimeAgo(lastFetchedAt)}
                </span>
              )}
            </h1>
            <p className="text-[hsl(210,11%,50%)]">Monitor and triage repository issues & PRs • Auto-syncs every 30s</p>
          </div>
          <div className="flex gap-3">
            <button
              data-testid="refresh-button"
              onClick={() => loadData()}
              className="bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,18%)] text-[hsl(210,11%,70%)] p-3 rounded-lg transition-colors border border-[hsl(220,13%,18%)]"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              data-testid="add-repo-button"
              onClick={() => setShowAddRepo(true)}
              className="bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black px-5 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Repository
            </button>
          </div>
        </div>

        {/* Summary Cards - Same layout as Contributor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={FolderGit2}
            label="Repositories"
            value={summary?.repositoriesCount || 0}
            color="purple"
          />
          <SummaryCard
            icon={AlertCircle}
            label="Total Issues"
            value={summary?.totalIssues || 0}
            color="blue"
          />
          <SummaryCard
            icon={Clock}
            label="Pending Triage"
            value={summary?.pendingTriage || 0}
            color="yellow"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Avg Response (hrs)"
            value={summary?.avgResponseTime?.toFixed(1) || '0.0'}
            color="emerald"
          />
        </div>

        {/* Repositories Filter */}
        {repositories.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-3">Filter by Repository</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRepo(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${selectedRepo === null
                  ? 'bg-[hsl(142,70%,45%,0.15)] border-[hsl(142,70%,45%,0.25)] text-[hsl(142,70%,55%)]'
                  : 'bg-[hsl(220,13%,10%)] border-[hsl(220,13%,18%)] text-[hsl(210,11%,50%)] hover:border-[hsl(142,70%,45%)]'
                  }`}
              >
                All Repositories
              </button>
              {repositories.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo.id)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors border ${selectedRepo === repo.id
                    ? 'bg-[hsl(142,70%,45%,0.15)] border-[hsl(142,70%,45%,0.25)] text-[hsl(142,70%,55%)]'
                    : 'bg-[hsl(220,13%,10%)] border-[hsl(220,13%,18%)] text-[hsl(210,11%,50%)] hover:border-[hsl(142,70%,45%)]'
                    }`}
                >
                  <FolderGit2 className="w-4 h-4 inline mr-2" />
                  {repo.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Issues & PRs Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[hsl(210,11%,90%)]">
              {selectedRepo ? 'Filtered Issues & PRs' : 'All Issues & PRs'}
            </h2>
            {totalPages > 1 && (
              <span className="text-sm text-[hsl(210,11%,50%)]">
                Showing {filteredIssues.length} of {totalItems} • Page {currentPage} of {totalPages}
              </span>
            )}
          </div>

          {filteredIssues.length === 0 ? (
            <div className="bg-[hsl(220,13%,8%)] rounded-lg p-12 text-center border border-[hsl(220,13%,15%)]">
              <AlertCircle className="w-12 h-12 text-[hsl(220,13%,20%)] mx-auto mb-4" />
              <p className="text-[hsl(210,11%,50%)] mb-4">
                {repositories.length === 0
                  ? 'No issues yet. Add a repository to start triaging!'
                  : 'No issues found. Issues are being imported in the background...'}
              </p>
              <button
                onClick={() => loadData()}
                className="text-[hsl(142,70%,55%)] hover:text-[hsl(142,70%,65%)] font-medium transition-colors"
              >
                Refresh to check
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4">
                {filteredIssues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-md bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,15%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

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
                    className="p-2 rounded-md bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,15%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Repo Modal */}
      {showAddRepo && (
        <AddRepoModal
          onClose={() => setShowAddRepo(false)}
          onSuccess={() => {
            setShowAddRepo(false);
            toast.success('Repository added! Importing issues in background...');
            setTimeout(() => loadData(), 3000);
          }}
        />
      )}
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    blue: 'border-[hsl(217,91%,60%,0.25)] text-[hsl(217,91%,65%)]',
    yellow: 'border-yellow-500/25 text-yellow-400',
    red: 'border-red-500/25 text-red-400',
    emerald: 'border-[hsl(142,70%,45%,0.25)] text-[hsl(142,70%,55%)]',
    purple: 'border-purple-500/25 text-purple-400'
  };

  return (
    <div
      data-testid={`summary-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className={`bg-[hsl(220,13%,8%)] border rounded-lg p-6 transition-colors ${colors[color]}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-5 h-5" />
        <span className="text-sm text-[hsl(210,11%,50%)]">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
};

const AddRepoModal = ({ onClose, onSuccess }) => {
  const [repoName, setRepoName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!repoName.trim() || !repoName.includes('/')) {
      toast.error('Please enter a valid repo name (e.g., facebook/react)');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/repositories`, { repoFullName: repoName });
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[hsl(210,11%,90%)]">Add GitHub Repository</h2>
          <button
            onClick={onClose}
            className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,12%)] rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[hsl(210,11%,50%)] mb-2">
              Repository (owner/repo)
            </label>
            <input
              data-testid="repo-name-input"
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="e.g., facebook/react"
              className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2.5 text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)] transition-colors"
            />
            <p className="text-xs text-[hsl(210,11%,40%)] mt-2">
              Note: Public repositories only. Issues will import in background.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,15%)] text-[hsl(210,11%,75%)] px-4 py-2.5 rounded-lg font-medium transition-colors border border-[hsl(220,13%,18%)]"
          >
            Cancel
          </button>
          <button
            data-testid="confirm-add-repo"
            onClick={handleAdd}
            disabled={loading}
            className="flex-1 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] text-black px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Adding...' : 'Add Repository'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;