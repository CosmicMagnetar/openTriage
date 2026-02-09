import { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Users, TrendingUp, RefreshCw, Code, MessageSquare,
  ThumbsUp, ThumbsDown, Minus, ChevronDown, ChevronUp, UserPlus,
  Loader2
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const sentimentConfig = {
  POSITIVE: { icon: ThumbsUp, color: 'text-[hsl(142,70%,55%)]', bg: 'bg-[hsl(142,70%,45%,0.12)]' },
  NEUTRAL:  { icon: Minus,    color: 'text-[hsl(217,91%,65%)]', bg: 'bg-[hsl(217,91%,60%,0.12)]' },
  NEGATIVE: { icon: ThumbsDown, color: 'text-red-400', bg: 'bg-red-500/10' },
};

const rankBadge = (rank) => {
  if (rank === 1) return { emoji: '🥇', color: 'text-yellow-400' };
  if (rank === 2) return { emoji: '🥈', color: 'text-gray-300' };
  if (rank === 3) return { emoji: '🥉', color: 'text-amber-600' };
  return { emoji: `#${rank}`, color: 'text-[hsl(210,11%,45%)]' };
};

/**
 * AI-powered contributor ranking widget.
 * Fetches comments → runs batch sentiment via AI engine → fetches GitHub languages → ranks.
 * Score = Sentiment (40%) + Engagement (30%) + Language Match (30%)
 */
const MaintainerLeaderboardWidget = ({ issue, onAssign }) => {
  const [rankings, setRankings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [repoLanguage, setRepoLanguage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchRankings = useCallback(async () => {
    if (!issue?.id) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/maintainer/issues/${issue.id}/rankings`);
      setRankings(response.data.rankings || []);
      setSummary(response.data.summary || null);
      setRepoLanguage(response.data.repoLanguage || null);
      setHasLoaded(true);
    } catch (err) {
      console.error('Failed to fetch rankings:', err);
      if (hasLoaded) toast.error('Failed to refresh rankings');
    } finally {
      setLoading(false);
    }
  }, [issue?.id, hasLoaded]);

  useEffect(() => {
    if (issue?.id && issue?.owner && issue?.repo) {
      fetchRankings();
    }
  }, [issue?.id]);

  const toggleExpand = (username) => {
    setExpandedUser(expandedUser === username ? null : username);
  };

  return (
    <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-semibold text-[hsl(210,11%,85%)]">Contributor Rankings</h3>
          {rankings.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[hsl(220,13%,15%)] text-[hsl(210,11%,55%)] rounded-full">
              {rankings.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchRankings}
          disabled={loading}
          className="p-1.5 text-[hsl(210,11%,45%)] hover:text-[hsl(210,11%,70%)] hover:bg-[hsl(220,13%,12%)] rounded transition-colors disabled:opacity-50"
          title="Re-analyze with AI"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Repo language badge */}
      {repoLanguage && (
        <div className="px-4 py-2 border-b border-[hsl(220,13%,12%)] flex items-center gap-2">
          <Code className="w-3 h-3 text-[hsl(217,91%,60%)]" />
          <span className="text-[10px] text-[hsl(210,11%,50%)]">
            Repo language: <span className="text-[hsl(217,91%,65%)] font-medium">{repoLanguage}</span>
          </span>
        </div>
      )}

      {/* Body */}
      <div className="p-3">
        {loading && !hasLoaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[hsl(217,91%,60%)] animate-spin mr-2" />
            <span className="text-xs text-[hsl(210,11%,50%)]">Analyzing with AI...</span>
          </div>
        ) : rankings.length === 0 ? (
          <div className="text-center py-6">
            <Users className="w-8 h-8 text-[hsl(210,11%,20%)] mx-auto mb-2" />
            <p className="text-xs text-[hsl(210,11%,45%)] mb-1">No contributors found</p>
            <p className="text-[10px] text-[hsl(210,11%,35%)]">
              Contributors will be ranked once they comment on this {issue?.isPR ? 'PR' : 'issue'}.
            </p>
          </div>
        ) : (
          <>
            {/* Conversation summary */}
            {summary && (
              <div className={`mb-3 p-2.5 rounded-lg border ${
                summary.overall_sentiment === 'POSITIVE'
                  ? 'bg-[hsl(142,70%,45%,0.06)] border-[hsl(142,70%,45%,0.15)]'
                  : summary.overall_sentiment === 'NEGATIVE'
                  ? 'bg-red-500/5 border-red-500/15'
                  : 'bg-[hsl(217,91%,60%,0.06)] border-[hsl(217,91%,60%,0.12)]'
              }`}>
                <p className="text-[10px] uppercase tracking-wider text-[hsl(210,11%,45%)] mb-1">Conversation Mood</p>
                <p className="text-xs text-[hsl(210,11%,70%)]">{summary.mood_description || summary.overall_sentiment}</p>
              </div>
            )}

            {/* Rankings */}
            <div className="space-y-1">
              {rankings.map((c) => {
                const badge = rankBadge(c.rank);
                const sentCfg = sentimentConfig[c.sentimentLabel] || sentimentConfig.NEUTRAL;
                const SentIcon = sentCfg.icon;
                const isExpanded = expandedUser === c.username;

                return (
                  <div key={c.username}>
                    <button
                      onClick={() => toggleExpand(c.username)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[hsl(220,13%,10%)] transition-colors text-left"
                    >
                      <span className={`text-xs font-bold w-6 text-center shrink-0 ${badge.color}`}>
                        {badge.emoji}
                      </span>
                      <img
                        src={c.avatar}
                        alt={c.username}
                        className="w-7 h-7 rounded-full ring-1 ring-[hsl(220,13%,18%)] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-[hsl(210,11%,82%)] truncate font-medium">{c.username}</p>
                          {c.topLanguage && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-[hsl(220,13%,14%)] text-[hsl(210,11%,55%)] rounded shrink-0">
                              {c.topLanguage}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[hsl(210,11%,45%)] flex items-center gap-0.5">
                            <MessageSquare className="w-2.5 h-2.5" />{c.commentCount}
                          </span>
                          <SentIcon className={`w-3 h-3 ${sentCfg.color}`} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-bold text-[hsl(142,70%,55%)]">{c.overallScore}</p>
                          <p className="text-[9px] text-[hsl(210,11%,40%)]">score</p>
                        </div>
                        {isExpanded
                          ? <ChevronUp className="w-3 h-3 text-[hsl(210,11%,40%)]" />
                          : <ChevronDown className="w-3 h-3 text-[hsl(210,11%,40%)]" />}
                      </div>
                    </button>

                    {/* Expanded breakdown */}
                    {isExpanded && (
                      <div className="ml-8 mr-2 mb-2 p-3 bg-[hsl(220,13%,6%)] border border-[hsl(220,13%,12%)] rounded-lg space-y-2.5">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-[hsl(210,11%,40%)]">Sentiment</p>
                            <p className={`text-sm font-semibold ${sentCfg.color}`}>{c.sentimentScore}%</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-[hsl(210,11%,40%)]">Engagement</p>
                            <p className="text-sm font-semibold text-[hsl(217,91%,65%)]">{c.engagementScore}%</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-[hsl(210,11%,40%)]">Lang Match</p>
                            <p className="text-sm font-semibold text-purple-400">{c.languageScore}%</p>
                          </div>
                        </div>

                        {c.languages?.length > 0 && (
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-1">Languages</p>
                            <div className="flex flex-wrap gap-1">
                              {c.languages.map((lang) => (
                                <span
                                  key={lang}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                    repoLanguage && lang.toLowerCase() === repoLanguage.toLowerCase()
                                      ? 'bg-[hsl(142,70%,45%,0.12)] text-[hsl(142,70%,55%)] border-[hsl(142,70%,45%,0.3)]'
                                      : 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,55%)] border-[hsl(220,13%,18%)]'
                                  }`}
                                >
                                  {lang}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-1">Communication</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${sentCfg.bg} ${sentCfg.color} font-medium`}>
                            {c.prominentLanguage || 'neutral'}
                          </span>
                        </div>

                        {issue?.state === 'open' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onAssign?.(c.username); }}
                            className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[hsl(142,70%,45%,0.12)] hover:bg-[hsl(142,70%,45%,0.2)] text-[hsl(142,70%,55%)] rounded-lg text-xs font-medium transition-colors border border-[hsl(142,70%,45%,0.2)]"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Assign to this {issue?.isPR ? 'PR' : 'issue'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-[hsl(220,13%,12%)]">
              <p className="text-[9px] text-[hsl(210,11%,35%)] text-center">
                Score = Sentiment (40%) + Engagement (30%) + Language Match (30%)
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MaintainerLeaderboardWidget;
