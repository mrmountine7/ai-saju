import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, LogIn, CheckCircle, Star, Crown, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithGoogle, isAuthenticated, loading } = useAuth();

  const from = (location.state as { from?: string })?.from || '/';

  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, from]);

  const handleGoogleLogin = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      console.error('로그인 오류:', error.message);
      alert('로그인에 실패했습니다. 다시 시도해주세요.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">로그인</h1>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">사주로 회원 가입</h2>
          <p className="text-slate-400">
            로그인하고 더 깊이 있는 사주 분석을 받아보세요
          </p>
        </div>

        {/* Benefits */}
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700 mb-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            회원 혜택
          </h3>
          <div className="space-y-3">
            {[
              '대운/세운/월운 상세 분석',
              '맞춤 개운법 제공',
              '분석 결과 PDF 다운로드',
              '분석 이력 저장 및 관리',
            ].map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span className="text-slate-300">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expert Mode Preview */}
        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-2xl p-5 border border-purple-500/30 mb-8">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Crown className="w-5 h-5 text-purple-400" />
            전문가 모드
          </h3>
          <p className="text-sm text-slate-400 mb-3">
            역술인, 상담사를 위한 프로 기능
          </p>
          <div className="space-y-2">
            {[
              '고전 9종 심층 분석',
              '고전 원문 검색',
              '고객 관리 기능',
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span className="text-sm text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-purple-400 mt-3">
            월 19,900원 · 연간 구독
          </p>
        </div>

        {/* Login Button */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white text-gray-800 font-medium py-4 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google로 계속하기
          </button>

          <p className="text-xs text-slate-500 text-center">
            로그인 시 이용약관 및 개인정보처리방침에 동의하게 됩니다
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            비회원으로 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
