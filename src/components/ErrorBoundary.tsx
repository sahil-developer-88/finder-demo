import React from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">!</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-4">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
            <pre className="text-left text-xs bg-gray-100 rounded-lg p-3 overflow-auto max-h-40 text-gray-600 mb-4">
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
