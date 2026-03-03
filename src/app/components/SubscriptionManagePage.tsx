import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Crown,
  Calendar,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Loader2,
  Sparkles,
  Zap,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PRODUCTS } from '@/lib/payment';
import { useAnalysisMode } from '@/contexts/AnalysisModeContext';
import { MODE_THEMES } from '@/contexts/ThemeContext';

export function SubscriptionManagePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { subscription, isPremium, refreshSubscription } = useSubscription();
  const { mode } = useAnalysisMode();
  const theme = MODE_THEMES[mode];
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshSubscription();
    setIsRefreshing(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return 0;
    const expires = new Date(expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getPlanName = (plan: string | null) => {
    if (plan === 'premium_monthly') return '프리미엄 월정액';
    if (plan === 'premium_yearly') return '프리미엄 연정액';
    return plan || '없음';
  };

  return (
    <div className="min-h-screen" style={{ background: theme.bgGradient }}>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-white">구독 관리</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:bg-white/10 rounded-full transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {subscription.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : isPremium ? (
          <>
            {/* 현재 구독 상태 */}
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl p-5 border border-amber-500/30 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 bg-amber-500/30 rounded-xl flex items-center justify-center">
                  <Crown className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400 text-sm font-medium">현재 구독 중</p>
                  <p className="text-white text-xl font-bold">{getPlanName(subscription.plan)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-amber-500/20">
                  <span className="text-slate-300 text-sm">만료일</span>
                  <span className="text-white font-medium">{formatDate(subscription.expiresAt)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-amber-500/20">
                  <span className="text-slate-300 text-sm">남은 기간</span>
                  <span className="text-amber-400 font-bold">{getDaysRemaining(subscription.expiresAt)}일</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-300 text-sm">자동 갱신</span>
                  <span className={`font-medium ${subscription.autoRenew ? 'text-green-400' : 'text-slate-400'}`}>
                    {subscription.autoRenew ? '켜짐' : '꺼짐'}
                  </span>
                </div>
              </div>
            </div>

            {/* 구독 혜택 */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mb-6">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                구독 혜택
              </h3>
              <div className="space-y-2">
                {[
                  '상세 사주풀이 무제한',
                  '궁합 분석 무제한',
                  '일진 분석 무제한',
                  '대운/세운/월운 분석',
                  '맞춤 개운법 제공',
                  '고전문헌 원문 해석',
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 관리 버튼 */}
            <div className="space-y-3">
              <button
                onClick={() => navigate('/payment')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition-all border border-slate-700"
              >
                구독 플랜 변경
              </button>
              <button
                className="w-full text-slate-400 hover:text-red-400 text-sm py-2 transition-colors"
              >
                구독 취소하기
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 구독 없음 */}
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-10 h-10 text-slate-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">구독 중인 플랜이 없습니다</h2>
              <p className="text-slate-400 text-sm mb-6">
                프리미엄 구독으로 모든 기능을 무제한으로 이용하세요
              </p>
            </div>

            {/* 구독 플랜 안내 */}
            <div className="space-y-3 mb-6">
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white font-semibold">{PRODUCTS.premium_monthly.name}</p>
                    <p className="text-xs text-slate-400">{PRODUCTS.premium_monthly.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-amber-400">{PRODUCTS.premium_monthly.price.toLocaleString()}원</p>
                    <p className="text-xs text-slate-500">/월</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">33% 할인</span>
                    <p className="text-white font-semibold">{PRODUCTS.premium_yearly.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{PRODUCTS.premium_yearly.price.toLocaleString()}원</p>
                    <p className="text-xs text-slate-500">/년</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{PRODUCTS.premium_yearly.description}</p>
              </div>
            </div>

            {/* 구독하기 버튼 */}
            <button
              onClick={() => navigate('/payment')}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
            >
              <Zap className="w-5 h-5" />
              프리미엄 구독 시작하기
            </button>

            <p className="text-xs text-slate-500 text-center mt-3">
              언제든지 취소 가능 · 7일 환불 보장
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default SubscriptionManagePage;
