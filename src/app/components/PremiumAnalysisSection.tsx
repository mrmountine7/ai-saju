import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Moon, 
  Sparkles, 
  Lock, 
  ChevronDown, 
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Zap,
  BookOpen,
  X,
  CreditCard,
  Shield,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { 
  analyzeDaewoon, 
  analyzeSewoon, 
  analyzeWolwoon, 
  analyzeGaewoon,
  FortuneAnalysisResponse,
  GaewoonResponse,
  DaewoonItem,
} from '@/lib/saju-api-client';
import { PRODUCTS, requestPayment } from '@/lib/payment';

interface PremiumAnalysisSectionProps {
  profileData: {
    name: string;
    gender: 'male' | 'female';
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    is_lunar: boolean;
    is_leap_month?: boolean;
  };
  yongshen?: string;
  onUpgradeClick: () => void;
}

type FortuneTab = 'daewoon' | 'sewoon' | 'wolwoon';

export function PremiumAnalysisSection({ 
  profileData, 
  yongshen,
  onUpgradeClick 
}: PremiumAnalysisSectionProps) {
  const { isAuthenticated, isPremiumUser, user } = useAuth();
  const { isPremium, purchases, checkAccess, refreshPurchases } = useSubscription();
  const [activeTab, setActiveTab] = useState<FortuneTab>('sewoon');
  const [loading, setLoading] = useState(false);
  const [fortuneData, setFortuneData] = useState<FortuneAnalysisResponse | null>(null);
  const [gaewoonData, setGaewoonData] = useState<GaewoonResponse | null>(null);
  const [expandedDaewoon, setExpandedDaewoon] = useState(false);
  const [showGaewoon, setShowGaewoon] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<'one_time' | 'subscription'>('one_time');
  
  const targetYear = new Date().getFullYear();
  const targetMonth = new Date().getMonth() + 1;

  // 구독자이거나 단건 구매가 있는 경우 접근 가능
  const hasAccess = isPremium || isPremiumUser || purchases['detailed_analysis']?.hasPurchase;

  useEffect(() => {
    if ((hasAccess || isPaid) && profileData) {
      loadFortuneData(activeTab);
    }
  }, [hasAccess, isPaid, activeTab, profileData]);

  const loadFortuneData = async (tab: FortuneTab) => {
    setLoading(true);
    try {
      const request = {
        ...profileData,
        target_year: targetYear,
        target_month: targetMonth,
      };

      let data: FortuneAnalysisResponse;
      if (tab === 'daewoon') {
        data = await analyzeDaewoon(request);
      } else if (tab === 'sewoon') {
        data = await analyzeSewoon(request);
      } else {
        data = await analyzeWolwoon(request);
      }
      setFortuneData(data);
    } catch (error) {
      console.error('운세 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGaewoonData = async () => {
    if (gaewoonData) {
      setShowGaewoon(!showGaewoon);
      return;
    }

    setLoading(true);
    try {
      const data = await analyzeGaewoon({
        ...profileData,
        yongshen: yongshen || '',
      });
      setGaewoonData(data);
      setShowGaewoon(true);
    } catch (error) {
      console.error('개운법 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentClick = () => {
    setShowPaymentModal(true);
  };

  // 실제 토스페이먼츠 결제 요청
  const handleConfirmPayment = async () => {
    setIsPaymentProcessing(true);
    
    try {
      const product = selectedPaymentType === 'subscription' 
        ? PRODUCTS.premium_monthly 
        : PRODUCTS.detailed_analysis;
      
      await requestPayment({
        product,
        userId: user?.id,
        userName: user?.name || profileData.name,
        userEmail: user?.email,
      });
      
      // 결제 완료 후 (리다이렉트 되므로 여기 도달하지 않음)
    } catch (error) {
      console.error('결제 요청 실패:', error);
      setIsPaymentProcessing(false);
    }
  };

  // 결제 완료 후 상태 확인 (결제 성공 페이지에서 돌아온 경우)
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (user?.id) {
        const hasDetailedAccess = await checkAccess('detailed_analysis');
        if (hasDetailedAccess) {
          setIsPaid(true);
          loadFortuneData(activeTab);
        }
      }
    };
    
    checkPaymentStatus();
  }, [user?.id]);

  if (!hasAccess && !isPaid) {
    return (
      <>
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl p-5 border border-amber-500/30 mb-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              프리미엄 분석 잠금 해제
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              대운/세운/월운 상세 분석과 맞춤 개운법을 확인하세요
            </p>
            
            <div className="bg-slate-800/50 rounded-xl p-4 mb-4 text-left">
              <h4 className="text-sm font-medium text-amber-400 mb-3">포함된 기능</h4>
              <div className="space-y-2">
                {[
                  '대운 흐름 상세 분석',
                  `${targetYear}년 세운 분석`,
                  '월별 운세 분석',
                  '원국에 미치는 영향 분석',
                  '용신 기반 맞춤 개운법',
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handlePaymentClick}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              상세분석 (향후 유료 전환)
            </button>
            
            <p className="text-xs text-slate-500 text-center mt-3">
              삼명통회, 적천수천미, 신봉통고 등 9종 고전 3,238개 청크 기반 분석
            </p>
          </div>
        </div>

        {/* 결제 페이지 모달 */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-700">
              {/* 모달 헤더 */}
              <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="p-1 hover:bg-slate-800 rounded-full text-slate-400"
                    disabled={isPaymentProcessing}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-bold text-white">프리미엄 분석 결제</h2>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-1 hover:bg-slate-800 rounded-full text-slate-400"
                  disabled={isPaymentProcessing}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 모달 내용 */}
              <div className="p-5 space-y-5">
                {/* 결제 타입 선택 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">결제 방식 선택</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedPaymentType('one_time')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedPaymentType === 'one_time'
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <p className={`font-medium ${selectedPaymentType === 'one_time' ? 'text-amber-400' : 'text-white'}`}>
                        1회 이용권
                      </p>
                      <p className="text-lg font-bold text-white">{PRODUCTS.detailed_analysis.price.toLocaleString()}원</p>
                    </button>
                    <button
                      onClick={() => setSelectedPaymentType('subscription')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedPaymentType === 'subscription'
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <p className={`font-medium ${selectedPaymentType === 'subscription' ? 'text-amber-400' : 'text-white'}`}>
                        월정액 (무제한)
                      </p>
                      <p className="text-lg font-bold text-white">{PRODUCTS.premium_monthly.price.toLocaleString()}원<span className="text-xs text-slate-400">/월</span></p>
                    </button>
                  </div>
                </div>

                {/* 상품 정보 */}
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {selectedPaymentType === 'subscription' ? PRODUCTS.premium_monthly.name : PRODUCTS.detailed_analysis.name}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {selectedPaymentType === 'subscription' ? '모든 프리미엄 기능 무제한' : '1회 이용권'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-slate-400 text-sm">결제 금액</span>
                    <div>
                      <span className="text-2xl font-bold text-amber-400">
                        {(selectedPaymentType === 'subscription' ? PRODUCTS.premium_monthly.price : PRODUCTS.detailed_analysis.price).toLocaleString()}
                      </span>
                      <span className="text-slate-400 ml-1">원</span>
                    </div>
                  </div>
                </div>

                {/* 포함된 기능 */}
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    포함된 분석 내용
                  </h4>
                  <div className="space-y-2">
                    {[
                      { title: '대운 상세 분석', desc: '10년 단위 운세 흐름' },
                      { title: '세운 분석', desc: `${targetYear}년 연간 운세` },
                      { title: '월운 분석', desc: '월별 상세 운세' },
                      { title: '원국 영향 분석', desc: '사주와의 상호작용' },
                      { title: '맞춤 개운법', desc: '용신 기반 행운 조언' },
                      { title: '고전 원문 해석', desc: '9종 고전 3,238개 청크' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1">
                        <span className="text-sm text-white">{item.title}</span>
                        <span className="text-xs text-slate-500">{item.desc}</span>
                      </div>
                    ))}
                    {selectedPaymentType === 'subscription' && (
                      <>
                        <div className="border-t border-slate-700 my-2" />
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-amber-400 font-medium">월정액 추가 혜택</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-white">궁합 분석 무제한</span>
                          <span className="text-xs text-green-400">포함</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-white">일진 분석 무제한</span>
                          <span className="text-xs text-green-400">포함</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 안전 결제 안내 */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Shield className="w-4 h-4" />
                  <span>토스페이먼츠 안전 결제 · 언제든 취소 가능</span>
                </div>

                {/* 결제 버튼 */}
                <button
                  onClick={handleConfirmPayment}
                  disabled={isPaymentProcessing}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPaymentProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      결제 준비 중...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      {(selectedPaymentType === 'subscription' ? PRODUCTS.premium_monthly.price : PRODUCTS.detailed_analysis.price).toLocaleString()}원 결제하기
                    </>
                  )}
                </button>

                <p className="text-xs text-slate-500 text-center">
                  결제 시 이용약관 및 환불정책에 동의하는 것으로 간주됩니다
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Fortune Tabs */}
      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            운세 상세 분석
          </h3>
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
            프리미엄
          </span>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'daewoon', label: '대운', icon: TrendingUp },
            { id: 'sewoon', label: '세운', icon: Calendar },
            { id: 'wolwoon', label: '월운', icon: Moon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as FortuneTab)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === id
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400 mx-auto mb-2"></div>
            <p className="text-sm text-slate-400">분석 중...</p>
          </div>
        ) : fortuneData && fortuneData.success ? (
          <div className="space-y-4">
            {/* Current Fortune */}
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-white">
                  {activeTab === 'daewoon' && '현재 대운'}
                  {activeTab === 'sewoon' && `${targetYear}년 세운`}
                  {activeTab === 'wolwoon' && `${targetYear}년 ${targetMonth}월 월운`}
                </h4>
                <span className="text-lg font-bold text-amber-400">
                  {fortuneData.current_fortune.gan_ko}
                  {fortuneData.current_fortune.zhi_ko}
                </span>
              </div>
              {fortuneData.current_fortune.shishen && (
                <p className="text-sm text-slate-400 mb-2">
                  십신: {fortuneData.current_fortune.shishen}
                </p>
              )}
              {activeTab === 'daewoon' && fortuneData.current_fortune.age_start && (
                <p className="text-sm text-slate-400">
                  {fortuneData.current_fortune.age_start}세 ~ {fortuneData.current_fortune.age_end}세
                </p>
              )}
            </div>

            {/* Daewoon List (expandable) */}
            {activeTab === 'daewoon' && fortuneData.fortune_list.length > 0 && (
              <div className="bg-slate-700/30 rounded-xl p-3">
                <button
                  onClick={() => setExpandedDaewoon(!expandedDaewoon)}
                  className="w-full flex items-center justify-between text-sm text-slate-300"
                >
                  <span>전체 대운 보기</span>
                  {expandedDaewoon ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {expandedDaewoon && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {fortuneData.fortune_list.map((dw: DaewoonItem, idx: number) => (
                      <div
                        key={idx}
                        className={`text-center p-2 rounded-lg ${
                          dw.is_current
                            ? 'bg-amber-500/20 border border-amber-500/50'
                            : 'bg-slate-800/50'
                        }`}
                      >
                        <p className="text-xs text-slate-400">{dw.age_start}세</p>
                        <p className={`text-sm font-medium ${dw.is_current ? 'text-amber-400' : 'text-white'}`}>
                          {dw.gan_ko}{dw.zhi_ko}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Positive/Negative Factors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
                <h5 className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  긍정적 요소
                </h5>
                <ul className="space-y-1">
                  {fortuneData.positive_factors.map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-300">• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                <h5 className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  주의할 요소
                </h5>
                <ul className="space-y-1">
                  {fortuneData.negative_factors.map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-300">• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Impact & Analysis */}
            {fortuneData.impact_on_wonguk && (
              <div className="bg-slate-700/30 rounded-xl p-4">
                <h5 className="text-sm font-medium text-amber-400 mb-2">원국에 미치는 영향</h5>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {fortuneData.impact_on_wonguk}
                </p>
              </div>
            )}

            {fortuneData.detailed_analysis && (
              <div className="bg-slate-700/30 rounded-xl p-4">
                <h5 className="text-sm font-medium text-white mb-2">상세 분석</h5>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {fortuneData.detailed_analysis}
                </p>
              </div>
            )}

            {/* Classical References */}
            {fortuneData.classical_references.length > 0 && (
              <div className="bg-slate-700/20 rounded-xl p-3">
                <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  고전 문헌 참조
                </h5>
                <div className="space-y-2">
                  {fortuneData.classical_references.slice(0, 2).map((ref, idx) => (
                    <div key={idx} className="text-xs text-slate-400">
                      <span className="text-amber-400/80">[{ref.book_title}]</span> {ref.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400">데이터를 불러올 수 없습니다.</p>
          </div>
        )}
      </div>

      {/* Gaewoon Section */}
      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
        <button
          onClick={loadGaewoonData}
          className="w-full flex items-center justify-between"
        >
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            맞춤 개운법
          </h3>
          {showGaewoon ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showGaewoon && gaewoonData && gaewoonData.success && (
          <div className="mt-4 space-y-4">
            {/* Yongshen Element */}
            <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 text-center">
              <p className="text-xs text-slate-400 mb-1">용신 오행</p>
              <p className="text-lg font-bold text-emerald-400">
                {gaewoonData.yongshen_element}
              </p>
            </div>

            {/* Quick Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">행운 색상</p>
                <div className="flex flex-wrap gap-1">
                  {gaewoonData.favorable_colors.map((color, idx) => (
                    <span key={idx} className="text-xs bg-slate-600 px-2 py-0.5 rounded text-white">
                      {color}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">행운 방위</p>
                <div className="flex flex-wrap gap-1">
                  {gaewoonData.favorable_directions.map((dir, idx) => (
                    <span key={idx} className="text-xs bg-slate-600 px-2 py-0.5 rounded text-white">
                      {dir}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">행운 숫자</p>
                <div className="flex gap-1">
                  {gaewoonData.favorable_numbers.map((num, idx) => (
                    <span key={idx} className="text-xs bg-slate-600 px-2 py-0.5 rounded text-white">
                      {num}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">좋은 음식</p>
                <div className="flex flex-wrap gap-1">
                  {gaewoonData.favorable_foods.slice(0, 2).map((food, idx) => (
                    <span key={idx} className="text-xs bg-slate-600 px-2 py-0.5 rounded text-white">
                      {food}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Methods */}
            {gaewoonData.gaewoon_methods.map((method, idx) => (
              <div key={idx} className="bg-slate-700/30 rounded-xl p-3">
                <h5 className="text-sm font-medium text-emerald-400 mb-2">{method.category}</h5>
                <ul className="space-y-1">
                  {method.items.map((item, i) => (
                    <li key={i} className="text-xs text-slate-300">• {item}</li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Detailed Advice */}
            {gaewoonData.detailed_advice && (
              <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20">
                <h5 className="text-sm font-medium text-emerald-400 mb-2">맞춤 조언</h5>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {gaewoonData.detailed_advice}
                </p>
              </div>
            )}
          </div>
        )}

        {showGaewoon && loading && (
          <div className="mt-4 text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-400 mx-auto"></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PremiumAnalysisSection;
