import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Error Boundary for Messaging Page
 * Catches and displays any unhandled errors in the messaging components
 */
class MessagingErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Messaging Error Boundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-full flex items-center justify-center p-8">
                    <div className="max-w-md text-center">
                        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            The messaging system encountered an error. This has been logged.
                        </p>
                        
                        {this.state.error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 text-left">
                                <p className="text-sm font-mono text-red-800 dark:text-red-300">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <button
                                onClick={this.handleReset}
                                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                            >
                                Reload Page
                            </button>
                            <button
                                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                            >
                                Try Again
                            </button>
                        </div>

                        <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                            <p>If this problem persists:</p>
                            <ul className="list-disc list-inside mt-2 text-left">
                                <li>Check your internet connection</li>
                                <li>Clear browser cache and cookies</li>
                                <li>Try logging out and back in</li>
                                <li>Contact support if the issue continues</li>
                            </ul>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default MessagingErrorBoundary;
