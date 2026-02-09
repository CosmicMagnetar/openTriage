import { MessageSquare, RefreshCw } from 'lucide-react';

/**
 * Scrollable conversation thread for the issue/PR.
 */
const ConversationThread = ({ comments, loading, onRefresh }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[hsl(210,11%,60%)] uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Conversation ({comments.length})
        </h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,12%)] rounded-md transition-colors disabled:opacity-50"
          title="Refresh comments"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[hsl(210,11%,45%)] text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-8 h-8 text-[hsl(210,11%,25%)] mx-auto mb-2" />
            <p className="text-[hsl(210,11%,45%)] text-sm">No comments yet. Be the first to reply!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-[hsl(220,13%,6%)] border border-[hsl(220,13%,12%)] rounded-lg p-4 hover:border-[hsl(220,13%,18%)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <img
                  src={comment.user?.avatar_url || 'https://github.com/ghost.png'}
                  alt={comment.user?.login || 'User'}
                  className="w-8 h-8 rounded-full ring-2 ring-[hsl(220,13%,15%)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium text-[hsl(210,11%,85%)]">
                      {comment.user?.login || 'Unknown'}
                    </span>
                    <span className="text-xs text-[hsl(210,11%,40%)]">
                      {new Date(comment.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-[hsl(210,11%,70%)] whitespace-pre-wrap break-words leading-relaxed">
                    {comment.body}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationThread;
