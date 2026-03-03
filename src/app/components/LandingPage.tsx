import { useNavigate } from 'react-router-dom';
import { ChevronDown, BookOpen, Database, Brain, Shield, Star, LogIn, Sparkles, TrendingUp, Crown, Users, Search, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useAnalysisMode, ANALYSIS_MODES, type AnalysisMode } from '@/contexts/AnalysisModeContext';
import { SplashScreen } from './SplashScreen';
import { MODE_THEMES } from '@/contexts/ThemeContext';

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
  const [showSplash, setShowSplash] = useState<AnalysisMode | null>(null);
  const [analysisCount, setAnalysisCount] = useState(1295);

  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // AI 사주 분석 카운트 - 시간 기반 누계 증가
  useEffect(() => {
    const STORAGE_KEY = 'ai_saju_analysis_data';
    const BASE_COUNT = 1295; // 시작값
    const HOURLY_MIN = 20; // 시간당 최소 증가
    const HOURLY_MAX = 30; // 시간당 최대 증가

    // 저장된 데이터 불러오기
    const savedData = localStorage.getItem(STORAGE_KEY);
    let lastCount = BASE_COUNT;
    let lastTimestamp = Date.now();

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        lastCount = parsed.count || BASE_COUNT;
        lastTimestamp = parsed.timestamp || Date.now();
      } catch {
        lastCount = BASE_COUNT;
        lastTimestamp = Date.now();
      }
    }

    // 서버 다운 시간 동안의 누적 계산
    const now = Date.now();
    const hoursPassed = Math.floor((now - lastTimestamp) / (1000 * 60 * 60));
    
    if (hoursPassed > 0) {
      // 지나간 시간만큼 랜덤 증가 누적
      for (let i = 0; i < hoursPassed; i++) {
        const randomIncrement = Math.floor(Math.random() * (HOURLY_MAX - HOURLY_MIN + 1)) + HOURLY_MIN;
        lastCount += randomIncrement;
      }
      // 업데이트된 데이터 저장
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: lastCount, timestamp: now }));
    }

    setAnalysisCount(lastCount);

    // 1시간마다 업데이트
    const interval = setInterval(() => {
      setAnalysisCount(prev => {
        const randomIncrement = Math.floor(Math.random() * (HOURLY_MAX - HOURLY_MIN + 1)) + HOURLY_MIN;
        const newCount = prev + randomIncrement;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: newCount, timestamp: Date.now() }));
        return newCount;
      });
    }, 1000 * 60 * 60); // 1시간마다

    return () => clearInterval(interval);
  }, []);

  // 모드 선택 시 스플래시 표시 후 이동
  const handleModeSelect = (selectedMode: AnalysisMode) => {
    setMode(selectedMode);
    setShowSplash(selectedMode);
  };

  // 스플래시 화면이 표시 중인 경우
  if (showSplash) {
    return (
      <SplashScreen 
        mode={showSplash} 
        duration={4000}
        onComplete={() => {
          setShowSplash(null);
          navigate('/storage');
        }}
      />
    );
  }

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
        <div className="relative max-w-4xl mx-auto px-6 pb-8" style={{ paddingTop: '5px' }}>
          {/* Logo & Title */}
          <div className="text-center mb-6">
            <p className="text-gray-600 text-sm" style={{ marginTop: '0px', marginBottom: '40px' }}>
              9종 중국 사주명리 고전문헌을 해킹하다.<br />AI가 찾아낸 인생 단 하나의 탈출구...
            </p>
            
            <div className="mb-4 flex flex-col items-center relative overflow-hidden" style={{ minHeight: '358px' }}>
              {/* 천간/지지 배경 - 타이틀 영역 내부에만 표시 (겹치지 않게 배치) */}
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                {/* 천간 (天干) - 좌측 배치 */}
                <div className="absolute text-2xl text-amber-500" style={{ top: '2%', left: '2%', transform: 'rotate(-12deg)' }}>甲</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '12%', left: '12%', transform: 'rotate(8deg)' }}>乙</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '24%', left: '3%', transform: 'rotate(-18deg)' }}>丙</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '36%', left: '14%', transform: 'rotate(15deg)' }}>丁</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '48%', left: '4%', transform: 'rotate(-8deg)' }}>戊</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '60%', left: '12%', transform: 'rotate(12deg)' }}>己</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '72%', left: '2%', transform: 'rotate(-20deg)' }}>庚</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '84%', left: '14%', transform: 'rotate(10deg)' }}>辛</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '92%', left: '3%', transform: 'rotate(-15deg)' }}>壬</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '96%', left: '22%', transform: 'rotate(5deg)' }}>癸</div>
                
                {/* 지지 (地支) - 우측 배치 */}
                <div className="absolute text-2xl text-amber-500" style={{ top: '2%', right: '2%', transform: 'rotate(12deg)' }}>子</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '12%', right: '14%', transform: 'rotate(-10deg)' }}>丑</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '24%', right: '3%', transform: 'rotate(18deg)' }}>寅</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '36%', right: '12%', transform: 'rotate(-15deg)' }}>卯</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '48%', right: '4%', transform: 'rotate(8deg)' }}>辰</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '60%', right: '14%', transform: 'rotate(-12deg)' }}>巳</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '72%', right: '2%', transform: 'rotate(20deg)' }}>午</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '84%', right: '12%', transform: 'rotate(-8deg)' }}>未</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '92%', right: '3%', transform: 'rotate(15deg)' }}>申</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '96%', right: '22%', transform: 'rotate(-5deg)' }}>酉</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '6%', right: '26%', transform: 'rotate(10deg)' }}>戌</div>
                <div className="absolute text-2xl text-amber-500" style={{ top: '6%', left: '26%', transform: 'rotate(-10deg)' }}>亥</div>
              </div>
              <div className="relative">
<h1 
                className="text-7xl md:text-9xl font-black text-white flex flex-col items-center" 
                style={{ 
                  fontFamily: "'Klee One', serif",
                  letterSpacing: '0.1em',
                  fontWeight: 900,
                  WebkitFontSmoothing: 'antialiased'
                }}
              >
                <span style={{ display: 'inline-block', transform: 'rotate(0deg)', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>天</span>
                <span style={{ display: 'inline-block', transform: 'rotate(0deg)', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>乙</span>
                <span style={{ display: 'inline-block', transform: 'rotate(0deg)', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>貴</span>
                <span style={{ display: 'inline-block', transform: 'rotate(0deg)', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>人</span>
              </h1>
                {/* 붉은색 인장 */}
                <div 
                  style={{
                    position: 'absolute',
                    bottom: '-35px',
                    left: '55px',
                    width: '60px',
                    height: '60px',
                    border: '5px solid #c41e3a',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'rotate(-5deg)',
                    backgroundColor: 'rgba(196, 30, 58, 0.1)'
                  }}
                >
                  <div 
                    style={{ 
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '2px'
                    }}
                  >
                    <span 
                      style={{ 
                        color: '#c41e3a', 
                        fontSize: '22px', 
                        fontWeight: 900,
                        fontFamily: "'Klee One', serif",
                        writingMode: 'vertical-rl',
                        textOrientation: 'upright',
                        lineHeight: '1'
                      }}
                    >
                      適天
                    </span>
                    <span 
                      style={{ 
                        color: '#c41e3a', 
                        fontSize: '22px', 
                        fontWeight: 900,
                        fontFamily: "'Klee One', serif",
                        writingMode: 'vertical-rl',
                        textOrientation: 'upright',
                        lineHeight: '1'
                      }}
                    >
                      髓印
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-gray-600 text-sm tracking-widest" style={{ marginTop: '50px' }}>(천을귀인 ver 1.0)</p>
            </div>
            
            <p className="text-sm text-slate-500 mb-2" style={{ marginTop: '50px', marginBottom: '16px' }}>
              당신에게 필요한 것은 위로 보다 진실입니다.<br />고전문헌이 증명하는 당신의 진짜 미래를 감당해 보시겠습니까?
            </p>
          </div>

          {/* Mode Selection - 3가지 모드 (인트로 디자인 적용) */}
          <div className="mb-8">
            <div className="flex flex-col gap-3 mx-auto" style={{ maxWidth: '420px' }}>
              {/* 일반 모드 - 로즈골드 (#BC8F8F) */}
              <button 
                onClick={() => handleModeSelect('beginner')}
                onMouseEnter={() => setHoveredMode('beginner')}
                onMouseLeave={() => setHoveredMode(null)}
                className={`relative group flex flex-col items-center rounded-2xl font-medium transition-all hover:scale-105 border-2 ${
                  mode === 'beginner' 
                    ? 'shadow-lg' 
                    : 'border-opacity-40 hover:border-opacity-100'
                }`}
                style={{
                  background: mode === 'beginner' ? MODE_THEMES.beginner.bgGradient : 'rgba(188, 143, 143, 0.1)',
                  borderColor: MODE_THEMES.beginner.primary,
                  padding: '5px 3px',
                }}
              >
                <span className="font-bold text-sm" style={{ color: MODE_THEMES.beginner.primary }}>일반 모드</span>
                <span className="text-xs mt-1" style={{ color: MODE_THEMES.beginner.textMuted }}>
                  "운명 해독 (초보자)" - 핵심만 빠르게 보고 싶을 때
                </span>
                {mode === 'beginner' && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: MODE_THEMES.beginner.primary }}>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* 고급 모드 - 퍼플 (#9370DB) */}
              <button 
                onClick={() => handleModeSelect('advanced')}
                onMouseEnter={() => setHoveredMode('advanced')}
                onMouseLeave={() => setHoveredMode(null)}
                className={`relative group flex flex-col items-center rounded-2xl font-medium transition-all hover:scale-105 border-2 ${
                  mode === 'advanced' 
                    ? 'shadow-lg' 
                    : 'border-opacity-40 hover:border-opacity-100'
                }`}
                style={{
                  background: mode === 'advanced' ? MODE_THEMES.advanced.bgGradient : 'rgba(147, 112, 219, 0.1)',
                  borderColor: MODE_THEMES.advanced.primary,
                  padding: '5px 3px',
                }}
              >
                <span className="font-bold text-sm" style={{ color: MODE_THEMES.advanced.primary }}>고급 모드</span>
                <span className="text-xs mt-1" style={{ color: MODE_THEMES.advanced.textMuted }}>
                  "심층 분석 (매니아)" - 내 팔자의 디테일을 알고 싶을 때
                </span>
                {mode === 'advanced' && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: MODE_THEMES.advanced.primary }}>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* 전문가 모드 - 골드 (#D4AF37) */}
              <button 
                onClick={() => handleModeSelect('expert')}
                onMouseEnter={() => setHoveredMode('expert')}
                onMouseLeave={() => setHoveredMode(null)}
                className={`relative group flex flex-col items-center rounded-2xl font-medium transition-all hover:scale-105 border-2 ${
                  mode === 'expert' 
                    ? 'shadow-lg' 
                    : 'border-opacity-40 hover:border-opacity-100'
                }`}
                style={{
                  background: mode === 'expert' ? MODE_THEMES.expert.bgGradient : 'rgba(212, 175, 55, 0.1)',
                  borderColor: MODE_THEMES.expert.primary,
                  padding: '5px 3px',
                }}
              >
                <span className="font-bold text-sm" style={{ color: MODE_THEMES.expert.primary }}>전문가 모드</span>
                <span className="text-xs mt-1" style={{ color: MODE_THEMES.expert.textMuted }}>
                  "천기누설 (전문가)" - 고전 원문과 AI의 끝장 토론
                </span>
                {mode === 'expert' && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: MODE_THEMES.expert.primary }}>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            </div>

          </div>

          {/* Login/Signup Section */}
          <div className="flex flex-col items-center gap-4 mb-8">
            {/* 신뢰 지표 */}
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                적천수·자평진전 포함 9종 고전 완벽 학습
              </span>
              <span className="text-slate-600">|</span>
              <span>AI 사주분석: {analysisCount.toLocaleString()}건</span>
            </div>
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
            ) : null}
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
              onClick={() => window.location.href = 'mailto:support@tianyiguiren.com'}
              className="hover:text-amber-400 transition-colors"
            >
              고객센터
            </button>
          </div>
          
          <div className="text-center text-sm text-slate-600">
            <p>© 2026 天乙貴人. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
