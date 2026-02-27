import { useState } from 'react';
import { X, Shield, Smartphone, CreditCard, Check, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { 
  PRODUCTS, 
  requestPayment, 
  requestEasyPayment,
  type PaymentProduct 
} from '@/lib/payment';

type EasyPayProvider = '토스페이' | '카카오페이' | '네이버페이';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  onPaymentStart?: () => void;
}

export function PaymentModal({ isOpen, onClose, productId, onPaymentStart }: PaymentModalProps) {
  const { user } = useAuth();
  const [selectedProduct] = useState<PaymentProduct>(
    PRODUCTS[productId || 'detailed_analysis'] || PRODUCTS.detailed_analysis
  );
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'easy'>('easy');
  const [easyPayProvider, setEasyPayProvider] = useState<EasyPayProvider>('토스페이');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const easyPayOptions: { provider: EasyPayProvider; icon: string; bg: string }[] = [
    { provider: '토스페이', icon: '💙', bg: 'bg-blue-500' },
    { provider: '카카오페이', icon: '💛', bg: 'bg-yellow-400' },
    { provider: '네이버페이', icon: '💚', bg: 'bg-green-500' },
  ];

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);
    onPaymentStart?.();
    
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
    <>
      {/* 백드롭 */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* 모달 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="max-w-lg mx-auto bg-slate-900 rounded-t-3xl border-t border-slate-700 overflow-hidden">
          {/* 핸들 */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-slate-600 rounded-full" />
          </div>
          
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 pb-4">
            <h2 className="text-lg font-bold text-white">결제하기</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="px-6 pb-8">
            {/* 상품 정보 */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 mb-4 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span className="text-white font-medium">{selectedProduct.name}</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">{selectedProduct.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-amber-400">
                    {selectedProduct.price.toLocaleString()}
                  </span>
                  <span className="text-slate-400">원</span>
                </div>
              </div>
            </div>

            {/* 결제 방식 선택 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setPaymentMethod('easy')}
                className={`flex-1 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'easy'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
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
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                카드결제
              </button>
            </div>

            {/* 간편결제 옵션 */}
            {paymentMethod === 'easy' && (
              <div className="flex gap-2 mb-4">
                {easyPayOptions.map((option) => (
                  <button
                    key={option.provider}
                    onClick={() => setEasyPayProvider(option.provider)}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${
                      easyPayProvider === option.provider
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-lg">{option.icon}</span>
                    <p className="text-xs text-slate-300 mt-1">{option.provider}</p>
                  </button>
                ))}
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 결제 버튼 */}
            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-50"
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

            {/* 안내 */}
            <p className="text-center text-xs text-slate-500 mt-3">
              <Shield className="w-3 h-3 inline mr-1" />
              토스페이먼츠 보안 결제
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
