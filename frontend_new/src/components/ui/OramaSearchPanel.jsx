/**
 * OramaSearchPanel
 *
 * UI component for searching indexed READMEs using Orama.
 * Shows search results with relevance scores and links to source.
 */

import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle, BookOpen, ExternalLink, Trash2 } from "lucide-react";

export default function OramaSearchPanel({ 
  onSearch, 
  isLoading, 
  results = [], 
  error,
  indexedRepos = [],
  stats = {},
}) {
  const [query, setQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [localResults, setLocalResults] = useState([]);

  const handleSearch = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setLocalResults([]);
      return;
    }

    const foundResults = await onSearch(
      searchQuery,
      10,
      selectedRepo
    );
    setLocalResults(foundResults);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(query);
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [query, selectedRepo]);

  return (
    <div className="bg-gradient-to-b from-[hsl(220,13%,12%)] to-[hsl(220,13%,8%)] border border-[hsl(220,13%,18%)] rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[hsl(210,11%,90%)] flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[hsl(142,70%,45%)]" />
          Local README Search (Orama)
        </h3>
        {stats.docCount > 0 && (
          <p className="text-xs text-[hsl(210,11%,50%)]">
            {stats.docCount} document sections indexed
          </p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex gap-2 bg-red-500/10 border border-red-500/25 rounded p-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(210,11%,40%)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search README content..."
          className="w-full pl-9 pr-3 py-2 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-md text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)] transition-colors"
        />
      </div>

      {/* Repository filter */}
      {indexedRepos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedRepo(null)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              selectedRepo === null
                ? "bg-[hsl(142,70%,45%)] text-white"
                : "bg-[hsl(220,13%,12%)] text-[hsl(210,11%,60%)] hover:text-[hsl(210,11%,80%)]"
            }`}
          >
            All Repos
          </button>
          {indexedRepos.map((repo) => (
            <button
              key={repo}
              onClick={() => setSelectedRepo(repo)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                selectedRepo === repo
                  ? "bg-[hsl(142,70%,45%)] text-white"
                  : "bg-[hsl(220,13%,12%)] text-[hsl(210,11%,60%)] hover:text-[hsl(210,11%,80%)]"
              }`}
            >
              {repo.split("/")[1]}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="space-y-2 max-h-96 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-[hsl(142,70%,45%)] animate-spin" />
            <span className="ml-2 text-xs text-[hsl(210,11%,50%)]">
              Indexing...
            </span>
          </div>
        )}

        {!isLoading && localResults.length === 0 && query && (
          <p className="text-xs text-[hsl(210,11%,40%)] py-2">
            No results found for "{query}"
          </p>
        )}

        {localResults.map((result, idx) => (
          <div
            key={idx}
            className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded p-3 space-y-1.5 hover:border-[hsl(220,13%,25%)] transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[hsl(210,11%,85%)] truncate">
                  {result.section}
                </p>
                <p className="text-xs text-[hsl(210,11%,60%)]">
                  {result.repository}
                </p>
              </div>
              {result.score && (
                <span className="text-xs font-mono text-[hsl(142,70%,45%)] flex-shrink-0">
                  {(result.score * 100).toFixed(0)}%
                </span>
              )}
            </div>

            <p className="text-xs text-[hsl(210,11%,70%)] line-clamp-2">
              {result.content.substring(0, 150)}...
            </p>

            {result.sourceUrl && (
              <a
                href={result.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[hsl(217,91%,65%)] hover:underline flex items-center gap-1 w-fit"
              >
                View on GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
