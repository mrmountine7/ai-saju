import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  CreditCard, 
  Smartphone, 
  Check, 
  Shield,
  Sparkles,
  Crown,
  Zap,
  Gift,
  Clock
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { 
  PRODUCTS, 
  requestPayment, 
  requestEasyPayment,
  type PaymentProduct 
} from '@/lib/payment';

type EasyPayProvider = '토스페이' | '카카오페이' | '네이버페이' | 'PAYCO' | '삼성페이';

export function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const productId = searchParams.get('product') || 'premium_monthly';
  const [selectedProduct, setSelectedProduct] = useState<PaymentProduct>(
    PRODUCTS[productId] || PRODUCTS.premium_monthly
  );
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'easy'>('easy');
  const [easyPayProvider, setEasyPayProvider] = useState<EasyPayProvider>('토스페이');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 상품 선택 탭
  const [productTab, setProductTab] = useState<'subscription' | 'one_time'>(
    selectedProduct.type
  );

  // 구독 상품 목록
  const subscriptionProducts = Object.values(PRODUCTS).filter(p => p.type === 'subscription');
  const oneTimeProducts = Object.values(PRODUCTS).filter(p => p.type === 'one_time');

  // 간편결제 옵션
  const easyPayOptions: { provider: EasyPayProvider; icon: string; color: string }[] = [
    { provider: '토스페이', icon: '💙', color: 'bg-blue-500' },
    { provider: '카카오페이', icon: '💛', color: 'bg-yellow-400' },
    { provider: '네이버페이', icon: '💚', color: 'bg-green-500' },
    { provider: 'PAYCO', icon: '❤️', color: 'bg-red-500' },
    { provider: '삼성페이', icon: '🔵', color: 'bg-blue-600' },
  ];

  // 결제 처리
  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const options = {
        product: selectedProduct,
        userId: user?.id,
        userName: user?.user_metadata?.name || user?.email?.split('@')[0],
        userEmail: user?.email,
      };

      if (paymentMethod === 'easy') {
        await requestEasyPayment(options, easyPayProvider);
      } else {
        await requestPayment(options);
      }
    } catch (err) {
      console.error('결제 오류:', err);
      setError(err instanceof Error ? err.message : '결제 처리 중 오류가 발생했습니다.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-white">결제하기</h1>
          <div className="w-10" />
        </div>

        {/* 상품 선택 탭 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setProductTab('subscription')}
            className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
              productTab === 'subscription'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Crown className="w-4 h-4 inline mr-1" />
            구독
          </button>
          <button
            onClick={() => setProductTab('one_time')}
            className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
              productTab === 'one_time'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Zap className="w-4 h-4 inline mr-1" />
            단건
          </button>
        </div>

        {/* 상품 목록 */}
        <div className="space-y-3 mb-6">
          {(productTab === 'subscription' ? subscriptionProducts : oneTimeProducts).map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className={`w-full p-4 rounded-xl border transition-all text-left ${
                selectedProduct.id === product.id
                  ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/50'
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{product.name}</span>
                    {product.id === 'premium_yearly' && (
                      <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                        33% 할인
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mt-1">{product.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-amber-400">
                    {product.price.toLocaleString()}
                  </span>
                  <span className="text-slate-400 text-sm">원</span>
                  {product.type === 'subscription' && (
                    <p className="text-slate-500 text-xs">/월</p>
                  )}
                </div>
              </div>
              
              {/* 선택 표시 */}
              {selectedProduct.id === product.id && (
                <div className="mt-3 pt-3 border-t border-amber-500/30">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <Check className="w-4 h-4" />
                    선택됨
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* 프리미엄 혜택 (구독 상품일 때만) */}
        {productTab === 'subscription' && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 mb-6 border border-amber-500/30">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              프리미엄 혜택
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                '고전문헌 기반 상세 분석 무제한',
                '대운/세운/월운 심층 해석',
                '일진 캘린더 전체 기능',
                '궁합 분석 무제한',
                '광고 제거',
                'PDF 리포트 무제한 다운로드',
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 결제 수단 선택 */}
        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
          <h3 className="text-white font-medium mb-4">결제 수단</h3>
          
          {/* 결제 방식 선택 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPaymentMethod('easy')}
              className={`flex-1 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'easy'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              간편결제
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={`flex-1 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'card'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              카드결제
            </button>
          </div>

          {/* 간편결제 옵션 */}
          {paymentMethod === 'easy' && (
            <div className="grid grid-cols-3 gap-2">
              {easyPayOptions.map((option) => (
                <button
                  key={option.provider}
                  onClick={() => setEasyPayProvider(option.provider)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    easyPayProvider === option.provider
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <span className="text-xl">{option.icon}</span>
                  <p className="text-xs text-slate-300 mt-1">{option.provider}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 결제 금액 요약 */}
        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400">상품 금액</span>
            <span className="text-white">{selectedProduct.price.toLocaleString()}원</span>
          </div>
          {selectedProduct.id === 'premium_yearly' && (
            <div className="flex justify-between items-center mb-2 text-green-400">
              <span>연간 할인</span>
              <span>-39,800원</span>
            </div>
          )}
          <div className="border-t border-slate-600 my-3" />
          <div className="flex justify-between items-center">
            <span className="text-white font-medium">총 결제 금액</span>
            <span className="text-2xl font-bold text-amber-400">
              {selectedProduct.price.toLocaleString()}원
            </span>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 결제 버튼 */}
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              결제 처리 중...
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              {selectedProduct.price.toLocaleString()}원 결제하기
            </>
          )}
        </button>

        {/* 안내 문구 */}
        <div className="mt-4 space-y-2 text-center text-xs text-slate-500">
          <p className="flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            토스페이먼츠 보안 결제
          </p>
          <p>
            결제 시 <a href="/terms" className="text-amber-400 underline">이용약관</a> 및{' '}
            <a href="/privacy" className="text-amber-400 underline">개인정보처리방침</a>에 동의합니다.
          </p>
          {selectedProduct.type === 'subscription' && (
            <p className="flex items-center justify-center gap-1 text-slate-400">
              <Clock className="w-3 h-3" />
              구독은 언제든 해지 가능합니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
