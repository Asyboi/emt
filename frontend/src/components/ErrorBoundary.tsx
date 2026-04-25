import { AlertOctagon, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The hackathon stack has no remote logger; surface the failure in the
    // console so a developer scrubbing through DevTools still sees it.
    console.error(`[${this.props.label ?? "ErrorBoundary"}]`, error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex flex-col h-full items-center justify-center p-6 text-center">
          <div className="rounded-full bg-red-50 border border-red-200 p-3 mb-3">
            <AlertOctagon className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">
            {this.props.label ? `${this.props.label} crashed` : "Something went wrong"}
          </h3>
          <p className="text-sm text-gray-600 max-w-sm mb-4">
            We hit an unexpected error rendering this panel. The rest of the
            review is still safe to use.
          </p>
          <p className="text-xs font-mono text-gray-400 mb-4 max-w-sm break-words">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
