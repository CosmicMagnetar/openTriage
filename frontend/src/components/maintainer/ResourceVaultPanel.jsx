import { useState, useEffect } from 'react';
import { Search, Book, Code, ExternalLink, ThumbsUp, Filter, TrendingUp, Plus, Archive, FileText, Link2, Tag } from 'lucide-react';
import { communityApi } from '../../services/api';

const ResourceVaultPanel = ({ repoName = null }) => {
    const [resources, setResources] = useState([]);
    const [trending, setTrending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newResource, setNewResource] = useState({
        title: '',
        url: '',
        type: 'link',
        description: '',
        tags: ''
    });


    useEffect(() => {
        loadResources();
    }, [repoName]);

    const loadResources = async () => {
        try {
            setLoading(true);
            const [searchData, trendingData] = await Promise.all([
                communityApi.searchResources({ query: '', repo_name: repoName, limit: 20 }),
                communityApi.getTrendingResources(repoName, 7, 5)
            ]);

            setResources(searchData.resources || []);
            setTrending(trendingData.resources || []);
        } catch (error) {
            console.error('Failed to load resources:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            await loadResources();
            return;
        }

        try {
            setLoading(true);
            const data = await communityApi.searchResources({
                query: searchQuery,
                repo_name: repoName,
                resource_type: selectedType !== 'all' ? selectedType : null,
                limit: 20
            });
            setResources(data.resources || []);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const markHelpful = async (resourceId) => {
        try {
            await communityApi.markResourceHelpful(resourceId, 'current-user');
            // Optimistic update
            setResources(resources.map(r =>
                r.id === resourceId
                    ? { ...r, helpful_count: (r.helpful_count || 0) + 1 }
                    : r
            ));
        } catch (error) {
            console.error('Failed to mark helpful:', error);
        }
    };

    const handleCreateResource = async (e) => {
        e.preventDefault();
        if (!newResource.title || !newResource.url) return;

        try {
            setCreating(true);
            await communityApi.createResource({
                title: newResource.title,
                url: newResource.url,
                resource_type: newResource.type,
                description: newResource.description,
                tags: newResource.tags.split(',').map(t => t.trim()).filter(Boolean)
            });
            setShowAddModal(false);
            setNewResource({ title: '', url: '', type: 'link', description: '', tags: '' });
            await loadResources();
        } catch (error) {
            console.error('Failed to create resource:', error);
        } finally {
            setCreating(false);
        }
    };


    const getTypeIcon = (type) => {
        switch (type) {
            case 'code_snippet': return Code;
            case 'documentation': return FileText;
            case 'link': return Link2;
            default: return Archive;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'code_snippet': return 'text-purple-400 bg-purple-500/20';
            case 'documentation': return 'text-blue-400 bg-blue-500/20';
            case 'tutorial': return 'text-emerald-400 bg-emerald-500/20';
            case 'answer': return 'text-yellow-400 bg-yellow-500/20';
            default: return 'text-slate-400 bg-slate-500/20';
        }
    };

    const resourceTypes = [
        { value: 'all', label: 'All' },
        { value: 'link', label: 'Links' },
        { value: 'code_snippet', label: 'Code' },
        { value: 'documentation', label: 'Docs' },
        { value: 'tutorial', label: 'Tutorials' },
        { value: 'answer', label: 'Answers' },
    ];

    if (loading && resources.length === 0) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 min-h-[400px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3"> {/* Added flex container for icon and text */}
                    <Archive className="w-6 h-6 text-cyan-400" />
                    <div>
                        <h2 className="text-lg font-bold text-slate-200">Resource Vault</h2>
                        <p className="text-xs text-slate-400">Community knowledge base</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg
                                hover:bg-blue-500/20 transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Add Resource
                    </button>
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search resources..."
                            className="pl-9 pr-4 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm
                                    text-slate-200 focus:outline-none focus:border-blue-400 w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Add Resource Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold text-slate-200 mb-4">Add New Resource</h3>
                        <form onSubmit={handleCreateResource} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={newResource.title}
                                    onChange={e => setNewResource({ ...newResource, title: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-blue-400 outline-none"
                                    placeholder="Resource title"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">URL / Content</label>
                                <input
                                    type="text"
                                    value={newResource.url}
                                    onChange={e => setNewResource({ ...newResource, url: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-blue-400 outline-none"
                                    placeholder="https://..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                                <select
                                    value={newResource.type}
                                    onChange={e => setNewResource({ ...newResource, type: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-blue-400 outline-none"
                                >
                                    <option value="link">Link</option>
                                    <option value="documentation">Documentation</option>
                                    <option value="tutorial">Tutorial</option>
                                    <option value="tool">Tool</option>
                                    <option value="code_snippet">Code Snippet</option> {/* Changed from 'snippet' to 'code_snippet' */}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Description (optional)</label>
                                <textarea
                                    value={newResource.description}
                                    onChange={e => setNewResource({ ...newResource, description: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-blue-400 outline-none"
                                    placeholder="A brief description of the resource"
                                    rows="3"
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Tags (comma separated)</label>
                                <input
                                    type="text"
                                    value={newResource.tags}
                                    onChange={e => setNewResource({ ...newResource, tags: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-blue-400 outline-none"
                                    placeholder="python, react, tutorial"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    {creating ? 'Adding...' : 'Add Resource'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Old Search and Filter (now replaced by the header search) */}
            {/* This section is removed as per the instruction's implied replacement */}
            {/* <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search resources..."
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm
                      text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                </div>
                <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                    {resourceTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                </select>
                <button
                    onClick={handleSearch}
                    className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg font-medium text-sm
                    hover:bg-cyan-500/30 transition-colors"
                >
                    Search
                </button>
            </div>

            {/* Trending Resources */}
            {trending.length > 0 && !searchQuery && (
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                        <ThumbsUp className="w-4 h-4 text-emerald-400" />
                        Trending This Week
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {trending.map((resource, i) => (
                            <a
                                key={i}
                                href={resource.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 
                          rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/20 transition-colors
                          max-w-[200px] truncate"
                            >
                                {resource.title}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Resources List */}
            {resources.length > 0 ? (
                <div className="space-y-3">
                    {resources.map((resource, i) => {
                        const TypeIcon = getTypeIcon(resource.resource_type);

                        return (
                            <div
                                key={i}
                                className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 
                          transition-colors"
                            >
                                <div className={`w-10 h-10 rounded-lg ${getTypeColor(resource.resource_type)} 
                               flex items-center justify-center flex-shrink-0`}>
                                    <TypeIcon className="w-5 h-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <a
                                            href={resource.content}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-slate-200 hover:text-cyan-400 transition-colors 
                                flex items-center gap-1"
                                        >
                                            {resource.title}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                        <span className={`px-2 py-0.5 rounded-full text-xs capitalize 
                                    ${getTypeColor(resource.resource_type)}`}>
                                            {resource.resource_type?.replace('_', ' ')}
                                        </span>
                                    </div>

                                    {resource.description && (
                                        <p className="text-sm text-slate-400 mb-2 line-clamp-2">
                                            {resource.description}
                                        </p>
                                    )}

                                    {resource.tags?.length > 0 && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Tag className="w-3 h-3 text-slate-500" />
                                            {resource.tags.slice(0, 4).map((tag, j) => (
                                                <span key={j} className="text-xs text-slate-500 bg-slate-600/50 px-2 py-0.5 rounded">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                        <span>Shared by @{resource.shared_by}</span>
                                        <button
                                            onClick={() => markHelpful(resource.id)}
                                            className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors"
                                        >
                                            <ThumbsUp className="w-3 h-3" />
                                            <span>{resource.helpful_count || 0}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8">
                    <Archive className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No resources found</p>
                    <p className="text-sm text-slate-500 mt-1">
                        Resources are automatically saved from chat and discussions
                    </p>
                </div>
            )}
        </div>
    );
};

export default ResourceVaultPanel;
