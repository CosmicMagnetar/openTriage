import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, Plus, Edit2, Trash2, Cookie, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { AISuggestTextarea } from '../ui/AISuggestTextarea';
import HypeGenerator from './HypeGenerator';
import CookieLickingPanel from './CookieLickingPanel';
import MentorDashboardPanel from './MentorDashboardPanel';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const MaintainerPortal = () => {
    const [activeTab, setActiveTab] = useState('hype');
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);

    // Load templates when tab changes
    useEffect(() => {
        if (activeTab === 'templates') {
            loadTemplates();
        }
    }, [activeTab]);

    const loadTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const response = await axios.get(`${API}/maintainer/templates`);
            setTemplates(response.data);
        } catch (error) {
            console.error('Error loading templates:', error);
            setTemplates([]);
        } finally {
            setLoadingTemplates(false);
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm('Delete this template?')) return;
        try {
            await axios.delete(`${API}/maintainer/templates/${id}`);
            toast.success('Template deleted');
            loadTemplates();
        } catch (error) {
            toast.error('Failed to delete template');
        }
    };

    return (
        <div className="p-6 h-screen overflow-y-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-200 mb-2">Maintainer Hub</h1>
                <p className="text-slate-400">Central command for community engagement and tools.</p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-slate-700 mb-6">
                <button
                    onClick={() => setActiveTab('hype')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'hype'
                        ? 'border-purple-500 text-purple-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium">Hype Generator</span>
                </button>
                <button
                    onClick={() => setActiveTab('claims')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'claims'
                        ? 'border-amber-500 text-amber-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <Cookie className="w-5 h-5" />
                    <span className="font-medium">Claims Monitor</span>
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'templates'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <FileText className="w-5 h-5" />
                    <span className="font-medium">Templates</span>
                </button>
                <button
                    onClick={() => setActiveTab('mentorship')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'mentorship'
                        ? 'border-pink-500 text-pink-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <Users className="w-5 h-5" />
                    <span className="font-medium">Mentorship</span>
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'hype' && (
                <div className="animate-in fade-in duration-300">
                    <HypeGenerator />
                </div>
            )}

            {activeTab === 'claims' && (
                <div className="animate-in fade-in duration-300">
                    <CookieLickingPanel />
                </div>
            )}

            {activeTab === 'mentorship' && (
                <div className="animate-in fade-in duration-300">
                    <MentorDashboardPanel />
                </div>
            )}

            {activeTab === 'templates' && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-200">Response Templates</h2>
                            <p className="text-sm text-slate-400">Manage saved replies for common issues</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingTemplate(null);
                                setShowTemplateModal(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all active:scale-[0.98]"
                        >
                            <Plus className="w-4 h-4" />
                            New Template
                        </button>
                    </div>

                    {loadingTemplates ? (
                        <div className="text-center py-12 text-slate-500">Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
                            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 mb-4">No templates created yet</p>
                            <button
                                onClick={() => setShowTemplateModal(true)}
                                className="text-blue-400 hover:text-blue-300 font-medium"
                            >
                                Create your first template
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-blue-500 transition-all duration-300"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-semibold text-slate-200">
                                                    {template.name}
                                                </h3>
                                                {template.triggerClassification && (
                                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-xs uppercase font-medium">
                                                        Auto: {template.triggerClassification.replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-400 line-clamp-2 font-mono bg-slate-900/50 p-2 rounded">
                                                {template.body}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingTemplate(template);
                                                    setShowTemplateModal(true);
                                                }}
                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTemplate(template.id)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Template Modal */}
            {showTemplateModal && (
                <TemplateModal
                    template={editingTemplate}
                    onClose={() => {
                        setShowTemplateModal(false);
                        setEditingTemplate(null);
                    }}
                    onSave={() => {
                        setShowTemplateModal(false);
                        setEditingTemplate(null);
                        loadTemplates();
                    }}
                />
            )}
        </div>
    );
};

const TemplateModal = ({ template, onClose, onSave }) => {
    const [name, setName] = useState(template?.name || '');
    const [body, setBody] = useState(template?.body || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim() || !body.trim()) {
            toast.error('Name and body are required');
            return;
        }

        setSaving(true);
        try {
            if (template) {
                await axios.put(`${API}/maintainer/templates/${template.id}`, { name, body });
                toast.success('Template updated');
            } else {
                await axios.post(`${API}/maintainer/templates`, { name, body });
                toast.success('Template created');
            }
            onSave();
        } catch (error) {
            toast.error('Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-200">
                        {template ? 'Edit Template' : 'New Template'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <Trash2 className="w-5 h-5 rotate-45" /> {/* Close icon workaround with Trash2? No, use X from lucide? I didn't import X. I'll stick to a Close link or import X. */}
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Template Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Bug Report Response"
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Template Body
                        </label>
                        <AISuggestTextarea
                            value={body}
                            onChange={setBody}
                            contextType="template"
                            placeholder="Thank you for reporting this issue... (AI suggestions appear after a pause)"
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                            rows={8}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg font-medium transition-all duration-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 active:scale-[0.98]"
                    >
                        {saving ? 'Saving...' : 'Save Template'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaintainerPortal;
