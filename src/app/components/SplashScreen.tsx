import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODE_THEMES, type ModeTheme } from '@/contexts/ThemeContext';
import { type AnalysisMode } from '@/contexts/AnalysisModeContext';

interface SplashScreenProps {
  mode: AnalysisMode;
  duration?: number; // 밀리초
  onComplete?: () => void;
}

export function SplashScreen({ mode, duration = 3000, onComplete }: SplashScreenProps) {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const theme = MODE_THEMES[mode];

  useEffect(() => {
    // 페이드아웃 시작
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, duration - 500);

    // 완료 후 콜백 또는 네비게이션
    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) {
        onComplete();
      } else {
        navigate('/storage');
      }
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, navigate, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ background: theme.bgGradient }}
    >
      {/* 장식 요소 - 상단 점 */}
      <div className="absolute top-8 left-0 right-0 flex justify-center gap-1">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ 
              backgroundColor: theme.primary, 
              opacity: 0.6,
              animationDelay: `${i * 200}ms`
            }}
          />
        ))}
      </div>

      {/* 메인 캐릭터 - 세로 배열 */}
      <div className="flex flex-col items-center gap-2 mb-8">
        {['天', '乙', '貴', '人'].map((char, idx) => (
          <div
            key={idx}
            className="text-[5rem] sm:text-[6rem] md:text-[7rem] leading-none animate-fadeInUp"
            style={{
              fontFamily: theme.fontFamily,
              fontWeight: 600,
              color: theme.primary,
              textShadow: `0 0 40px ${theme.primaryGlow}, 0 0 20px ${theme.primaryGlow}, 0 0 10px ${theme.primaryGlow}, 4px 4px 8px rgba(0, 0, 0, 0.9)`,
              animationDelay: `${idx * 150}ms`,
            }}
          >
            {char}
          </div>
        ))}
      </div>

      {/* 붉은 인장 */}
      <div className="absolute bottom-40 right-12 sm:right-20 animate-fadeIn" style={{ animationDelay: '600ms' }}>
        <svg
          viewBox="0 0 100 100"
          className="w-16 h-16 sm:w-20 sm:h-20"
          style={{ filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6))' }}
        >
          <rect x="5" y="5" width="90" height="90" fill="#B91C1C" rx="2" />
          <rect x="10" y="10" width="80" height="80" fill="none" stroke="#7F1D1D" strokeWidth="1.5" />
          <g fill="#FEF3C7" opacity="0.95">
            <rect x="30" y="22" width="40" height="3" />
            <rect x="48" y="22" width="4" height="15" />
            <rect x="35" y="30" width="30" height="2.5" />
            <rect x="32" y="45" width="36" height="3" />
            <rect x="32" y="52" width="36" height="3" />
            <rect x="48" y="45" width="4" height="18" />
            <rect x="38" y="48" width="3" height="15" />
            <rect x="59" y="48" width="3" height="15" />
            <rect x="38" y="72" width="24" height="3" />
            <rect x="45" y="75" width="3" height="10" />
            <rect x="52" y="75" width="3" height="10" />
            <circle cx="49.5" cy="83" r="2" />
          </g>
        </svg>
      </div>

      {/* 영문 서브타이틀 */}
      <div
        className="absolute bottom-28 left-8 text-xs tracking-[0.3em] opacity-70 animate-fadeIn"
        style={{ color: theme.primary, animationDelay: '800ms' }}
      >
        ORACLE
      </div>

      {/* 모드 정보 */}
      <div className="absolute bottom-12 left-0 right-0 px-8 animate-fadeIn" style={{ animationDelay: '1000ms' }}>
        <div 
          className="text-center mb-2 font-bold tracking-wider text-sm"
          style={{ 
            color: theme.primary,
            textShadow: `0 0 20px ${theme.primaryGlow}, 0 0 10px ${theme.primaryGlow}`,
          }}
        >
          {theme.name}
        </div>
        <div className="text-center text-gray-400 text-xs leading-relaxed">
          {theme.description}
        </div>
      </div>

      {/* 로딩 인디케이터 */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ 
                backgroundColor: theme.primary,
                opacity: 0.8,
                animationDelay: `${i * 150}ms`
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}

// 모드 선택 화면 (랜딩페이지 대체 또는 추가)
export function ModeSelectionSplash() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(null);

  const modes: { id: AnalysisMode; theme: ModeTheme }[] = [
    { id: 'beginner', theme: MODE_THEMES.beginner },
    { id: 'advanced', theme: MODE_THEMES.advanced },
    { id: 'expert', theme: MODE_THEMES.expert },
  ];

  const handleModeSelect = (mode: AnalysisMode) => {
    setSelectedMode(mode);
  };

  if (selectedMode) {
    return (
      <SplashScreen 
        mode={selectedMode} 
        duration={3000}
        onComplete={() => navigate('/storage')}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-white text-4xl mb-3 font-bold" style={{ fontFamily: "'Klee One', serif" }}>
            天乙貴人
          </h1>
          <p className="text-gray-400 text-base mb-2">
            중국 고전문헌 9종 기반 AI 사주명리 서비스
          </p>
          <p className="text-gray-500 text-sm">
            당신의 수준에 맞는 모드를 선택하세요
          </p>
        </div>

        {/* Three Mode Pages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {modes.map(({ id, theme }) => (
            <button
              key={id}
              onClick={() => handleModeSelect(id)}
              className="rounded-2xl overflow-hidden border-2 border-gray-800 hover:border-opacity-100 transition-all duration-300 hover:scale-105 cursor-pointer shadow-2xl text-left"
              style={{ borderColor: theme.primary + '40' }}
            >
              {/* Mobile Intro Page Preview */}
              <div
                className="relative aspect-[9/16] flex flex-col items-center justify-center p-8"
                style={{ background: theme.bgGradient }}
              >
                {/* Main Characters */}
                <div className="flex flex-col items-center gap-2 mb-8">
                  {['天', '乙', '貴', '人'].map((char, idx) => (
                    <div
                      key={idx}
                      className="text-[4rem] sm:text-[4.5rem] leading-none"
                      style={{
                        fontFamily: theme.fontFamily,
                        fontWeight: 600,
                        color: theme.primary,
                        textShadow: `0 0 40px ${theme.primaryGlow}, 0 0 20px ${theme.primaryGlow}, 0 0 10px ${theme.primaryGlow}, 4px 4px 8px rgba(0, 0, 0, 0.9)`,
                      }}
                    >
                      {char}
                    </div>
                  ))}
                </div>

                {/* Red Seal */}
                <div className="absolute bottom-32 right-12">
                  <svg
                    viewBox="0 0 100 100"
                    className="w-16 h-16"
                    style={{ filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6))' }}
                  >
                    <rect x="5" y="5" width="90" height="90" fill="#B91C1C" rx="2" />
                    <rect x="10" y="10" width="80" height="80" fill="none" stroke="#7F1D1D" strokeWidth="1.5" />
                    <g fill="#FEF3C7" opacity="0.95">
                      <rect x="30" y="22" width="40" height="3" />
                      <rect x="48" y="22" width="4" height="15" />
                      <rect x="35" y="30" width="30" height="2.5" />
                      <rect x="32" y="45" width="36" height="3" />
                      <rect x="32" y="52" width="36" height="3" />
                      <rect x="48" y="45" width="4" height="18" />
                      <rect x="38" y="48" width="3" height="15" />
                      <rect x="59" y="48" width="3" height="15" />
                      <rect x="38" y="72" width="24" height="3" />
                      <rect x="45" y="75" width="3" height="10" />
                      <rect x="52" y="75" width="3" height="10" />
                      <circle cx="49.5" cy="83" r="2" />
                    </g>
                  </svg>
                </div>

                {/* English Subtitle */}
                <div
                  className="absolute bottom-20 left-8 text-xs tracking-[0.3em] opacity-70"
                  style={{ color: theme.primary }}
                >
                  ORACLE
                </div>

                {/* Mode Info at Bottom */}
                <div className="absolute bottom-8 left-0 right-0 px-8">
                  <div 
                    className="text-center mb-2 font-bold tracking-wider"
                    style={{ 
                      color: theme.primary,
                      textShadow: `0 0 20px ${theme.primaryGlow}, 0 0 10px ${theme.primaryGlow}`,
                      fontSize: '0.9rem'
                    }}
                  >
                    {theme.name}
                  </div>
                  <div className="text-center text-gray-400 text-xs leading-relaxed">
                    {theme.description}
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-8 left-0 right-0 flex justify-center gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: theme.primary, opacity: 0.6 }}
                    />
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div 
                className="p-4 border-t-2"
                style={{ 
                  backgroundColor: '#111',
                  borderColor: theme.primary + '30'
                }}
              >
                <div 
                  className="text-center text-sm font-bold mb-1"
                  style={{ color: theme.primary }}
                >
                  {theme.name}
                </div>
                <div className="text-center text-gray-500 text-xs">
                  탭하여 시작하기
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Bottom Info */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-gray-900 rounded-lg px-6 py-4 border border-gray-800">
            <p className="text-gray-400 text-sm mb-2">
              중국 고전문헌 9종 데이터베이스 기반
            </p>
            <p className="text-gray-500 text-xs">
              벡터 검색 × 그래프 분석 × AI 해석
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
