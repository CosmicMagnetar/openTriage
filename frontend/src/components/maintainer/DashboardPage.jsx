import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle2, Clock, TrendingUp, Plus, FolderGit2, RefreshCw, Bot } from 'lucide-react';
import IssueCard from './IssueCard';
import AIChat from './AIChat';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;


const DashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [issues, setIssues] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [summaryRes, issuesRes, reposRes] = await Promise.all([
        axios.get(`${API}/maintainer/dashboard-summary`),
        axios.get(`${API}/maintainer/issues`),
        axios.get(`${API}/repositories`)
      ]);
      setSummary(summaryRes.data);
      setIssues(issuesRes.data);
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
    }
  };

  const filteredIssues = selectedRepo
    ? issues.filter(issue => issue.repoId === selectedRepo)
    : issues;

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div data-testid="maintainer-dashboard" className="w-full h-full overflow-auto p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-200 mb-2">
              Dashboard
            </h1>
            <p className="text-slate-400">Monitor and triage repository issues</p>
          </div>
          <div className="flex gap-3">
            <button
              data-testid="refresh-button"
              onClick={loadData}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-medium transition-all duration-300 active:scale-[0.98]"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              data-testid="ai-chat-button"
              onClick={() => setShowChat(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-300 active:scale-[0.98]"
            >
              <Bot className="w-5 h-5" />
              AI Assistant
            </button>
            <button
              data-testid="add-repo-button"
              onClick={() => setShowAddRepo(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-300 active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              Add Repository
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
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
            icon={CheckCircle2}
            label="Critical Bugs"
            value={summary?.criticalBugs || 0}
            color="red"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Avg Response (hrs)"
            value={summary?.avgResponseTime?.toFixed(1) || '0.0'}
            color="emerald"
          />
        </div>

        {/* Repositories */}
        {repositories.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-200 mb-3">Your Repositories</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRepo(null)}
                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all ${selectedRepo === null
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-blue-500'
                  }`}
              >
                All Repositories
              </button>
              {repositories.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo.id)}
                  className={`px-4 py-2 border rounded-lg text-sm transition-all ${selectedRepo === repo.id
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-blue-500'
                    }`}
                >
                  <FolderGit2 className="w-4 h-4 inline mr-2" />
                  {repo.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Issues List */}
        <div>
          <h2 className="text-2xl font-bold text-slate-200 mb-4">
            {selectedRepo ? 'Filtered Issues & PRs' : 'All Issues & PRs'}
          </h2>
          {filteredIssues.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-12 text-center">
              <p className="text-slate-400 mb-4">
                {repositories.length === 0
                  ? 'No issues yet. Add a repository to start triaging!'
                  : 'No issues found. Issues are being imported in the background...'}
              </p>
              <button
                onClick={loadData}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Refresh to check
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
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
            setTimeout(loadData, 3000);
          }}
        />
      )}

      {/* AI Chat */}
      {showChat && <AIChat onClose={() => setShowChat(false)} />}
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400'
  };

  return (
    <div
      data-testid={`summary-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-slate-200 mb-6">Add GitHub Repository</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Repository (owner/repo)
            </label>
            <input
              data-testid="repo-name-input"
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="e.g., facebook/react"
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-2">
              Note: Public repositories only. Issues will import in background.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg font-medium transition-all duration-300"
          >
            Cancel
          </button>
          <button
            data-testid="confirm-add-repo"
            onClick={handleAdd}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 active:scale-[0.98]"
          >
            {loading ? 'Adding...' : 'Add Repository'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;