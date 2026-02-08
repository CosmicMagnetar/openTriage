import React, { useState, useEffect } from 'react';
import { Megaphone, FileText, Plus, Edit2, Trash2, Cookie, Users, X, Trophy } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { AISuggestTextarea } from '../ui/AISuggestTextarea';
import HypeGenerator from './HypeGenerator';
import CookieLickingPanel from './CookieLickingPanel';
import MentorDashboardPanel from './MentorDashboardPanel';
import MentorLeaderboardPage from './MentorLeaderboardPage';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const MaintainerPortal = () => {
    const [activeTab, setActiveTab] = useState('hype');
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);

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

    const tabs = [
        { id: 'hype', label: 'Hype Generator', icon: Megaphone, color: 'purple' },
        { id: 'leaderboard', label: 'Mentor Leaderboard', icon: Trophy, color: 'yellow' },
        { id: 'claims', label: 'Claims Monitor', icon: Cookie, color: 'amber' },
        { id: 'templates', label: 'Templates', icon: FileText, color: 'blue' },
        { id: 'mentorship', label: 'Mentorship', icon: Users, color: 'pink' }
    ];

    const activeColors = {
        purple: 'border-purple-400 text-purple-400',
        yellow: 'border-yellow-400 text-yellow-400',
        amber: 'border-amber-400 text-amber-400',
        blue: 'border-[hsl(217,91%,60%)] text-[hsl(217,91%,65%)]',
        pink: 'border-pink-400 text-pink-400'
    };

    return (
        <div className="p-6 h-screen overflow-y-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[hsl(210,11%,90%)] mb-1">Maintainer Hub</h1>
                <p className="text-[hsl(210,11%,50%)] text-sm">Central command for community engagement and tools.</p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 border-b border-[hsl(220,13%,15%)] mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium ${activeTab === tab.id
                                ? activeColors[tab.color]
                                : 'border-transparent text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)]'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {activeTab === 'hype' && <HypeGenerator />}
            {activeTab === 'leaderboard' && <MentorLeaderboardPage />}
            {activeTab === 'claims' && <CookieLickingPanel />}
            {activeTab === 'mentorship' && <MentorDashboardPanel />}

            {activeTab === 'templates' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)]">Response Templates</h2>
                            <p className="text-sm text-[hsl(210,11%,50%)]">Manage saved replies for common issues</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingTemplate(null);
                                setShowTemplateModal(true);
                            }}
                            className="bg-[hsl(217,91%,50%)] hover:bg-[hsl(217,91%,55%)] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Template
                        </button>
                    </div>

                    {loadingTemplates ? (
                        <div className="text-center py-12 text-[hsl(210,11%,45%)]">Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className="bg-[hsl(220,13%,8%)] rounded-lg p-12 text-center border border-[hsl(220,13%,15%)]">
                            <FileText className="w-12 h-12 text-[hsl(220,13%,20%)] mx-auto mb-4" />
                            <p className="text-[hsl(210,11%,50%)] mb-4">No templates created yet</p>
                            <button
                                onClick={() => setShowTemplateModal(true)}
                                className="text-[hsl(217,91%,65%)] hover:text-[hsl(217,91%,75%)] font-medium transition-colors"
                            >
                                Create your first template
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-5 hover:border-[hsl(217,91%,60%,0.4)] transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-base font-medium text-[hsl(210,11%,90%)]">
                                                    {template.name}
                                                </h3>
                                                {template.triggerClassification && (
                                                    <span className="px-2 py-0.5 bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] border border-[hsl(217,91%,60%,0.3)] rounded text-xs font-medium">
                                                        Auto: {template.triggerClassification.replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-[hsl(210,11%,50%)] line-clamp-2 font-mono bg-[hsl(220,13%,6%)] p-2 rounded border border-[hsl(220,13%,12%)]">
                                                {template.body}
                                            </p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditingTemplate(template);
                                                    setShowTemplateModal(true);
                                                }}
                                                className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(217,91%,65%)] hover:bg-[hsl(217,91%,60%,0.1)] rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTemplate(template.id)}
                                                className="p-2 text-[hsl(210,11%,50%)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
            <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-[hsl(210,11%,90%)]">
                        {template ? 'Edit Template' : 'New Template'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,12%)] rounded-md transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[hsl(210,11%,50%)] mb-2">
                            Template Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Bug Report Response"
                            className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2.5 text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(217,91%,60%)] transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[hsl(210,11%,50%)] mb-2">
                            Template Body
                        </label>
                        <AISuggestTextarea
                            value={body}
                            onChange={setBody}
                            contextType="template"
                            placeholder="Thank you for reporting this issue..."
                            className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-3 text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(217,91%,60%)] transition-colors"
                            rows={8}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,15%)] text-[hsl(210,11%,75%)] px-4 py-2.5 rounded-lg font-medium transition-colors border border-[hsl(220,13%,18%)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 bg-[hsl(217,91%,50%)] hover:bg-[hsl(217,91%,55%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save Template'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaintainerPortal;
