import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /** Optional fallback to render instead of the default error UI */
    fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    showStack: boolean;
    copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
        showStack: false,
        copied: false,
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            showStack: false,
            copied: false,
        });
    };

    private handleCopy = async () => {
        const { error, errorInfo } = this.state;
        const text = [
            error?.toString(),
            errorInfo?.componentStack,
        ].filter(Boolean).join('\n\n');

        try {
            await navigator.clipboard.writeText(text);
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        } catch {
            // Clipboard API unavailable — silently ignore
        }
    };

    public render() {
        const { hasError, error, errorInfo, showStack, copied } = this.state;
        const { children, fallback } = this.props;

        if (!hasError) return children;

        if (fallback && error) return fallback(error, this.handleReset);

        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl w-full border border-red-100">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Something went wrong</h1>
                            <p className="text-slate-500 text-sm mt-1">
                                The application encountered an unexpected error.
                            </p>
                        </div>
                    </div>

                    {/* Error message */}
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
                        <p className="text-sm font-mono text-red-700 break-all">
                            {error?.toString() ?? 'Unknown error'}
                        </p>
                    </div>

                    {/* Stack trace toggle */}
                    {errorInfo?.componentStack && (
                        <div className="mb-4">
                            <button
                                onClick={() => this.setState(s => ({ showStack: !s.showStack }))}
                                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mb-2 select-none"
                            >
                                <svg
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${showStack ? 'rotate-90' : ''}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                                {showStack ? 'Hide' : 'Show'} component stack
                            </button>

                            {showStack && (
                                <div className="bg-slate-900 text-slate-300 p-4 rounded-xl overflow-auto max-h-52 text-xs font-mono leading-relaxed">
                                    {errorInfo.componentStack}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 mt-6">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-5 py-2.5 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 active:scale-[0.97] transition-all shadow-md shadow-red-500/20"
                        >
                            Reload page
                        </button>
                        <button
                            onClick={this.handleReset}
                            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 active:scale-[0.97] transition-all"
                        >
                            Try again
                        </button>
                        <button
                            onClick={this.handleCopy}
                            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-500 font-bold text-sm rounded-xl hover:bg-slate-50 active:scale-[0.97] transition-all ml-auto"
                        >
                            {copied ? '✓ Copied' : 'Copy error'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;