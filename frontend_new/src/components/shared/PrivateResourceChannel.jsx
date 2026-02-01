import { useState, useEffect } from 'react';
import { Lock, Plus, Link, Code, FileText, BookOpen, Trash2, ExternalLink, X, Send } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const RESOURCE_TYPES = [
    { value: 'link', label: 'Link', icon: Link },
    { value: 'code_snippet', label: 'Code Snippet', icon: Code },
    { value: 'documentation', label: 'Documentation', icon: FileText },
    { value: 'tutorial', label: 'Tutorial', icon: BookOpen },
];

const PrivateResourceChannel = ({ issueId, issueData }) => {
    const { user } = useAuthStore();
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    
    // Form state
    const [newResource, setNewResource] = useState({
        resourceType: 'link',
        title: '',
        content: '',
        description: '',
        language: '',
    });
    
    useEffect(() => {
        if (issueId) {
            loadResources();
        }
    }, [issueId]);
    
    const loadResources = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API}/private-resources?issueId=${issueId}`);
            setResources(response.data.resources || []);
            setHasAccess(true);
        } catch (error) {
            if (error.response?.status === 403) {
                setHasAccess(false);
            } else {
                console.error('Failed to load private resources:', error);
            }
        } finally {
            setLoading(false);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newResource.title || !newResource.content) {
            toast.error('Title and content are required');
            return;
        }
        
        setSubmitting(true);
        try {
            const response = await axios.post(`${API}/private-resources`, {
                issueId,
                ...newResource,
            });
            
            setResources([...resources, response.data.resource]);
            setNewResource({
                resourceType: 'link',
                title: '',
                content: '',
                description: '',
                language: '',
            });
            setShowAddForm(false);
            toast.success('Resource shared privately');
        } catch (error) {
            toast.error('Failed to share resource');
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleDelete = async (resourceId) => {
        if (!confirm('Delete this resource?')) return;
        
        try {
            await axios.delete(`${API}/private-resources?id=${resourceId}`);
            setResources(resources.filter(r => r.id !== resourceId));
            toast.success('Resource deleted');
        } catch (error) {
            toast.error('Failed to delete resource');
        }
    };
    
    const getResourceIcon = (type) => {
        const rt = RESOURCE_TYPES.find(t => t.value === type);
        const Icon = rt?.icon || Link;
        return <Icon className="w-4 h-4" />;
    };
    
    // Don't show if user doesn't have access
    if (!hasAccess && !loading) {
        return null;
    }
    
    // Check if current user is the owner or author
    const isOwner = issueData?.owner?.toLowerCase() === user?.username?.toLowerCase();
    const isAuthor = issueData?.authorName?.toLowerCase() === user?.username?.toLowerCase();
    
    if (!isOwner && !isAuthor) {
        return null;
    }
    
    return (
        <div className="bg-[hsl(220,13%,8%)] rounded-xl border border-[hsl(220,13%,15%)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[hsl(220,13%,10%)] border-b border-[hsl(220,13%,15%)]">
                <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-yellow-500" />
                    <h3 className="text-sm font-medium text-[hsl(210,11%,90%)]">
                        Private Resource Channel
                    </h3>
                    <span className="text-xs text-[hsl(210,11%,40%)] px-2 py-0.5 bg-yellow-500/10 rounded-full">
                        Only you & {isOwner ? issueData?.authorName : issueData?.owner}
                    </span>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[hsl(142,70%,45%)] text-black rounded-lg
                        hover:bg-[hsl(142,70%,50%)] transition-colors font-medium"
                >
                    <Plus className="w-3 h-3" />
                    Share Resource
                </button>
            </div>
            
            {/* Add Resource Form */}
            {showAddForm && (
                <form onSubmit={handleSubmit} className="p-4 border-b border-[hsl(220,13%,15%)] bg-[hsl(220,13%,6%)]">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-xs text-[hsl(210,11%,50%)] mb-1">Type</label>
                            <select
                                value={newResource.resourceType}
                                onChange={(e) => setNewResource({ ...newResource, resourceType: e.target.value })}
                                className="w-full bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm
                                    text-[hsl(210,11%,85%)] focus:outline-none focus:border-[hsl(142,70%,45%)]"
                            >
                                {RESOURCE_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-[hsl(210,11%,50%)] mb-1">Title</label>
                            <input
                                type="text"
                                value={newResource.title}
                                onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                                placeholder="Resource title"
                                className="w-full bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm
                                    text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)]"
                            />
                        </div>
                    </div>
                    
                    <div className="mb-3">
                        <label className="block text-xs text-[hsl(210,11%,50%)] mb-1">
                            {newResource.resourceType === 'link' ? 'URL' : 
                             newResource.resourceType === 'code_snippet' ? 'Code' : 'Content'}
                        </label>
                        <textarea
                            value={newResource.content}
                            onChange={(e) => setNewResource({ ...newResource, content: e.target.value })}
                            placeholder={
                                newResource.resourceType === 'link' ? 'https://...' :
                                newResource.resourceType === 'code_snippet' ? 'Paste your code here...' :
                                'Add your content...'
                            }
                            rows={newResource.resourceType === 'code_snippet' ? 6 : 3}
                            className={`w-full bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm
                                text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)] resize-none
                                ${newResource.resourceType === 'code_snippet' ? 'font-mono text-xs' : ''}`}
                        />
                    </div>
                    
                    {newResource.resourceType === 'code_snippet' && (
                        <div className="mb-3">
                            <label className="block text-xs text-[hsl(210,11%,50%)] mb-1">Language</label>
                            <input
                                type="text"
                                value={newResource.language}
                                onChange={(e) => setNewResource({ ...newResource, language: e.target.value })}
                                placeholder="javascript, python, etc."
                                className="w-full bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm
                                    text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)]"
                            />
                        </div>
                    )}
                    
                    <div className="mb-3">
                        <label className="block text-xs text-[hsl(210,11%,50%)] mb-1">Description (optional)</label>
                        <input
                            type="text"
                            value={newResource.description}
                            onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
                            placeholder="Brief description"
                            className="w-full bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm
                                text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)]"
                        />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowAddForm(false)}
                            className="px-3 py-1.5 text-xs text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-1 px-4 py-1.5 text-xs bg-[hsl(142,70%,45%)] text-black rounded-lg
                                hover:bg-[hsl(142,70%,50%)] disabled:opacity-50 transition-colors font-medium"
                        >
                            <Send className="w-3 h-3" />
                            Share
                        </button>
                    </div>
                </form>
            )}
            
            {/* Resources List */}
            <div className="p-4">
                {loading ? (
                    <div className="text-center py-6 text-[hsl(210,11%,50%)] text-sm">
                        Loading...
                    </div>
                ) : resources.length === 0 ? (
                    <div className="text-center py-6">
                        <Lock className="w-8 h-8 text-[hsl(220,13%,25%)] mx-auto mb-2" />
                        <p className="text-sm text-[hsl(210,11%,50%)]">
                            No private resources shared yet
                        </p>
                        <p className="text-xs text-[hsl(210,11%,40%)] mt-1">
                            Share links, code snippets, or documentation privately
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {resources.map((resource) => (
                            <div 
                                key={resource.id}
                                className="bg-[hsl(220,13%,10%)] rounded-lg p-3 border border-[hsl(220,13%,15%)]"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[hsl(142,70%,55%)]">
                                            {getResourceIcon(resource.resourceType)}
                                        </span>
                                        <span className="text-sm font-medium text-[hsl(210,11%,90%)]">
                                            {resource.title}
                                        </span>
                                        <span className="text-xs text-[hsl(210,11%,40%)] px-2 py-0.5 bg-[hsl(220,13%,15%)] rounded">
                                            {resource.resourceType.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {resource.resourceType === 'link' && (
                                            <a
                                                href={resource.content}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[hsl(217,91%,60%)] hover:text-[hsl(217,91%,70%)]"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                        {resource.sharedById === user?.id && (
                                            <button
                                                onClick={() => handleDelete(resource.id)}
                                                className="text-[hsl(210,11%,40%)] hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {resource.description && (
                                    <p className="text-xs text-[hsl(210,11%,50%)] mb-2">
                                        {resource.description}
                                    </p>
                                )}
                                
                                {resource.resourceType === 'code_snippet' ? (
                                    <pre className="bg-[hsl(220,13%,6%)] rounded p-3 text-xs font-mono text-[hsl(210,11%,75%)] overflow-x-auto">
                                        <code>{resource.content}</code>
                                    </pre>
                                ) : resource.resourceType === 'link' ? (
                                    <a 
                                        href={resource.content}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-[hsl(217,91%,60%)] hover:underline break-all"
                                    >
                                        {resource.content}
                                    </a>
                                ) : (
                                    <p className="text-xs text-[hsl(210,11%,70%)] whitespace-pre-wrap">
                                        {resource.content}
                                    </p>
                                )}
                                
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[hsl(220,13%,15%)]">
                                    <span className="text-xs text-[hsl(210,11%,40%)]">
                                        Shared by {resource.sharedBy}
                                    </span>
                                    <span className="text-xs text-[hsl(210,11%,40%)]">
                                        {new Date(resource.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrivateResourceChannel;
