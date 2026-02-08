import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Code2, MessageSquare, RefreshCw, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE = `${import.meta.env.VITE_AI_ENGINE_URL || 'http://localhost:7860'}`;

const IssueMentorRanking = ({ issue }) => {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (issue) {
      loadMentorsForIssue();
    }
  }, [issue]);

  const loadMentorsForIssue = async () => {
    setLoading(true);
    try {
      const apiKey = localStorage.getItem('api_key') || '';
      
      // Get the full leaderboard
      const response = await axios.get(`${API_BASE}/leaderboard?limit=100`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      let rankedMentors = response.data.entries || [];

      // Filter by language relevance if we can detect it from the issue
      if (issue.repoName || issue.codeSnippets) {
        // Keep all mentors but sort by current ranking
        rankedMentors = rankedMentors
          .sort((a, b) => b.overall_score - a.overall_score)
          .slice(0, 5); // Top 5 mentors
      }

      setMentors(rankedMentors);
    } catch (error) {
      console.error('Error loading mentors:', error);
      setMentors([]);
    } finally {
      setLoading(false);
    }
  };

  if (!mentors || mentors.length === 0) return null;

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
          Loading rankings...
        </div>
      ) : mentors.length === 0 ? (
        <div className="text-center py-4 text-[hsl(210,11%,50%)]">
          <AlertCircle className="inline-block mr-2" size={16} />
          No mentors available
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
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[hsl(210,11%,40%)] mt-3 p-2 bg-[hsl(220,13%,8%)] rounded">
        💡 Tip: Mentors ranked by sentiment quality (35%), expertise (40%), and engagement (25%).
        Consider mentioning the top-ranked mentor for faster, higher-quality guidance.
      </p>
    </div>
  );
};

export default IssueMentorRanking;
