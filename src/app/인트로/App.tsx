export default function App() {
  const modes = [
    {
      id: 1,
      title: '일반인 모드',
      description: '누구나 쉽게 이해하는 사주풀이',
      fontFamily: "'Klee One', serif",
      fontWeight: 600,
      color: '#BC8F8F',
      glow: 'rgba(188, 143, 143, 0.7)',
      bgGradient: 'linear-gradient(to bottom, #000000, #1a0a0a)',
      accent: '#BC8F8F',
    },
    {
      id: 2,
      title: '고급자 모드',
      description: '심화된 명리학 이론과 해석',
      fontFamily: "'Klee One', serif",
      fontWeight: 600,
      color: '#9370DB',
      glow: 'rgba(147, 112, 219, 0.7)',
      bgGradient: 'linear-gradient(to bottom, #000000, #0a0a1a)',
      accent: '#9370DB',
    },
    {
      id: 3,
      title: '전문가 모드',
      description: '9대 고전문헌 원문 기반 감정',
      fontFamily: "'Klee One', serif",
      fontWeight: 600,
      color: '#D4AF37',
      glow: 'rgba(212, 175, 55, 0.8)',
      bgGradient: 'linear-gradient(to bottom, #000000, #1a1a0a)',
      accent: '#D4AF37',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-zinc-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-white text-4xl mb-3 font-sans font-bold">
            天乙貴人
          </h1>
          <p className="text-gray-400 text-base font-sans mb-2">
            중국 고전문헌 9종 기반 AI 사주명리 서비스
          </p>
          <p className="text-gray-500 text-sm font-sans">
            당신의 수준에 맞는 모드를 선택하세요
          </p>
        </div>

        {/* Three Mode Pages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {modes.map((mode) => (
            <div
              key={mode.id}
              className="rounded-2xl overflow-hidden border-2 border-gray-800 hover:border-opacity-100 transition-all duration-300 hover:scale-105 cursor-pointer shadow-2xl"
              style={{ borderColor: mode.accent + '40' }}
            >
              {/* Mobile Intro Page Preview */}
              <div
                className="relative aspect-[9/16] flex flex-col items-center justify-center p-8"
                style={{
                  background: mode.bgGradient,
                }}
              >
                {/* Main Characters */}
                <div className="flex flex-col items-center gap-2 mb-8">
                  {['天', '乙', '貴', '人'].map((char, idx) => (
                    <div
                      key={idx}
                      className="text-[6rem] sm:text-[4.5rem] leading-none"
                      style={{
                        fontFamily: mode.fontFamily,
                        fontWeight: mode.fontWeight,
                        color: mode.color,
                        textShadow: `0 0 40px ${mode.glow}, 0 0 20px ${mode.glow}, 0 0 10px ${mode.glow}, 4px 4px 8px rgba(0, 0, 0, 0.9)`,
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
                  className="absolute bottom-20 left-8 text-xs tracking-[0.3em] opacity-70 font-sans"
                  style={{ color: mode.color }}
                >
                  ORACLE
                </div>

                {/* Mode Info at Bottom */}
                <div className="absolute bottom-8 left-0 right-0 px-8">
                  <div 
                    className="text-center mb-2 font-sans font-bold tracking-wider"
                    style={{ 
                      color: mode.color,
                      textShadow: `0 0 20px ${mode.glow}, 0 0 10px ${mode.glow}`,
                      fontSize: '0.9rem'
                    }}
                  >
                    {mode.title}
                  </div>
                  <div className="text-center text-gray-400 text-xs font-sans leading-relaxed">
                    {mode.description}
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-8 left-0 right-0 flex justify-center gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: mode.color, opacity: 0.6 }}
                    />
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div 
                className="p-4 border-t-2"
                style={{ 
                  backgroundColor: '#111',
                  borderColor: mode.accent + '30'
                }}
              >
                <div 
                  className="text-center text-sm font-bold font-sans mb-1"
                  style={{ color: mode.accent }}
                >
                  {mode.title}
                </div>
                <div className="text-center text-gray-500 text-xs font-sans">
                  탭하여 시작하기
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Info */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-gray-900 rounded-lg px-6 py-4 border border-gray-800">
            <p className="text-gray-400 text-sm font-sans mb-2">
              📚 중국 고전문헌 9종 데이터베이스 기반
            </p>
            <p className="text-gray-500 text-xs font-sans">
              벡터 검색 × 그래프 분석 × AI 해석
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}