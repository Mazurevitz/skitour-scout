/**
 * Root Application Component
 *
 * Main application wrapper with error boundary and providers.
 */

import { Component, type ReactNode } from 'react';
import { MobileDashboard } from './components';

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for catching rendering errors
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-gray-900 text-white p-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-red-400 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-400 mb-4">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Main Application Component
 */
export function App() {
  return (
    <ErrorBoundary>
      <MobileDashboard />
    </ErrorBoundary>
  );
}
