import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Crown, 
  Check, 
  BookOpen, 
  Search, 
  Users, 
  FileText, 
  BarChart3,
  Sparkles,
  Shield
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { EXPERT_FEATURES, EXPERT_MONTHLY_PRICE, EXPERT_YEARLY_PRICE, formatPrice } from '@/lib/payment-config';

export function ExpertSubscriptionPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isExpertUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/expert/subscription' } });
      return;
    }

    setIsProcessing(true);
    
    // 결제 처리 시뮬레이션 (실제 구현 시 결제 모듈 연동)
    setTimeout(() => {
      setIsProcessing(false);
      alert('결제 완료! 전문가 모드가 활성화되었습니다.');
      navigate('/expert');
    }, 1500);
  };

  if (isExpertUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-white">전문가 모드</h1>
          </div>

          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">이미 전문가 회원입니다</h2>
            <p className="text-slate-400 mb-6">
              전문가 모드의 모든 기능을 이용하실 수 있습니다
            </p>
            <button
              onClick={() => navigate('/expert')}
              className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-6 rounded-xl transition-colors"
            >
              전문가 모드로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  const yearlyDiscount = Math.round((1 - (EXPERT_YEARLY_PRICE / (EXPERT_MONTHLY_PRICE * 12))) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">전문가 모드 구독</h1>
        </div>

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">전문가 모드</h2>
          <p className="text-slate-400">
            역술인, 상담사를 위한 프로페셔널 분석 도구
          </p>
        </div>

        {/* Features */}
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700 mb-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            전문가 전용 기능
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">고전 9종 심층 분석</h4>
                <p className="text-xs text-slate-400">삼명통회, 적천수 등 고전 원문 기반 깊이 있는 분석</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Search className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">고전 원문 검색</h4>
                <p className="text-xs text-slate-400">3,238개 청크에서 키워드/상황별 원문 검색</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">고객 관리</h4>
                <p className="text-xs text-slate-400">상담 고객 프로필 저장 및 이력 관리</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">사주 비교 분석</h4>
                <p className="text-xs text-slate-400">여러 사주를 동시에 비교하고 관계 분석</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">다양한 내보내기</h4>
                <p className="text-xs text-slate-400">PDF, Excel, 텍스트 형식으로 결과 내보내기</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="space-y-3 mb-6">
          {/* Yearly Plan */}
          <button
            onClick={() => setSelectedPlan('yearly')}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              selectedPlan === 'yearly'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">연간 구독</span>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                  {yearlyDiscount}% 할인
                </span>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === 'yearly'
                  ? 'border-purple-500 bg-purple-500'
                  : 'border-slate-500'
              }`}>
                {selectedPlan === 'yearly' && <Check className="w-3 h-3 text-white" />}
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{formatPrice(EXPERT_YEARLY_PRICE)}</span>
              <span className="text-slate-400 text-sm">/년</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              월 {formatPrice(Math.round(EXPERT_YEARLY_PRICE / 12))} 상당
            </p>
          </button>

          {/* Monthly Plan */}
          <button
            onClick={() => setSelectedPlan('monthly')}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              selectedPlan === 'monthly'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white">월간 구독</span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === 'monthly'
                  ? 'border-purple-500 bg-purple-500'
                  : 'border-slate-500'
              }`}>
                {selectedPlan === 'monthly' && <Check className="w-3 h-3 text-white" />}
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{formatPrice(EXPERT_MONTHLY_PRICE)}</span>
              <span className="text-slate-400 text-sm">/월</span>
            </div>
          </button>
        </div>

        {/* Feature List */}
        <div className="bg-slate-800/30 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-medium text-white mb-3">구독 시 포함</h4>
          <div className="space-y-2">
            {EXPERT_FEATURES.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Subscribe Button */}
        <button
          onClick={handleSubscribe}
          disabled={isProcessing}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              처리 중...
            </>
          ) : (
            <>
              <Crown className="w-5 h-5" />
              {selectedPlan === 'yearly' 
                ? `연간 ${formatPrice(EXPERT_YEARLY_PRICE)}로 시작하기`
                : `월간 ${formatPrice(EXPERT_MONTHLY_PRICE)}로 시작하기`
              }
            </>
          )}
        </button>

        {/* Guarantee */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <Shield className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500">7일 무료 체험 · 언제든 취소 가능</span>
        </div>
      </div>
    </div>
  );
}

export default ExpertSubscriptionPage;
