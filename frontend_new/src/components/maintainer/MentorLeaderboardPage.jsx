import React, { useState, useEffect } from 'react';
import {
  Trophy,
  RefreshCw,
  Download,
  Edit2,
  Save,
  X,
  TrendingUp,
  Users,
  MessageSquare,
  Code2,
  AlertCircle,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE = `${import.meta.env.VITE_AI_ENGINE_URL || 'http://localhost:7860'}`;

const MentorLeaderboardPage = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [filterText, setFilterText] = useState('');
  const [maintainerId, setMaintainerId] = useState('');

  // Get API key from localStorage
  const apiKey = localStorage.getItem('api_key') || '';

  useEffect(() => {
    loadLeaderboard();
    // Get current user ID for maintainer exclusion
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        setMaintainerId(parsed.id);
      } catch (e) {
        console.error('Could not parse user data');
      }
    }
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/leaderboard?limit=100`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      setLeaderboard(response.data.entries || []);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const generateLeaderboard = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(
        `${API_BASE}/leaderboard/generate${
          maintainerId ? `?exclude_maintainer=${maintainerId}` : ''
        }`,
        {},
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );
      setLeaderboard(response.data.entries || []);
      toast.success('Leaderboard generated successfully');
    } catch (error) {
      console.error('Error generating leaderboard:', error);
      toast.error('Failed to generate leaderboard');
    } finally {
      setGenerating(false);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry.mentor_id);
    setEditData({
      mentor_id: entry.mentor_id,
      sentiment_score: entry.sentiment_score,
      expertise_score: entry.expertise_score,
      engagement_score: entry.engagement_score,
      best_language: entry.best_language,
      custom_notes: entry.custom_notes || '',
    });
  };

  const saveEdit = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/leaderboard/edit`,
        {
          ...editData,
          edited_by: 'maintainer',
          reason: 'Manual adjustment via dashboard',
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      // Update local state
      setLeaderboard((prev) =>
        prev.map((entry) =>
          entry.mentor_id === editData.mentor_id ? response.data : entry
        )
      );

      setEditingId(null);
      toast.success('Entry updated successfully');

      // Reload to get updated rankings
      setTimeout(() => loadLeaderboard(), 500);
    } catch (error) {
      console.error('Error saving edit:', error);
      toast.error('Failed to save changes');
    }
  };

  const exportLeaderboard = async (format) => {
    try {
      const response = await axios.get(
        `${API_BASE}/leaderboard/export?format=${format}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      if (format === 'csv') {
        // Download as CSV
        const element = document.createElement('a');
        element.setAttribute(
          'href',
          'data:text/csv;charset=utf-8,' + encodeURIComponent(response.data.data)
        );
        element.setAttribute('download', 'mentor-leaderboard.csv');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      } else {
        // Download as JSON
        const element = document.createElement('a');
        element.setAttribute(
          'href',
          'data:application/json;charset=utf-8,' +
            encodeURIComponent(JSON.stringify(JSON.parse(response.data.data), null, 2))
        );
        element.setAttribute('download', 'mentor-leaderboard.json');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }

      toast.success(`Leaderboard exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting leaderboard:', error);
      toast.error('Failed to export leaderboard');
    }
  };

  const filteredLeaderboard = leaderboard.filter((entry) =>
    entry.mentor_username.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="text-yellow-500" size={32} />
            Mentor Leaderboard Dashboard
          </h1>
          <p className="text-slate-600 mt-1">
            AI-powered mentor rankings with sentiment analysis and engagement metrics
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={generateLeaderboard}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition"
          >
            <RefreshCw size={18} className={generating ? 'animate-spin' : ''} />
            Generate Fresh
          </button>

          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition">
              <Download size={18} />
              Export
            </button>
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg hidden group-hover:block z-10">
              <button
                onClick={() => exportLeaderboard('json')}
                className="w-full text-left px-4 py-2 hover:bg-slate-100"
              >
                Export as JSON
              </button>
              <button
                onClick={() => exportLeaderboard('csv')}
                className="w-full text-left px-4 py-2 hover:bg-slate-100"
              >
                Export as CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Mentors"
          value={leaderboard.length}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Avg. Sentiment"
          value={
            leaderboard.length > 0
              ? (
                  leaderboard.reduce((sum, e) => sum + e.sentiment_score, 0) /
                  leaderboard.length
                ).toFixed(1)
              : 'N/A'
          }
          icon={MessageSquare}
          color="green"
        />
        <StatCard
          label="Avg. Expertise"
          value={
            leaderboard.length > 0
              ? (
                  leaderboard.reduce((sum, e) => sum + e.expertise_score, 0) /
                  leaderboard.length
                ).toFixed(1)
              : 'N/A'
          }
          icon={Code2}
          color="purple"
        />
        <StatCard
          label="Total Sessions"
          value={leaderboard.reduce((sum, e) => sum + e.total_sessions, 0)}
          icon={TrendingUp}
          color="orange"
        />
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search mentors by name..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <RefreshCw className="animate-spin inline-block mb-2" />
            Loading leaderboard...
          </div>
        ) : filteredLeaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <AlertCircle className="inline-block mb-2" />
            No mentors found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Mentor
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">
                    Overall
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">
                    Sentiment
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">
                    Expertise
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">
                    Engagement
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Best Language
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">
                    Sessions
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((entry) =>
                  editingId === entry.mentor_id ? (
                    <EditRow
                      key={entry.mentor_id}
                      entry={entry}
                      editData={editData}
                      setEditData={setEditData}
                      onSave={saveEdit}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <LeaderboardRow
                      key={entry.mentor_id}
                      entry={entry}
                      onEdit={() => startEdit(entry)}
                    />
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon size={32} className="opacity-20" />
      </div>
    </div>
  );
};

// Leaderboard Row Component
const LeaderboardRow = ({ entry, onEdit }) => {
  const getRankBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <tr className="border-b border-slate-200 hover:bg-slate-50 transition">
      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
        <span className="text-lg mr-2">{getRankBadge(entry.rank)}</span>
        {entry.rank}
      </td>
      <td className="px-6 py-4">
        <div>
          <p className="font-medium text-slate-900">{entry.mentor_username}</p>
          {entry.custom_notes && (
            <p className="text-xs text-slate-500 mt-1">{entry.custom_notes}</p>
          )}
        </div>
      </td>
      <td className={`px-6 py-4 text-center text-sm font-bold ${getScoreColor(entry.overall_score)}`}>
        {entry.overall_score.toFixed(1)}
      </td>
      <td className={`px-6 py-4 text-center text-sm font-semibold ${getScoreColor(entry.sentiment_score)}`}>
        {entry.sentiment_score.toFixed(1)}
      </td>
      <td className={`px-6 py-4 text-center text-sm font-semibold ${getScoreColor(entry.expertise_score)}`}>
        {entry.expertise_score.toFixed(1)}
      </td>
      <td className={`px-6 py-4 text-center text-sm font-semibold ${getScoreColor(entry.engagement_score)}`}>
        {entry.engagement_score.toFixed(1)}
      </td>
      <td className="px-6 py-4 text-sm text-slate-600">
        <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-medium">
          {entry.best_language || 'N/A'}
        </span>
      </td>
      <td className="px-6 py-4 text-center text-sm text-slate-600">
        {entry.total_sessions}
      </td>
      <td className="px-6 py-4 text-center">
        <button
          onClick={onEdit}
          className="p-2 hover:bg-slate-200 rounded-lg transition text-slate-600 hover:text-slate-900"
          title="Edit entry"
        >
          <Edit2 size={18} />
        </button>
      </td>
    </tr>
  );
};

// Edit Row Component
const EditRow = ({ entry, editData, setEditData, onSave, onCancel }) => {
  return (
    <tr className="border-b border-slate-200 bg-blue-50">
      <td colSpan="1" className="px-6 py-4 text-sm font-semibold">
        {entry.rank}
      </td>
      <td colSpan="1" className="px-6 py-4 font-medium">{entry.mentor_username}</td>

      {/* Overall Score */}
      <td className="px-6 py-4">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={editData.sentiment_score + editData.expertise_score + editData.engagement_score}
          disabled
          className="w-16 px-2 py-1 border rounded text-sm text-slate-500 bg-slate-100"
        />
      </td>

      {/* Sentiment Score */}
      <td className="px-6 py-4">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={editData.sentiment_score}
          onChange={(e) =>
            setEditData({ ...editData, sentiment_score: parseFloat(e.target.value) })
          }
          className="w-16 px-2 py-1 border rounded text-sm"
        />
      </td>

      {/* Expertise Score */}
      <td className="px-6 py-4">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={editData.expertise_score}
          onChange={(e) =>
            setEditData({ ...editData, expertise_score: parseFloat(e.target.value) })
          }
          className="w-16 px-2 py-1 border rounded text-sm"
        />
      </td>

      {/* Engagement Score */}
      <td className="px-6 py-4">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={editData.engagement_score}
          onChange={(e) =>
            setEditData({ ...editData, engagement_score: parseFloat(e.target.value) })
          }
          className="w-16 px-2 py-1 border rounded text-sm"
        />
      </td>

      {/* Best Language */}
      <td className="px-6 py-4">
        <input
          type="text"
          value={editData.best_language}
          onChange={(e) => setEditData({ ...editData, best_language: e.target.value })}
          className="w-24 px-2 py-1 border rounded text-sm"
          placeholder="e.g. python"
        />
      </td>

      <td className="px-6 py-4 text-sm text-slate-600">{entry.total_sessions}</td>

      {/* Actions */}
      <td className="px-6 py-4">
        <div className="flex gap-2 justify-center">
          <button
            onClick={onSave}
            className="p-2 hover:bg-green-200 rounded-lg transition text-green-600"
            title="Save"
          >
            <Save size={18} />
          </button>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-red-200 rounded-lg transition text-red-600"
            title="Cancel"
          >
            <X size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default MentorLeaderboardPage;
