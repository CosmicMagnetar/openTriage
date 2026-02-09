import { Trophy, Users, TrendingUp } from 'lucide-react';

/**
 * Placeholder: Maintainer Leaderboard sidebar widget.
 * Shows top contributors for the specific issue/PR.
 * Will be wired to the mentor leaderboard API.
 */
const MaintainerLeaderboardWidget = ({ issue }) => {
  // TODO: Fetch real leaderboard data for this issue from the API
  // e.g. GET /api/mentor-leaderboard?issueId=<id>
  const placeholderContributors = [];

  return (
    <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[hsl(220,13%,15%)] flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-500" />
        <h3 className="text-sm font-semibold text-[hsl(210,11%,85%)]">Maintainer Leaderboard</h3>
      </div>

      <div className="p-4">
        {placeholderContributors.length === 0 ? (
          <div className="text-center py-6">
            <Users className="w-8 h-8 text-[hsl(210,11%,25%)] mx-auto mb-2" />
            <p className="text-xs text-[hsl(210,11%,45%)] mb-1">No ranking data yet</p>
            <p className="text-[10px] text-[hsl(210,11%,35%)]">
              Contributors will appear here as they engage with this {issue?.isPR ? 'PR' : 'issue'}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {placeholderContributors.map((contributor, index) => (
              <div
                key={contributor.username}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[hsl(220,13%,10%)] transition-colors"
              >
                <span className={`text-xs font-bold w-5 text-center ${
                  index === 0 ? 'text-yellow-500' :
                  index === 1 ? 'text-gray-400' :
                  index === 2 ? 'text-amber-700' :
                  'text-[hsl(210,11%,40%)]'
                }`}>
                  {index + 1}
                </span>
                <img
                  src={contributor.avatar}
                  alt={contributor.username}
                  className="w-6 h-6 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[hsl(210,11%,80%)] truncate">{contributor.username}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-[hsl(142,70%,55%)]">
                  <TrendingUp className="w-3 h-3" />
                  <span>{contributor.score}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintainerLeaderboardWidget;
