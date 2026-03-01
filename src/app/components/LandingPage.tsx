import { useNavigate } from 'react-router-dom';
import { ChevronDown, BookOpen, Database, Brain, Shield, Star, LogIn, Sparkles, TrendingUp, Crown, Users, Search, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useAnalysisMode, ANALYSIS_MODES, type AnalysisMode } from '@/contexts/AnalysisModeContext';

// 지원 언어 목록 (확장 가능)
const SUPPORTED_LANGUAGES = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭' },
  // 향후 추가 예정:
  // { code: 'ja', name: '日本語', flag: '🇯🇵' },
  // { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  // { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
  // { code: 'tl', name: 'Filipino', flag: '🇵🇭' },
  // { code: 'my', name: 'မြန်မာဘာသာ', flag: '🇲🇲' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, signOut } = useAuth();
  const { mode, setMode } = useAnalysisMode();
  const [showStats, setShowStats] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('ko');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [hoveredMode, setHoveredMode] = useState<AnalysisMode | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // 언어 변경 핸들러
  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    // TODO: 실제 다국어 적용 시 여기서 i18n 언어 변경
    localStorage.setItem('preferred_language', langCode);
    console.log('[Language] 선택된 언어:', langCode);
  };

  // 구글 로그인
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Google 로그인 오류:', err);
      alert('로그인에 실패했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 카카오 로그인
  const handleKakaoLogin = async () => {
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Kakao 로그인 오류:', err);
      alert('로그인에 실패했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    await signOut();
  };

  const classicsData = [
    { 
      name: '삼명통회', 
      hanja: '三命通會',
      chunks: 940, 
      chars: '약 120만자',
      desc: '십신/격국/신살/혼인 종합',
      content: '명대 만민영이 편찬한 명리학 백과사전. 혼인문(婚姻門) 수록으로 고전 기반 궁합 해석 지원',
      example: '"男女婚配, 先觀日主" - 혼인 배합은 먼저 일주를 살펴라'
    },
    { 
      name: '적천수천미', 
      hanja: '滴天髓闡微',
      chunks: 647, 
      chars: '약 25만자',
      desc: '용신 취용법의 정수',
      content: '청대 임철초의 적천수 해설서. 용신 판단의 핵심 이론서',
      example: '"能知衰旺之眞機" - 쇠왕의 참된 기틀을 알 수 있다면'
    },
    { 
      name: '신봉통고', 
      hanja: '神峰通考',
      chunks: 667, 
      chars: '약 18만자',
      desc: '실전 운세 해석',
      content: '명대 장남의 실전 명리서. 대운과 세운 해석법 상세 수록',
      example: '"大運看扶抑" - 대운은 부(扶)와 억(抑)을 살펴라'
    },
    { 
      name: '명리정종', 
      hanja: '命理正宗',
      chunks: 412, 
      chars: '약 12만자',
      desc: '격국론의 기초',
      content: '명대 장신봉의 격국 중심 명리서. 정격과 외격 체계 정립',
      example: '"格局爲用神之本" - 격국은 용신의 근본이 된다'
    },
    { 
      name: '자평진전', 
      hanja: '子平眞詮',
      chunks: 168, 
      chars: '약 5만자',
      desc: '자평명리 정통',
      content: '청대 심효첨의 자평 정통 명리서. 십신 중심의 간명한 이론',
      example: '"八字用神, 專求月令" - 팔자의 용신은 월령에서 구하라'
    },
    { 
      name: '궁통보감', 
      hanja: '窮通寶鑑',
      chunks: 182, 
      chars: '약 8만자',
      desc: '조후용신의 교과서',
      content: '청대 여춘태의 조후 용신 전문서. 계절별 오행 조절법',
      example: '"寒木向陽" - 추운 목은 따뜻한 양을 향해야 한다'
    },
    { 
      name: '명리탐원', 
      hanja: '命理探源',
      chunks: 107, 
      chars: '약 6만자',
      desc: '근대 명리 해설',
      content: '근대 원수산의 명리 입문서. 현대적 해석과 풀이 수록',
      example: '"日主强弱, 先看月令" - 일주 강약은 먼저 월령을 보라'
    },
    { 
      name: '연해자평', 
      hanja: '淵海子平',
      chunks: 76, 
      chars: '약 4만자',
      desc: '자평학의 원류',
      content: '송대 서대승의 자평명리 원전. 사주명리학의 시조',
      example: '"年爲根, 月爲苗" - 년은 뿌리요, 월은 싹이다'
    },
    { 
      name: '적천수', 
      hanja: '滴天髓',
      chunks: 47, 
      chars: '약 1만자',
      desc: '명리학 최고 경전',
      content: '명리학의 핵심을 압축한 최고 경전. 함축적 시구 형식',
      example: '"欲識三元萬法宗" - 삼원 만법의 종지를 알고자 한다면'
    },
  ];

  const totalChunks = classicsData.reduce((acc, c) => acc + c.chunks, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 text-6xl text-amber-500">乾</div>
          <div className="absolute top-40 right-20 text-5xl text-amber-500">坤</div>
          <div className="absolute bottom-40 left-20 text-4xl text-amber-500">艮</div>
          <div className="absolute bottom-20 right-10 text-5xl text-amber-500">兌</div>
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-8">
          {/* Logo & Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 px-4 py-1.5 rounded-full text-sm mb-6">
              <Database className="w-4 h-4" />
              국내 최대 고전문헌 DB 기반
            </div>
            
            <div className="mb-4">
              <h1 className="text-6xl md:text-8xl font-bold text-white" style={{ fontFamily: 'ChosunCentennial, serif' }}>
                사주로
              </h1>
            </div>
            
            <p className="text-xl text-slate-300 mb-2">
              전통 명리학의 지혜를 AI로 해석하다
            </p>
          </div>

          {/* Mode Selection - 3가지 모드 */}
          <div className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {/* 일반 모드 - 흰색 바탕 */}
              <button 
                onClick={() => {
                  setMode('beginner');
                  navigate('/storage');
                }}
                onMouseEnter={() => setHoveredMode('beginner')}
                onMouseLeave={() => setHoveredMode(null)}
                className={`relative group flex flex-col items-center p-5 rounded-2xl font-medium transition-all hover:scale-105 ${
                  mode === 'beginner' 
                    ? 'bg-white text-slate-900 shadow-lg shadow-white/20 border-2 border-amber-400' 
                    : 'bg-white/90 text-slate-800 border border-slate-300 hover:border-amber-400'
                }`}
              >
                <Star className={`w-8 h-8 mb-3 ${mode === 'beginner' ? 'text-amber-500' : 'text-amber-400'}`} />
                <span className="font-semibold text-lg text-slate-800">일반 모드</span>
                <span className={`text-xs mt-1 ${mode === 'beginner' ? 'text-amber-600' : 'text-slate-500'}`}>
                  쉽고 부드러운 표현
                </span>
                {mode === 'beginner' && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* 고급 모드 - 회색 바탕 */}
              <button 
                onClick={() => {
                  setMode('advanced');
                  navigate('/storage');
                }}
                onMouseEnter={() => setHoveredMode('advanced')}
                onMouseLeave={() => setHoveredMode(null)}
                className={`relative group flex flex-col items-center p-5 rounded-2xl font-medium transition-all hover:scale-105 ${
                  mode === 'advanced' 
                    ? 'bg-slate-500 text-white shadow-lg shadow-slate-500/30 border-2 border-blue-400' 
                    : 'bg-slate-400/90 text-white border border-slate-500 hover:border-blue-400'
                }`}
              >
                <TrendingUp className={`w-8 h-8 mb-3 ${mode === 'advanced' ? 'text-blue-300' : 'text-blue-200'}`} />
                <span className="font-semibold text-lg">고급 모드</span>
                <span className={`text-xs mt-1 ${mode === 'advanced' ? 'text-blue-200' : 'text-slate-200'}`}>
                  명리 전문 용어 사용
                </span>
                {mode === 'advanced' && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* 사주가 모드 */}
              <button 
                onClick={() => {
                  setMode('expert');
                  navigate('/storage');
                }}
                onMouseEnter={() => setHoveredMode('expert')}
                onMouseLeave={() => setHoveredMode(null)}
                className={`relative group flex flex-col items-center p-5 rounded-2xl font-medium transition-all hover:scale-105 ${
                  mode === 'expert' 
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30' 
                    : 'bg-slate-800/80 text-white border border-slate-700 hover:border-purple-500/50'
                }`}
              >
                <Crown className={`w-8 h-8 mb-3 ${mode === 'expert' ? 'text-white' : 'text-purple-400'}`} />
                <span className="font-semibold text-lg">사주가 모드</span>
                <span className={`text-xs mt-1 ${mode === 'expert' ? 'text-purple-100' : 'text-slate-400'}`}>
                  원문 검색 · 고객 관리
                </span>
                {mode === 'expert' && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            </div>

          </div>

          {/* Language Selection */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="text-slate-400 text-sm">언어:</span>
            <div className="relative">
              <select 
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="appearance-none bg-slate-800 text-white rounded-lg border border-slate-600 px-4 py-2 pr-10 cursor-pointer text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Login/Signup Section */}
          <div className="flex flex-col items-center gap-4 mb-8">
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700">
                  <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <span className="text-amber-400 text-sm font-medium">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-slate-300 text-sm">{user?.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-slate-400 text-sm">간편 회원가입 / 로그인</p>
                <div className="flex gap-3">
                  {/* 카카오 로그인 버튼 */}
                  <button
                    onClick={handleKakaoLogin}
                    disabled={isLoggingIn}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#FEE500] text-[#000000] rounded-xl font-medium hover:bg-[#FDD800] transition-all disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.643 1.756 4.965 4.4 6.286-.139.533-.501 1.93-.573 2.229-.09.372.136.367.287.267.118-.078 1.879-1.277 2.639-1.796.407.058.825.088 1.247.088 5.523 0 10-3.463 10-7.691C20 6.463 17.523 3 12 3z"/>
                    </svg>
                    카카오
                  </button>
                  
                  {/* 구글 로그인 버튼 */}
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-all disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section - Classics Table */}
      <div className="bg-slate-800/50 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            <BookOpen className="w-6 h-6 inline-block mr-2 text-amber-400" />
            벡터/그래프 DB 수록 고전문헌
          </h2>
          <p className="text-center text-slate-400 text-sm mb-8">
            총 {totalChunks.toLocaleString()}개 청크 · 약 200만 한자 · 9종 정통 명리 고전
          </p>
          
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-amber-400 font-semibold text-sm">문헌명</th>
                  <th className="text-left py-3 px-4 text-amber-400 font-semibold text-sm">주요 내용</th>
                  <th className="text-center py-3 px-4 text-amber-400 font-semibold text-sm">한자 수</th>
                  <th className="text-center py-3 px-4 text-amber-400 font-semibold text-sm">청크</th>
                  <th className="text-left py-3 px-4 text-amber-400 font-semibold text-sm">해석 예시</th>
                </tr>
              </thead>
              <tbody>
                {classicsData.map((classic, index) => (
                  <tr 
                    key={classic.name}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                      index % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-800/30'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{classic.name}</span>
                        <span className="text-slate-500 text-xs">{classic.hanja}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-300 text-sm">{classic.content}</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-slate-300 text-sm">{classic.chars}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full text-xs font-medium">
                        {classic.chunks}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-400 text-xs italic leading-relaxed">{classic.example}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {classicsData.map((classic) => (
              <div 
                key={classic.name}
                className="bg-slate-900/50 rounded-xl p-4 border border-slate-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-white font-medium">{classic.name}</span>
                    <span className="text-slate-500 text-xs ml-2">{classic.hanja}</span>
                  </div>
                  <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-xs">
                    {classic.chunks} 청크
                  </span>
                </div>
                <p className="text-slate-300 text-sm mb-2">{classic.content}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <span>{classic.chars}</span>
                  <span>·</span>
                  <span>{classic.desc}</span>
                </div>
                <p className="text-slate-400 text-xs italic bg-slate-800/50 rounded-lg p-2">
                  {classic.example}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Differentiators */}
      <div className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            <Sparkles className="w-6 h-6 inline-block mr-2 text-amber-400" />
            차별화된 분석
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">벡터/그래프DB 기반 검색</h3>
                  <p className="text-slate-400 text-xs">
                    3,238개 청크에서 사주 구조에 맞는 고전 해석을 AI가 실시간으로 검색합니다.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">LLM 종합 해석</h3>
                  <p className="text-slate-400 text-xs">
                    중국 고전문헌(한자 벡터/그래프DB)에 최적화된 DeepSeek LLM이 맞춤형 해석을 생성합니다.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">원문 근거 제시</h3>
                  <p className="text-slate-400 text-xs">
                    "삼명통회에 따르면...", "적천수에서는..." 등 신뢰할 수 있는 근거를 제시합니다.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">정통 명리학 기반</h3>
                  <p className="text-slate-400 text-xs">
                    격국 24종, 용신 4종(억부/조후/통관/병약), 신살 100종+ 완전 지원
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center text-slate-500 text-sm mb-6">
          </div>
          
          {/* Footer Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500 mb-4">
            <button 
              onClick={() => navigate('/terms')}
              className="hover:text-amber-400 transition-colors"
            >
              이용약관
            </button>
            <span className="text-slate-700">|</span>
            <button 
              onClick={() => navigate('/privacy')}
              className="hover:text-amber-400 transition-colors"
            >
              개인정보처리방침
            </button>
            <span className="text-slate-700">|</span>
            <button 
              onClick={() => navigate('/payment/guide')}
              className="hover:text-amber-400 transition-colors"
            >
              결제 안내
            </button>
            <span className="text-slate-700">|</span>
            <button 
              onClick={() => window.location.href = 'mailto:support@sajuro.com'}
              className="hover:text-amber-400 transition-colors"
            >
              고객센터
            </button>
          </div>
          
          <div className="text-center text-sm text-slate-600">
            <p>© 2026 사주로. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
