import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Home, 
  RotateCcw,
  Sparkles,
  FileText,
  Clock
} from 'lucide-react';
import { confirmPayment } from '@/lib/payment';

type ResultType = 'success' | 'fail' | 'processing';

export function PaymentResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // URL 파라미터에서 결제 정보 추출
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const errorCode = searchParams.get('code');
  const errorMessage = searchParams.get('message');
  
  const [result, setResult] = useState<ResultType>('processing');
  const [paymentData, setPaymentData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  // 결제 성공 시 승인 요청
  useEffect(() => {
    const processPayment = async () => {
      // 실패 파라미터가 있으면 바로 실패 처리
      if (errorCode || errorMessage) {
        setResult('fail');
        setError(errorMessage || '결제가 취소되었습니다.');
        return;
      }

      // 성공 파라미터가 있으면 승인 요청
      if (paymentKey && orderId && amount) {
        try {
          const response = await confirmPayment(paymentKey, orderId, parseInt(amount));
          
          if (response.success) {
            setResult('success');
            setPaymentData(response.data);
          } else {
            setResult('fail');
            setError(response.error || '결제 승인에 실패했습니다.');
          }
        } catch (err) {
          setResult('fail');
          setError('결제 처리 중 오류가 발생했습니다.');
        }
      } else {
        // 파라미터 없으면 실패
        setResult('fail');
        setError('결제 정보가 올바르지 않습니다.');
      }
    };

    processPayment();
  }, [paymentKey, orderId, amount, errorCode, errorMessage]);

  // 주문 ID에서 상품 정보 추출
  const getProductName = () => {
    if (!orderId) return '결제 상품';
    
    const productMap: Record<string, string> = {
      'premium_monthly': '프리미엄 월정액',
      'premium_yearly': '프리미엄 연정액',
      'detailed_analysis': '상세 사주풀이',
      'compatibility': '궁합 분석',
      'yearly_fortune': '신년운세 리포트',
    };
    
    for (const [key, name] of Object.entries(productMap)) {
      if (orderId.startsWith(key)) return name;
    }
    return '결제 상품';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        {/* 처리 중 */}
        {result === 'processing' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-amber-500/30 rounded-full animate-ping" />
              <div className="absolute inset-2 border-4 border-amber-500/50 rounded-full animate-pulse" />
              <Clock className="absolute inset-0 m-auto w-10 h-10 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">결제 처리 중</h1>
            <p className="text-slate-400">잠시만 기다려주세요...</p>
          </>
        )}

        {/* 성공 */}
        {result === 'success' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">결제 완료!</h1>
            <p className="text-slate-400 mb-6">
              {getProductName()} 결제가 완료되었습니다.
            </p>
            
            {/* 결제 정보 */}
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700 text-left">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">상품명</span>
                  <span className="text-white">{getProductName()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">결제금액</span>
                  <span className="text-amber-400 font-medium">
                    {amount ? parseInt(amount).toLocaleString() : '-'}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">주문번호</span>
                  <span className="text-slate-300 text-xs">{orderId?.substring(0, 20)}...</span>
                </div>
              </div>
            </div>

            {/* 이용 안내 */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 mb-6 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span className="text-white font-medium">프리미엄 이용 안내</span>
              </div>
              <p className="text-slate-300 text-sm">
                지금 바로 모든 프리미엄 기능을 이용하실 수 있습니다.
              </p>
            </div>

            {/* 버튼 */}
            <div className="space-y-3">
              <button
                onClick={() => navigate('/result')}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                사주풀이 시작하기
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-slate-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                홈으로
              </button>
            </div>
          </>
        )}

        {/* 실패 */}
        {result === 'fail' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
              <XCircle className="w-12 h-12 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">결제 실패</h1>
            <p className="text-slate-400 mb-2">결제가 완료되지 않았습니다.</p>
            <p className="text-red-400 text-sm mb-6">{error}</p>

            {/* 에러 코드 */}
            {errorCode && (
              <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700 text-left">
                <div className="text-sm">
                  <span className="text-slate-400">오류 코드: </span>
                  <span className="text-slate-300">{errorCode}</span>
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="space-y-3">
              <button
                onClick={() => navigate('/payment')}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                다시 결제하기
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-slate-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                홈으로
              </button>
            </div>
          </>
        )}

        {/* 고객센터 안내 */}
        <p className="text-slate-500 text-xs mt-8">
          결제 관련 문의: support@aisaju.com
        </p>
      </div>
    </div>
  );
}
