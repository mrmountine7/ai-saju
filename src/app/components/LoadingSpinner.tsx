import { Loader2, Database } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  submessage?: string;
  showIcon?: boolean;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = 'md',
  message,
  submessage,
  showIcon = true,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const content = (
    <div className="text-center">
      <div className="relative inline-block">
        <Loader2 className={`animate-spin text-amber-400 ${sizeClasses[size]}`} />
        {showIcon && (
          <Database className={`text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${iconSizes[size]}`} />
        )}
      </div>
      {message && (
        <p className={`text-white mt-4 font-medium ${size === 'sm' ? 'text-sm' : ''}`}>
          {message}
        </p>
      )}
      {submessage && (
        <p className={`text-slate-400 mt-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {submessage}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

// 버튼 내부 로딩 스피너
export function ButtonSpinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`w-4 h-4 animate-spin ${className}`} />;
}

// 스켈레톤 로더
export function Skeleton({ className = '', variant = 'rectangular' }: { 
  className?: string; 
  variant?: 'rectangular' | 'circular' | 'text';
}) {
  const baseClasses = 'animate-pulse bg-slate-700/50';
  const variantClasses = {
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded h-4',
  };

  return <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />;
}

// 프로필 카드 스켈레톤
export function ProfileCardSkeleton() {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" className="w-14 h-14" />
        <div className="flex-1">
          <Skeleton className="w-24 h-5 mb-2" />
          <Skeleton className="w-32 h-4" />
        </div>
      </div>
    </div>
  );
}

// 분석 결과 스켈레톤
export function AnalysisResultSkeleton() {
  return (
    <div className="space-y-6">
      {/* 사주 원국 스켈레톤 */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
        <Skeleton className="w-24 h-6 mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center">
              <Skeleton className="w-full h-20 rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* 오행 분포 스켈레톤 */}
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>

      {/* 분석 내용 스켈레톤 */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 space-y-4">
        <Skeleton className="w-32 h-6" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-3/4 h-4" />
      </div>
    </div>
  );
}

export default LoadingSpinner;
