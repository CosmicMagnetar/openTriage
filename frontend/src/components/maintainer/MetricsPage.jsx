import { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const MetricsPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await axios.get(`${API}/maintainer/metrics`);
      setMetrics(response.data);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-slate-400">Loading metrics...</div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div data-testid="metrics-page" className="w-full h-full overflow-auto p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-200 mb-2">Metrics</h1>
          <p className="text-slate-400">Analytics and insights for your repositories</p>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6">
          {/* Issues by Day */}
          <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-200 mb-6">Issues Over Time</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics?.issuesByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#e2e8f0'
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Classification & Sentiment */}
          <div className="grid grid-cols-2 gap-6">
            {/* Issues by Classification */}
            <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-slate-200 mb-6">
                Issue Classification
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics?.issuesByClassification || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(metrics?.issuesByClassification || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Sentiment Distribution */}
            <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-slate-200 mb-6">
                Sentiment Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics?.sentimentDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsPage;