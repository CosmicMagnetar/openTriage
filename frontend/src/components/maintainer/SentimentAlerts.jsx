import { useState, useEffect } from 'react';
import { AlertTriangle, MessageSquare, ExternalLink, ShieldAlert, TrendingDown, CheckCircle } from 'lucide-react';
import { sentimentApi } from '../../services/api';

const SentimentAlerts = ({ repoName = null }) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        loadAlerts();
    }, [repoName]);

    const loadAlerts = async () => {
        try {
            setLoading(true);
            const data = await sentimentApi.analyzeSentiment(repoName, true);

            // Filter for negative sentiment
            const negativeItems = (data.results || []).filter(
                item => item.sentiment === 'NEGATIVE' || item.sentiment === 'TOXIC'
            );

            setAlerts(negativeItems.slice(0, 10));
            setStats(data.stats);
        } catch (error) {
            console.error('Failed to load sentiment alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const runAnalysis = async () => {
        try {
            setAnalyzing(true);
            await sentimentApi.analyzeSentiment(repoName, false);
            await loadAlerts();
        } catch (error) {
            console.error('Failed to run sentiment analysis:', error);
        } finally {
            setAnalyzing(false);
        }
    };

    const getSeverityColor = (sentiment) => {
        switch (sentiment) {
            case 'TOXIC': return 'bg-red-500/20 border-red-500/50 text-red-400';
            case 'NEGATIVE': return 'bg-orange-500/20 border-orange-500/50 text-orange-400';
            default: return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
        }
    };

    const getSeverityIcon = (sentiment) => {
        switch (sentiment) {
            case 'TOXIC': return ShieldAlert;
            case 'NEGATIVE': return AlertTriangle;
            default: return TrendingDown;
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <ShieldAlert className="w-6 h-6 text-red-400" />
                    <h2 className="text-lg font-bold text-slate-200">Sentiment Alerts</h2>
                </div>
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="w-6 h-6 text-red-400" />
                    <div>
                        <h2 className="text-lg font-bold text-slate-200">Sentiment Alerts</h2>
                        <p className="text-xs text-slate-400">Monitoring community health</p>
                    </div>
                </div>

                <button
                    onClick={runAnalysis}
                    disabled={analyzing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm 
                    font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                    {analyzing ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <ShieldAlert className="w-4 h-4" />
                            Run Analysis
                        </>
                    )}
                </button>
            </div>

            {/* Stats Summary */}
            {stats && (
                <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="bg-emerald-500/10 rounded-lg p-3 text-center border border-emerald-500/30">
                        <div className="text-xl font-bold text-emerald-400">{stats.positive || 0}</div>
                        <div className="text-xs text-emerald-400/70">Positive</div>
                    </div>
                    <div className="bg-blue-500/10 rounded-lg p-3 text-center border border-blue-500/30">
                        <div className="text-xl font-bold text-blue-400">{stats.neutral || 0}</div>
                        <div className="text-xs text-blue-400/70">Neutral</div>
                    </div>
                    <div className="bg-orange-500/10 rounded-lg p-3 text-center border border-orange-500/30">
                        <div className="text-xl font-bold text-orange-400">{stats.negative || 0}</div>
                        <div className="text-xs text-orange-400/70">Negative</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-3 text-center border border-red-500/30">
                        <div className="text-xl font-bold text-red-400">{stats.toxic || 0}</div>
                        <div className="text-xs text-red-400/70">Flagged</div>
                    </div>
                </div>
            )}

            {/* Alerts List */}
            {alerts.length > 0 ? (
                <div className="space-y-3">
                    {alerts.map((alert, i) => {
                        const SeverityIcon = getSeverityIcon(alert.sentiment);

                        return (
                            <div
                                key={i}
                                className={`p-4 rounded-lg border ${getSeverityColor(alert.sentiment)}`}
                            >
                                <div className="flex items-start gap-3">
                                    <SeverityIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-slate-200">
                                                {alert.author || 'Unknown user'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs uppercase font-medium
                                      ${alert.sentiment === 'TOXIC' ? 'bg-red-500/30' : 'bg-orange-500/30'}`}>
                                                {alert.sentiment}
                                            </span>
                                        </div>

                                        <p className="text-sm text-slate-300 line-clamp-2">
                                            {alert.content || alert.text}
                                        </p>

                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="text-xs text-slate-500">
                                                {alert.source || 'Comment'} • {alert.date || 'Recently'}
                                            </span>

                                            {alert.url && (
                                                <a
                                                    href={alert.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                                                >
                                                    View context
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        className="px-3 py-1.5 text-xs bg-slate-600 text-slate-300 rounded-lg 
                              hover:bg-slate-500 transition-colors"
                                        onClick={() => alert('Feature coming soon: Quick moderation actions')}
                                    >
                                        Review
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
                    <p className="text-emerald-400 font-medium">Community is healthy!</p>
                    <p className="text-sm text-slate-500 mt-1">No concerning comments detected</p>
                </div>
            )}

            {/* Footer Note */}
            <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 text-center">
                    Sentiment analysis is AI-powered. Always review flagged content manually.
                </p>
            </div>
        </div>
    );
};

export default SentimentAlerts;
