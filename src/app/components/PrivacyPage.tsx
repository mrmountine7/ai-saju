import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export function PrivacyPage() {
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
          <h1 className="text-lg font-bold text-white">개인정보처리방침</h1>
          <div className="w-10" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-green-400" />
            <h2 className="text-white font-semibold">개인정보처리방침</h2>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section>
              <h3 className="text-white font-medium mb-2">1. 개인정보의 수집 및 이용 목적</h3>
              <p>회사는 다음의 목적을 위하여 개인정보를 처리합니다.</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 mt-2">
                <li>사주 분석 서비스 제공</li>
                <li>회원 가입 및 관리</li>
                <li>서비스 개선 및 신규 서비스 개발</li>
                <li>유료 서비스 결제 처리</li>
              </ul>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">2. 수집하는 개인정보 항목</h3>
              <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-amber-400 text-xs font-medium">필수 항목</p>
                  <p className="text-slate-400">이름, 생년월일, 출생시간, 성별</p>
                </div>
                <div>
                  <p className="text-amber-400 text-xs font-medium">선택 항목</p>
                  <p className="text-slate-400">이메일, 출생지역</p>
                </div>
                <div>
                  <p className="text-amber-400 text-xs font-medium">자동 수집</p>
                  <p className="text-slate-400">기기정보, 접속 로그, 서비스 이용 기록</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">3. 개인정보의 보유 및 이용 기간</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>회원 정보: 회원 탈퇴 시까지</li>
                <li>결제 정보: 관련 법령에 따라 5년</li>
                <li>서비스 이용 기록: 1년</li>
              </ul>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">4. 개인정보의 제3자 제공</h3>
              <p className="text-slate-400">
                회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
                다만, 법령에 따른 요청이 있는 경우 예외로 합니다.
              </p>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">5. 개인정보 처리 위탁</h3>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-600">
                      <th className="text-left py-2">수탁업체</th>
                      <th className="text-left py-2">위탁업무</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-slate-700">
                      <td className="py-2">토스페이먼츠</td>
                      <td className="py-2">결제 처리</td>
                    </tr>
                    <tr className="border-b border-slate-700">
                      <td className="py-2">Supabase</td>
                      <td className="py-2">데이터 저장</td>
                    </tr>
                    <tr>
                      <td className="py-2">DeepSeek</td>
                      <td className="py-2">AI 분석</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">6. 이용자의 권리</h3>
              <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 mt-2">
                <li>개인정보 열람 요청</li>
                <li>개인정보 정정 요청</li>
                <li>개인정보 삭제 요청</li>
                <li>개인정보 처리 정지 요청</li>
              </ul>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">7. 개인정보 보호책임자</h3>
              <div className="bg-slate-700/50 rounded-lg p-3 text-slate-400">
                <p>담당: 개인정보 보호팀</p>
                <p>이메일: privacy@aisaju.com</p>
              </div>
            </section>

            <section>
              <h3 className="text-white font-medium mb-2">8. 개인정보의 안전성 확보 조치</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>개인정보 암호화</li>
                <li>해킹 등에 대비한 보안 시스템 구축</li>
                <li>접근 권한 관리</li>
                <li>정기적인 보안 점검</li>
              </ul>
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

export default PrivacyPage;
