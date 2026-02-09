import { useState, useEffect, useCallback } from 'react';
import { Link as LinkIcon, FileText, Plus, ExternalLink, Trash2, X, Send, Loader2, BookOpen } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import useAuthStore from '../../../stores/authStore';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const RESOURCE_TYPES = [
  { value: 'link', label: 'Link', icon: LinkIcon },
  { value: 'documentation', label: 'Documentation', icon: FileText },
  { value: 'tutorial', label: 'Tutorial', icon: BookOpen },
];

/**
 * Resource Sharing sidebar widget.
 * Fetches existing private resources for the issue and lets maintainers add links + text.
 */
const ResourceSharingWidget = ({ issue }) => {
  const { user } = useAuthStore();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ resourceType: 'link', title: '', content: '', description: '' });

  const fetchResources = useCallback(async () => {
    if (!issue?.id) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/private-resources?issueId=${issue.id}`);
      setResources(response.data.resources || []);
      setHasAccess(true);
    } catch (err) {
      if (err.response?.status === 403) {
        setHasAccess(false);
      } else {
        console.error('Failed to load resources:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [issue?.id]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/private-resources`, {
        issueId: issue.id,
        resourceType: form.resourceType,
        title: form.title,
        content: form.content,
        description: form.description || null,
      });
      setResources([...resources, response.data.resource]);
      setForm({ resourceType: 'link', title: '', content: '', description: '' });
      setShowAddForm(false);
      toast.success('Resource shared');
    } catch (err) {
      console.error('Failed to add resource:', err);
      toast.error(err.response?.data?.error || 'Failed to share resource');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (resourceId) => {
    if (!window.confirm('Remove this resource?')) return;
    try {
      await axios.delete(`${API}/private-resources?id=${resourceId}`);
      setResources(resources.filter((r) => r.id !== resourceId));
      toast.success('Resource removed');
    } catch (err) {
      console.error('Failed to delete resource:', err);
      toast.error('Failed to remove resource');
    }
  };

  const getIcon = (type) => {
    const found = RESOURCE_TYPES.find((t) => t.value === type);
    const Icon = found?.icon || FileText;
    return <Icon className="w-3.5 h-3.5 text-[hsl(217,91%,65%)]" />;
  };

  return (
    <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[hsl(217,91%,65%)]" />
          <h3 className="text-sm font-semibold text-[hsl(210,11%,85%)]">Resources</h3>
          {resources.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[hsl(220,13%,15%)] text-[hsl(210,11%,55%)] rounded-full">
              {resources.length}
            </span>
          )}
        </div>
        {hasAccess && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1 text-[hsl(210,11%,50%)] hover:text-[hsl(217,91%,65%)] hover:bg-[hsl(220,13%,12%)] rounded transition-colors"
            title={showAddForm ? 'Cancel' : 'Add resource'}
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="p-3">
        {/* Add form */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="mb-3 p-3 bg-[hsl(220,13%,6%)] border border-[hsl(220,13%,12%)] rounded-lg space-y-2.5">
            {/* Type selector */}
            <div className="flex gap-1.5">
              {RESOURCE_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, resourceType: t.value })}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
                      form.resourceType === t.value
                        ? 'bg-[hsl(217,91%,50%)] text-white'
                        : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,55%)] hover:bg-[hsl(220,13%,13%)]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-xs text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(217,91%,60%)] transition-colors"
            />
            <input
              type="text"
              placeholder={form.resourceType === 'link' ? 'URL (https://...)' : 'Content or URL'}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-xs text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(217,91%,60%)] transition-colors"
            />
            <textarea
              placeholder="Short description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-xs text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(217,91%,60%)] transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={submitting || !form.title.trim() || !form.content.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] text-black rounded-lg text-xs font-medium transition-colors"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {submitting ? 'Sharing...' : 'Share Resource'}
            </button>
          </form>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 text-[hsl(217,91%,60%)] animate-spin mr-2" />
            <span className="text-xs text-[hsl(210,11%,50%)]">Loading...</span>
          </div>
        ) : !hasAccess ? (
          <div className="text-center py-6">
            <LinkIcon className="w-8 h-8 text-[hsl(210,11%,20%)] mx-auto mb-2" />
            <p className="text-xs text-[hsl(210,11%,45%)]">Resource sharing is private</p>
            <p className="text-[10px] text-[hsl(210,11%,35%)]">Only the repo owner and issue author can view.</p>
          </div>
        ) : resources.length === 0 && !showAddForm ? (
          <div className="text-center py-6">
            <LinkIcon className="w-8 h-8 text-[hsl(210,11%,20%)] mx-auto mb-2" />
            <p className="text-xs text-[hsl(210,11%,45%)] mb-1">No resources shared</p>
            <p className="text-[10px] text-[hsl(210,11%,35%)]">
              Share links or docs for this {issue?.isPR ? 'PR' : 'issue'}.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {resources.map((resource) => {
              const isLink = resource.resourceType === 'link' || resource.content?.startsWith('http');
              const canDelete = user?.username === resource.sharedBy;

              return (
                <div
                  key={resource.id}
                  className="group flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-[hsl(220,13%,10%)] transition-colors"
                >
                  <div className="mt-0.5 p-1.5 bg-[hsl(217,91%,60%,0.08)] rounded shrink-0">
                    {getIcon(resource.resourceType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[hsl(210,11%,82%)] truncate font-medium">{resource.title}</p>
                    {resource.description && (
                      <p className="text-[10px] text-[hsl(210,11%,50%)] truncate mt-0.5">{resource.description}</p>
                    )}
                    {isLink && (
                      <a
                        href={resource.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[hsl(217,91%,60%)] hover:text-[hsl(217,91%,70%)] flex items-center gap-0.5 mt-0.5 transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span className="truncate">{resource.content}</span>
                      </a>
                    )}
                    {!isLink && (
                      <p className="text-[10px] text-[hsl(210,11%,55%)] mt-1 whitespace-pre-wrap line-clamp-3">{resource.content}</p>
                    )}
                    <p className="text-[9px] text-[hsl(210,11%,35%)] mt-1">
                      by {resource.sharedBy} · {new Date(resource.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(resource.id)}
                      className="p-1 text-[hsl(210,11%,30%)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceSharingWidget;
