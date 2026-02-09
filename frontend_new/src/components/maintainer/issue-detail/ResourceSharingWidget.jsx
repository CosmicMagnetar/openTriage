import { Link, FileText, Plus, ExternalLink } from 'lucide-react';

/**
 * Placeholder: Resource Sharing sidebar widget.
 * Displays links and file attachments associated with this issue/PR.
 * Will be wired to the private resource channel API.
 */
const ResourceSharingWidget = ({ issue }) => {
  // TODO: Fetch real resource data for this issue from the API
  // e.g. GET /api/private-resources?issueId=<id>
  const placeholderResources = [];

  return (
    <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[hsl(217,91%,65%)]" />
          <h3 className="text-sm font-semibold text-[hsl(210,11%,85%)]">Resources</h3>
        </div>
        <button
          className="p-1 text-[hsl(210,11%,50%)] hover:text-[hsl(217,91%,65%)] hover:bg-[hsl(220,13%,12%)] rounded transition-colors"
          title="Add resource"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        {placeholderResources.length === 0 ? (
          <div className="text-center py-6">
            <Link className="w-8 h-8 text-[hsl(210,11%,25%)] mx-auto mb-2" />
            <p className="text-xs text-[hsl(210,11%,45%)] mb-1">No resources shared</p>
            <p className="text-[10px] text-[hsl(210,11%,35%)]">
              Share links, code snippets, or docs for this {issue?.isPR ? 'PR' : 'issue'}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {placeholderResources.map((resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[hsl(220,13%,10%)] transition-colors group"
              >
                <div className="p-1.5 bg-[hsl(217,91%,60%,0.1)] rounded">
                  <Link className="w-3.5 h-3.5 text-[hsl(217,91%,65%)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[hsl(210,11%,80%)] truncate">{resource.title}</p>
                  <p className="text-[10px] text-[hsl(210,11%,40%)] truncate">{resource.type}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[hsl(210,11%,30%)] group-hover:text-[hsl(210,11%,60%)] transition-colors" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceSharingWidget;
