import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Receipt, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Loader2,
  FileText
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface PaymentRecord {
  id: string;
  order_name: string;
  amount: number;
  status: string;
  method: string;
  created_at: string;
  approved_at?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function PaymentHistoryPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchPayments = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`${API_BASE}/api/payment/purchases/${user.id}`);
        const data = await response.json();
        setPayments(data.purchases || []);
      } catch (error) {
        console.error('결제 내역 조회 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayments();
  }, [user?.id, isAuthenticated, navigate]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DONE':
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
            <CheckCircle className="w-3 h-3" />
            완료
          </span>
        );
      case 'CANCELED':
      case 'refunded':
        return (
          <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" />
            취소
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" />
            대기
          </span>
        );
      default:
        return (
          <span className="text-xs bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full">
            {status}
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <h1 className="text-lg font-bold text-white">결제 내역</h1>
          <div className="w-10" />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400 mb-2">결제 내역이 없습니다</p>
            <button
              onClick={() => navigate('/payment')}
              className="text-amber-400 text-sm hover:underline"
            >
              프리미엄 서비스 둘러보기 →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{payment.order_name}</p>
                      <p className="text-xs text-slate-500">{payment.method || '카드'}</p>
                    </div>
                  </div>
                  {getStatusBadge(payment.status)}
                </div>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3 h-3" />
                    {formatDate(payment.approved_at || payment.created_at)}
                  </div>
                  <p className="font-bold text-white">
                    {payment.amount.toLocaleString()}원
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            결제 관련 문의: support@aisaju.com
          </p>
        </div>
      </div>
    </div>
  );
}

export default PaymentHistoryPage;
