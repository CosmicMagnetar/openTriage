import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await axios.get(`${API}/maintainer/templates`);
      setTemplates(response.data);
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;

    try {
      await axios.delete(`${API}/maintainer/templates/${id}`);
      toast.success('Template deleted');
      loadTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-slate-400">Loading templates...</div>
      </div>
    );
  }

  return (
    <div data-testid="templates-page" className="w-full h-full overflow-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-200 mb-2">Templates</h1>
            <p className="text-slate-400">
              Create response templates for common issue types
            </p>
          </div>
          <button
            data-testid="create-template-button"
            onClick={() => {
              setEditingTemplate(null);
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-300 active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            New Template
          </button>
        </div>

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-12 text-center">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">No templates yet</p>
            <button
              onClick={() => setShowModal(true)}
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
                data-testid={`template-${template.id}`}
                className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-blue-500 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">
                      {template.name}
                    </h3>
                    <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                      {template.body}
                    </p>
                    {template.triggerClassification && (
                      <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs">
                        Auto-trigger: {template.triggerClassification.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      data-testid={`edit-template-${template.id}`}
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all duration-300"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      data-testid={`delete-template-${template.id}`}
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-300"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowModal(false);
            setEditingTemplate(null);
          }}
          onSave={() => {
            setShowModal(false);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-2xl">
        <h2 className="text-2xl font-bold text-slate-200 mb-6">
          {template ? 'Edit Template' : 'New Template'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Template Name
            </label>
            <input
              data-testid="template-name-input"
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
            <textarea
              data-testid="template-body-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Thank you for reporting this issue..."
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
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
            data-testid="save-template-button"
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

export default TemplatesPage;