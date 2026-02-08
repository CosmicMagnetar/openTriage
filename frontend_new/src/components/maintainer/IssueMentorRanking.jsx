import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Code2, MessageSquare, RefreshCw, AlertCircle, UserPlus, Loader } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const IssueMentorRanking = ({ issue }) => {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState(null);

  useEffect(() => {
    if (issue) {
      loadMentorsForIssue();
    }
  }, [issue]);

  const loadMentorsForIssue = async () => {
    setLoading(true);
    try {
      const authToken = localStorage.getItem('token');
      
      if (!authToken) {
        console.warn('No auth token found - user not authenticated');
        setMentors([]);
        return;
      }

      console.log('Fetching leaderboard from:', `${BACKEND_API}/leaderboard`);
      
      try {
        // Try to get the real leaderboard through TypeScript backend proxy
        const response = await axios.get(`${BACKEND_API}/leaderboard?limit=100`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        console.log('Leaderboard response:', response.data);

        let rankedMentors = response.data.entries || [];

        // Filter by language relevance if we can detect it from the issue
        if (issue.repoName || issue.codeSnippets) {
          // Keep all mentors but sort by current ranking
          rankedMentors = rankedMentors
            .sort((a, b) => b.overall_score - a.overall_score)
            .slice(0, 5); // Top 5 mentors
        }

        console.log('Ranked mentors:', rankedMentors);
        setMentors(rankedMentors);
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('Main leaderboard endpoint not available. Trying test endpoint...');
          // Fallback to test data if main endpoint not deployed
          const testResponse = await axios.get(`${BACKEND_API}/leaderboard/test`);
          console.log('Using test leaderboard data:', testResponse.data);
          setMentors(testResponse.data.entries || []);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error loading mentors:', error);
      
      if (error.response?.status === 401) {
        console.warn('Not authenticated - cannot fetch mentors');
      } else {
        console.error('Make sure backend is deployed and AI engine is running');
      }
      setMentors([]);
    } finally {
      setLoading(false);
    }
  };

  const assignMentorToIssue = async (mentor) => {
    if (!issue.owner || !issue.repo || !issue.number) {
      toast.error('Missing required issue information');
      return;
    }

    setAssigningId(mentor.mentor_id);
    try {
      // Call backend to assign via GitHub API
      const response = await axios.post(
        `${BACKEND_API}/issues/${issue.id}/assign`,
        {
          assignee: mentor.mentor_username,
          owner: issue.owner,
          repo: issue.repo,
          number: issue.number,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      toast.success(
        <div>
          <p>✅ Assigned {mentor.mentor_username} to {issue.isPR ? 'PR' : 'Issue'} #{issue.number}</p>
          {response.data.url && (
            <a
              href={response.data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(217,91%,65%)] underline text-sm"
            >
              View on GitHub →
            </a>
          )}
        </div>
      );
    } catch (error) {
      console.error('Error assigning mentor:', error);
      
      const errorMsg = error.response?.data?.message || error.message || 'Failed to assign';
      toast.error(`Assignment failed: ${errorMsg}`);
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="mt-6 p-4 bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="text-yellow-500" size={20} />
        <h3 className="font-semibold text-[hsl(210,11%,90%)]">Top Mentors for This Issue</h3>
        <button
          onClick={loadMentorsForIssue}
          disabled={loading}
          className="ml-auto p-1 hover:bg-[hsl(220,13%,20%)] rounded transition"
          title="Refresh rankings"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-[hsl(210,11%,50%)]">
          <RefreshCw className="animate-spin inline-block mr-2" size={16} />
          Loading mentor rankings...
        </div>
      ) : mentors.length === 0 ? (
        <div className="text-center py-4 text-[hsl(210,11%,50%)]">
          <AlertCircle className="inline-block mr-2" size={16} />
          No mentor data available. The leaderboard endpoint may not be deployed yet, or no mentor conversations exist.
        </div>
      ) : (
        <div className="space-y-3">
          {mentors.map((mentor, idx) => (
            <div
              key={mentor.mentor_id}
              className="flex items-center justify-between p-3 bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded hover:border-[hsl(142,70%,45%,0.3)] transition"
            >
              {/* Rank & Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-lg font-bold text-yellow-500 w-6 text-center">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[hsl(210,11%,90%)] truncate">
                    {mentor.mentor_username}
                  </p>
                  {mentor.best_language && (
                    <p className="text-xs text-[hsl(210,11%,50%)]">
                      Expert in: <span className="text-[hsl(217,91%,65%)]">{mentor.best_language}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Scores */}
              <div className="flex items-center gap-4 text-sm">
                {/* Overall Score */}
                <div className="flex flex-col items-center">
                  <div
                    className={`font-bold text-lg ${
                      mentor.overall_score >= 80
                        ? 'text-green-400'
                        : mentor.overall_score >= 60
                        ? 'text-blue-400'
                        : 'text-yellow-400'
                    }`}
                  >
                    {mentor.overall_score.toFixed(0)}
                  </div>
                  <span className="text-xs text-[hsl(210,11%,50%)]">Overall</span>
                </div>

                {/* Sentiment */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    <MessageSquare size={14} className="text-purple-400" />
                    <span className="font-semibold text-[hsl(210,11%,90%)]">
                      {mentor.sentiment_score.toFixed(0)}
                    </span>
                  </div>
                  <span className="text-xs text-[hsl(210,11%,50%)]">Sentiment</span>
                </div>

                {/* Expertise */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    <Code2 size={14} className="text-blue-400" />
                    <span className="font-semibold text-[hsl(210,11%,90%)]">
                      {mentor.expertise_score.toFixed(0)}
                    </span>
                  </div>
                  <span className="text-xs text-[hsl(210,11%,50%)]">Expertise</span>
                </div>

                {/* Engagement */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={14} className="text-green-400" />
                    <span className="font-semibold text-[hsl(210,11%,90%)]">
                      {mentor.total_sessions}
                    </span>
                  </div>
                  <span className="text-xs text-[hsl(210,11%,50%)]">Sessions</span>
                </div>

                {/* Assign Button */}
                <button
                  onClick={() => assignMentorToIssue(mentor)}
                  disabled={assigningId === mentor.mentor_id}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,55%)] disabled:bg-[hsl(220,13%,20%)] disabled:text-[hsl(210,11%,40%)] text-black rounded-lg text-sm font-medium transition-colors"
                  title={`Assign ${mentor.mentor_username} to this ${issue.isPR ? 'PR' : 'Issue'}`}
                >
                  {assigningId === mentor.mentor_id ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  {assigningId === mentor.mentor_id ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[hsl(210,11%,40%)] mt-3 p-2 bg-[hsl(220,13%,8%)] rounded">
        💡 Tip: Mentors ranked by sentiment quality (35%), expertise (40%), and engagement (25%).
        Click "Assign" to directly assign a mentor to this {issue.isPR ? 'PR' : 'Issue'} via GitHub.
        <br />
        <span className="text-[hsl(210,11%,35%)] text-xs mt-1 inline-block">
          {!issue.owner ? '⚠️ Issue data incomplete' : 'Ready to assign'}
        </span>
      </p>
    </div>
  );
};

export default IssueMentorRanking;
