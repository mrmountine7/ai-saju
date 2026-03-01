import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export function TermsPage() {
  const navigate = useNavigate();

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
          <h1 className="text-lg font-bold text-white">이용약관</h1>
          <div className="w-10" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-amber-400" />
            <h2 className="text-white font-semibold">사주로 서비스 이용약관</h2>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section>
              <h3 className="text-white font-medium mb-2">제1조 (목적)</h3>
              <p>
                본 약관은 사주로 서비스(이하 "서비스")를 제공하는 회사(이하 "회사")와 
                이용자 간의 서비스 이용에 관한 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">제2조 (정의)</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>"서비스"란 회사가 제공하는 AI 기반 사주명리 분석 서비스를 말합니다.</li>
                <li>"이용자"란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
                <li>"프리미엄 서비스"란 유료 결제를 통해 이용하는 부가 서비스를 말합니다.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">제3조 (약관의 효력)</h3>
              <p>
                본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.
                회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.
              </p>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">제4조 (서비스의 제공)</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>사주팔자 분석 및 해석 서비스</li>
                <li>대운, 세운, 월운 분석 서비스</li>
                <li>궁합 분석 서비스</li>
                <li>일진 분석 서비스</li>
                <li>개운법 제공 서비스</li>
                <li>기타 회사가 정하는 서비스</li>
              </ul>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">제5조 (서비스 이용료)</h3>
              <p>
                서비스는 무료 서비스와 유료 서비스로 구분됩니다. 
                유료 서비스의 이용료 및 결제 방법은 서비스 내에 별도로 표시합니다.
              </p>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">제6조 (환불 정책)</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>결제 후 7일 이내, 서비스 미이용 시 전액 환불</li>
                <li>서비스 이용 시 이용 일수를 제외한 금액 환불</li>
                <li>구독 취소 시 만료일까지 서비스 이용 가능</li>
              </ul>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">제7조 (면책조항)</h3>
              <p className="text-slate-400">
                본 서비스는 전통 명리학과 AI 기술을 결합한 참고용 정보 서비스입니다.
                제공되는 분석 결과는 참고 목적으로만 활용해야 하며, 중요한 의사결정에 
                본 서비스의 결과만을 근거로 삼지 않기를 권고합니다.
                회사는 서비스 이용으로 인한 직접적, 간접적 손해에 대해 책임지지 않습니다.
              </p>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">제8조 (분쟁 해결)</h3>
              <p>
                서비스 이용과 관련하여 분쟁이 발생한 경우, 회사와 이용자는 
                상호 협의하여 해결하며, 협의가 이루어지지 않을 경우 
                관할 법원에 소를 제기할 수 있습니다.
              </p>
            </section>

            <div className="pt-4 border-t border-slate-700 text-xs text-slate-500">
              <p>시행일: 2026년 2월 1일</p>
              <p>최종 수정일: 2026년 2월 3일</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TermsPage;
