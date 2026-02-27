import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // 에러 로깅 서비스로 전송 (예: Sentry)
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error);
    // }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 max-w-lg w-full border border-slate-700 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">
              문제가 발생했습니다
            </h1>
            <p className="text-slate-400 mb-6">
              예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                새로고침
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
              >
                <Home className="w-5 h-5" />
                홈으로
              </button>
            </div>

            {/* 에러 상세 정보 (개발/디버깅용) */}
            {this.state.error && (
              <div className="text-left">
                <button
                  onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-400 transition-colors mx-auto"
                >
                  {this.state.showDetails ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      오류 상세 정보 숨기기
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      오류 상세 정보 보기
                    </>
                  )}
                </button>

                {this.state.showDetails && (
                  <div className="mt-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700 overflow-auto max-h-48">
                    <p className="text-xs text-red-400 font-mono mb-2">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                    {this.state.error.stack && (
                      <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap">
                        {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 함수형 래퍼 컴포넌트
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
