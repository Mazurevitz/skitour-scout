/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays a fallback UI.
 */

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 bg-gray-800/50 rounded-xl border border-gray-700">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            Coś poszło nie tak
          </h3>
          <p className="text-sm text-gray-400 text-center mb-4 max-w-sm">
            {this.state.error?.message || 'Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Spróbuj ponownie
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Async Error Boundary for Suspense-like error handling
 * Wraps components that may throw during async operations
 */
interface AsyncBoundaryProps {
  children: ReactNode;
  errorFallback?: ReactNode;
  loadingFallback?: ReactNode;
}

export function AsyncBoundary({ children, errorFallback }: AsyncBoundaryProps) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      {children}
    </ErrorBoundary>
  );
}
