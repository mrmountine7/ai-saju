import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard,
  Smartphone,
  Shield,
  RefreshCw,
  HelpCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  Mail,
  MessageCircle
} from 'lucide-react';
import { useAnalysisMode } from '@/contexts/AnalysisModeContext';
import { MODE_THEMES } from '@/contexts/ThemeContext';

export function PaymentGuidePage() {
  const navigate = useNavigate();
  const { mode } = useAnalysisMode();
  const theme = MODE_THEMES[mode];

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
          <h1 className="text-lg font-bold text-white">결제 방식 안내</h1>
          <div className="w-10" />
        </div>

        <div className="space-y-6">
          {/* 간편결제 */}
          <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold">간편결제</h2>
                <p className="text-xs text-slate-400">원터치로 빠른 결제</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: '토스페이', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                { name: '카카오페이', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
                { name: '네이버페이', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
                { name: 'PAYCO', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
                { name: '삼성페이', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
                { name: '애플페이', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
              ].map((pay, idx) => (
                <div 
                  key={idx} 
                  className={`text-center py-2 px-3 rounded-lg border text-xs font-medium ${pay.color}`}
                >
                  {pay.name}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              * 각 간편결제 앱에 등록된 카드로 결제됩니다
            </p>
          </section>

          {/* 신용/체크카드 */}
          <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold">신용/체크카드</h2>
                <p className="text-xs text-slate-400">모든 국내 카드 지원</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['삼성', '신한', '현대', '국민', 'BC', '롯데', '하나', '우리'].map((card, idx) => (
                <div 
                  key={idx} 
                  className="text-center py-2 bg-slate-700/50 rounded-lg text-xs text-slate-300"
                >
                  {card}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              * 해외 카드 (Visa, MasterCard, AMEX) 사용 가능
            </p>
          </section>

          {/* 결제 보안 */}
          <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold">안전한 결제</h2>
                <p className="text-xs text-slate-400">토스페이먼츠 보안 시스템</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { icon: CheckCircle, text: 'PCI-DSS 인증 결제 시스템', color: 'text-green-400' },
                { icon: CheckCircle, text: '카드 정보 암호화 전송 (SSL)', color: 'text-green-400' },
                { icon: CheckCircle, text: '3D Secure 본인인증 지원', color: 'text-green-400' },
                { icon: CheckCircle, text: '금융감독원 등록 PG사', color: 'text-green-400' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span className="text-sm text-slate-300">{item.text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 환불 정책 */}
          <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold">환불 정책</h2>
                <p className="text-xs text-slate-400">안심하고 이용하세요</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">7일 이내 전액 환불</span>
                </div>
                <p className="text-xs text-slate-400 ml-6">
                  결제 후 7일 이내, 서비스 미이용 시 전액 환불
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-white">부분 환불</span>
                </div>
                <p className="text-xs text-slate-400 ml-6">
                  서비스 이용 시 이용 일수를 제외한 금액 환불
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-white">구독 취소</span>
                </div>
                <p className="text-xs text-slate-400 ml-6">
                  언제든지 자동 갱신 취소 가능 (만료일까지 이용)
                </p>
              </div>
            </div>
          </section>

          {/* 자주 묻는 질문 */}
          <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-cyan-400" />
              </div>
              <h2 className="text-white font-semibold">자주 묻는 질문</h2>
            </div>
            <div className="space-y-3">
              {[
                {
                  q: '결제가 안 돼요',
                  a: '카드 한도, 잔액을 확인하시거나 다른 결제 수단을 이용해 주세요.',
                },
                {
                  q: '영수증은 어디서 받나요?',
                  a: '결제 완료 후 등록된 이메일로 자동 발송됩니다.',
                },
                {
                  q: '구독 갱신일은 언제인가요?',
                  a: '최초 결제일 기준으로 매월/매년 자동 갱신됩니다.',
                },
                {
                  q: '환불은 얼마나 걸리나요?',
                  a: '취소 요청 후 3~5 영업일 내 카드사에서 처리됩니다.',
                },
              ].map((faq, idx) => (
                <div key={idx} className="border-b border-slate-700 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-white mb-1">Q. {faq.q}</p>
                  <p className="text-xs text-slate-400">A. {faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 문의하기 */}
          <section className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-5 border border-amber-500/30">
            <h3 className="text-white font-semibold mb-3">결제 관련 문의</h3>
            <div className="space-y-2">
              <a 
                href="mailto:support@aisaju.com"
                className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3 hover:bg-slate-800 transition-colors"
              >
                <Mail className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-sm text-white">이메일 문의</p>
                  <p className="text-xs text-slate-400">support@aisaju.com</p>
                </div>
              </a>
              <a 
                href="#"
                className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3 hover:bg-slate-800 transition-colors"
              >
                <MessageCircle className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-sm text-white">카카오톡 문의</p>
                  <p className="text-xs text-slate-400">@AI사주 (평일 10:00~18:00)</p>
                </div>
              </a>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-slate-500">
          <p>결제대행: (주)토스페이먼츠</p>
          <p className="mt-1">사업자등록번호: 000-00-00000</p>
        </div>
      </div>
    </div>
  );
}

export default PaymentGuidePage;
