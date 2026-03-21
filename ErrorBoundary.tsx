import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Technoir] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 font-mono text-center">
          <div className="max-w-lg space-y-6">
            <h1 className="text-3xl font-orbitron text-red-600 uppercase tracking-tighter">
              TRANSMISSION_CORRUPTED
            </h1>
            <p className="text-xs text-gray-500 leading-relaxed">
              A critical error interrupted the neural uplink. The system could not recover.
            </p>
            {this.state.error && (
              <pre className="text-[10px] text-red-900 border border-red-950 bg-red-950/10 p-4 text-left overflow-auto max-h-40 rounded">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 border border-cyan-800 text-cyan-600 text-[10px] uppercase tracking-widest hover:bg-cyan-950 transition-colors font-orbitron"
            >
              REINITIALIZE_UPLINK
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
