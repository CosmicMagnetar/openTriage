import React, { useState, useEffect } from 'react';
import { Users, RefreshCw, AlertCircle, UserPlus, Loader, X, Check } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const IssueContributors = ({ issue }) => {
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [savingAssignees, setSavingAssignees] = useState(false);

  useEffect(() => {
    if (issue?.owner && issue?.repo && issue?.number) {
      loadContributors();
      loadAssignees();
    }
  }, [issue]);

  const loadContributors = async () => {
    setLoading(true);
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        console.warn('No auth token');
        return;
      }

      console.log(`Fetching contributors for ${issue.owner}/${issue.repo}#${issue.number}`);

      const response = await axios.get(
        `${BACKEND_API}/github/issues/${issue.owner}/${issue.repo}/${issue.number}/comments`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      // Extract unique contributors from comments
      const uniqueContributors = {};
      const comments = response.data || [];

      comments.forEach((comment) => {
        if (comment.user?.login) {
          uniqueContributors[comment.user.login] = {
            username: comment.user.login,
            avatar: comment.user.avatar_url,
            comments: (uniqueContributors[comment.user.login]?.comments || 0) + 1,
          };
        }
      });

      const contributorsList = Object.values(uniqueContributors).sort(
        (a, b) => b.comments - a.comments
      );

      console.log('Contributors:', contributorsList);
      setContributors(contributorsList);
    } catch (error) {
      console.error('Error loading contributors:', error);
      setContributors([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignees = async () => {
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) return;

      // Get current assignees from issue data if available
      if (issue?.assignees) {
        setAssignees(
          Array.isArray(issue.assignees)
            ? issue.assignees.map((a) => (typeof a === 'string' ? a : a.login))
            : []
        );
      }
    } catch (error) {
      console.error('Error loading assignees:', error);
    }
  };

  const toggleAssignee = (username) => {
    setAssignees((prev) =>
      prev.includes(username) ? prev.filter((a) => a !== username) : [...prev, username]
    );
  };

  const saveAssignees = async () => {
    setSavingAssignees(true);
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        toast.error('Not authenticated');
        return;
      }

      console.log(`Saving assignees for ${issue.owner}/${issue.repo}#${issue.number}:`, assignees);

      // Update via GitHub API endpoint
      const response = await axios.post(
        `${BACKEND_API}/issues/${issue.id}/assign-multiple`,
        {
          assignees: assignees,
          owner: issue.owner,
          repo: issue.repo,
          number: issue.number,
          isPR: issue.isPR,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      toast.success(`✅ Updated ${assignees.length} assignee(s)`);
      console.log('Assignment result:', response.data);
    } catch (error) {
      console.error('Error saving assignees:', error);
      toast.error(`Failed to save: ${error.response?.data?.message || error.message}`);
    } finally {
      setSavingAssignees(false);
    }
  };

  if (!issue?.owner || !issue?.repo || !issue?.number) {
    return null;
  }

  return (
    <div className="mt-6 p-4 bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-blue-400" size={20} />
        <h3 className="font-semibold text-[hsl(210,11%,90%)]">
          Issue Contributors & Assignees
        </h3>
        <button
          onClick={loadContributors}
          disabled={loading}
          className="ml-auto p-1 hover:bg-[hsl(220,13%,20%)] rounded transition"
          title="Refresh contributors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-[hsl(210,11%,50%)]">
          <RefreshCw className="animate-spin inline-block mr-2" size={16} />
          Loading contributors...
        </div>
      ) : contributors.length === 0 ? (
        <div className="text-center py-4 text-[hsl(210,11%,50%)]">
          <AlertCircle className="inline-block mr-2" size={16} />
          No contributors found. This issue may not have any comments yet.
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {contributors.map((contributor) => (
              <div
                key={contributor.username}
                className="flex items-center justify-between p-3 bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded hover:border-[hsl(142,70%,45%,0.3)] transition"
              >
                <div className="flex items-center gap-3 flex-1">
                  {contributor.avatar && (
                    <img
                      src={contributor.avatar}
                      alt={contributor.username}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium text-[hsl(210,11%,90%)]">
                      {contributor.username}
                    </p>
                    <p className="text-xs text-[hsl(210,11%,50%)]">
                      {contributor.comments} comment{contributor.comments !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => toggleAssignee(contributor.username)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    assignees.includes(contributor.username)
                      ? 'bg-[hsl(142,70%,45%)] text-black'
                      : 'bg-[hsl(220,13%,15%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,20%)]'
                  }`}
                  title={
                    assignees.includes(contributor.username)
                      ? `Remove ${contributor.username} from assignees`
                      : `Add ${contributor.username} to assignees`
                  }
                >
                  {assignees.includes(contributor.username) ? (
                    <Check size={14} className="inline mr-1" />
                  ) : (
                    <UserPlus size={14} className="inline mr-1" />
                  )}
                  {assignees.includes(contributor.username) ? 'Assigned' : 'Assign'}
                </button>
              </div>
            ))}
          </div>

          {assignees.length > 0 && (
            <div className="mt-4 p-3 bg-[hsl(220,13%,8%)] border border-[hsl(142,70%,45%,0.3)] rounded">
              <p className="text-sm text-[hsl(210,11%,70%)] mb-2">
                Selected assignees ({assignees.length}):
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {assignees.map((username) => (
                  <span
                    key={username}
                    className="px-2 py-1 bg-[hsl(142,70%,45%,0.15)] border border-[hsl(142,70%,45%,0.3)] text-[hsl(142,70%,55%)] rounded text-sm flex items-center gap-1"
                  >
                    {username}
                    <button
                      onClick={() => toggleAssignee(username)}
                      className="hover:text-[hsl(142,70%,65%)]"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              <button
                onClick={saveAssignees}
                disabled={savingAssignees}
                className="w-full px-4 py-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,55%)] disabled:bg-[hsl(220,13%,20%)] disabled:text-[hsl(210,11%,40%)] text-black rounded-lg font-medium transition-colors"
              >
                {savingAssignees ? (
                  <>
                    <Loader size={14} className="animate-spin inline mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Assignees'
                )}
              </button>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-[hsl(210,11%,40%)] mt-3 p-2 bg-[hsl(220,13%,8%)] rounded">
        💡 Tip: Select contributors from this issue and click "Save Assignees" to update
        assignments on GitHub. You can select multiple contributors.
      </p>
    </div>
  );
};

export default IssueContributors;
