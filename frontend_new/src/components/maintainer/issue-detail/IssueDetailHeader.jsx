import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Sticky header with breadcrumbs and primary action buttons.
 */
const IssueDetailHeader = ({ issue, onMerge, onClose, processing }) => {
  const navigate = useNavigate();

  if (!issue) return null;

  const isPR = issue.isPR;
  const itemType = isPR ? 'PR' : 'Issue';

  return (
    <div className="sticky top-0 z-30 bg-[hsl(220,13%,7%)]/95 backdrop-blur-sm border-b border-[hsl(220,13%,14%)]">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,80%)] transition-colors"
          >
            Dashboard
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[hsl(210,11%,30%)]" />
          <button
            onClick={() => navigate('/dashboard')}
            className="text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,80%)] transition-colors"
          >
            {isPR ? 'Pull Requests' : 'Issues'}
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[hsl(210,11%,30%)]" />
          <span className="text-[hsl(210,11%,85%)] font-medium">
            {itemType} #{issue.number}
          </span>
        </nav>

        {/* Primary Actions */}
        <div className="flex items-center gap-2">
          {issue.state === 'open' && issue.owner && issue.repo && (
            <>
              {isPR && (
                <button
                  onClick={onMerge}
                  disabled={processing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] text-black rounded-lg text-sm font-semibold transition-colors"
                >
                  Merge
                </button>
              )}
              <button
                onClick={onClose}
                disabled={processing}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500/15 hover:bg-red-500/25 disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] text-red-400 rounded-lg text-sm font-semibold transition-colors border border-red-500/30"
              >
                Close
              </button>
            </>
          )}

          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="ml-2 px-3 py-2 text-sm text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,80%)] hover:bg-[hsl(220,13%,12%)] rounded-lg transition-colors border border-[hsl(220,13%,18%)]"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default IssueDetailHeader;
