import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Sun,
  Moon,
  Star,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Compass,
  Palette,
  Hash,
  Activity,
  Info
} from 'lucide-react';
import { analyzeDailyFortune, type DailyFortuneResponse } from '@/lib/saju-api-client';
import { useAnalysisMode } from '@/contexts/AnalysisModeContext';
import { MODE_THEMES } from '@/contexts/ThemeContext';

interface LocationState {
  profile?: {
    name: string;
    gender: 'male' | 'female';
    birth_year: number;
    birth_month: number;
    birth_day: number;
    birth_hour: string;
  };
}

// 일진 등급별 색상
const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  '대길': { bg: 'bg-amber-500/30', text: 'text-amber-400', border: 'border-amber-500/50' },
  '길': { bg: 'bg-green-500/30', text: 'text-green-400', border: 'border-green-500/50' },
  '보통': { bg: 'bg-blue-500/30', text: 'text-blue-400', border: 'border-blue-500/50' },
  '흉': { bg: 'bg-orange-500/30', text: 'text-orange-400', border: 'border-orange-500/50' },
  '대흉': { bg: 'bg-red-500/30', text: 'text-red-400', border: 'border-red-500/50' },
};

// 요일 이름
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function DailyFortunePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const profile = state?.profile;
  const { mode } = useAnalysisMode();
  const theme = MODE_THEMES[mode];

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyFortune, setDailyFortune] = useState<DailyFortuneResponse | null>(null);
  const [monthlyFortunes, setMonthlyFortunes] = useState<Map<string, DailyFortuneResponse>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // 현재 월의 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: (Date | null)[] = [];
    
    // 이전 달 빈 칸
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // 현재 달 날짜
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentDate]);

  // 날짜 포맷 함수
  const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // 프로필 없으면 경고
  useEffect(() => {
    if (!profile) {
      // 기본 프로필로 테스트
    }
  }, [profile]);

  // 선택된 날짜의 일진 조회
  useEffect(() => {
    if (!profile) return;
    
    const fetchDailyFortune = async () => {
      setIsLoading(true);
      try {
        const hourMap: Record<string, number> = {
          '자시': 0, '축시': 2, '인시': 4, '묘시': 6,
          '진시': 8, '사시': 10, '오시': 12, '미시': 14,
          '신시': 16, '유시': 18, '술시': 20, '해시': 22,
        };
        const hour = hourMap[profile.birth_hour] ?? 12;
        
        const result = await analyzeDailyFortune({
          name: profile.name,
          gender: profile.gender,
          year: profile.birth_year,
          month: profile.birth_month,
          day: profile.birth_day,
          hour,
          minute: 0,
          is_lunar: false,
          target_date: formatDate(selectedDate),
        });
        
        setDailyFortune(result);
        
        // 월별 캐시에 저장
        const dateKey = formatDate(selectedDate);
        setMonthlyFortunes(prev => new Map(prev).set(dateKey, result));
      } catch (error) {
        console.error('일진 조회 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyFortune();
  }, [selectedDate, profile]);

  // 이전/다음 달 이동
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // 오늘로 이동
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // 날짜 선택
  const handleDateSelect = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      setShowDetail(true);
    }
  };

  // 날짜 셀의 일진 등급 색상 가져오기
  const getDayGradeColor = (date: Date): string => {
    const cached = monthlyFortunes.get(formatDate(date));
    if (cached?.grade) {
      return gradeColors[cached.grade]?.bg || 'bg-slate-700/50';
    }
    return 'bg-slate-800/50';
  };

  // 프로필 없을 때
  if (!profile) {
    return (
      <div className="min-h-screen" style={{ background: theme.bgGradient }}>
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center mb-6">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-white ml-2">일진 캘린더</h1>
          </div>
          
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 text-center">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-white font-medium mb-2">프로필 선택 필요</h3>
            <p className="text-slate-400 text-sm mb-4">
              일진을 보려면 사주 보관소에서 프로필을 선택해주세요
            </p>
            <button
              onClick={() => navigate('/storage')}
              className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium"
            >
              사주 보관소로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: theme.bgGradient }}>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold text-white">일진 캘린더</h1>
            <p className="text-xs text-slate-400">{profile.name}님의 일별 운세</p>
          </div>
          <button onClick={goToToday} className="p-2 text-amber-400 hover:bg-white/10 rounded-full">
            <CalendarIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={goToPrevMonth} className="p-2 text-white hover:bg-white/10 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-white">
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </h2>
          <button onClick={goToNextMonth} className="p-2 text-white hover:bg-white/10 rounded-full">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* 등급 범례 */}
        <div className="flex justify-center gap-2 mb-4">
          {Object.entries(gradeColors).map(([grade, colors]) => (
            <div key={grade} className={`px-2 py-1 rounded ${colors.bg} ${colors.text} text-xs`}>
              {grade}
            </div>
          ))}
        </div>

        {/* 캘린더 그리드 */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-4 border border-slate-700 mb-6">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day, i) => (
              <div 
                key={day} 
                className={`text-center text-xs font-medium py-2 ${
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }
              
              const isToday = formatDate(date) === formatDate(new Date());
              const isSelected = formatDate(date) === formatDate(selectedDate);
              const dayOfWeek = date.getDay();
              const cached = monthlyFortunes.get(formatDate(date));
              
              return (
                <button
                  key={formatDate(date)}
                  onClick={() => handleDateSelect(date)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all relative ${
                    isSelected 
                      ? 'bg-amber-500 text-white ring-2 ring-amber-400' 
                      : cached?.grade 
                        ? `${gradeColors[cached.grade]?.bg || 'bg-slate-700/50'} hover:ring-2 hover:ring-white/30`
                        : 'bg-slate-700/30 hover:bg-slate-700/50'
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    isSelected ? 'text-white' : 
                    dayOfWeek === 0 ? 'text-red-400' : 
                    dayOfWeek === 6 ? 'text-blue-400' : 'text-white'
                  }`}>
                    {date.getDate()}
                  </span>
                  
                  {isToday && !isSelected && (
                    <div className="absolute bottom-1 w-1 h-1 bg-amber-400 rounded-full" />
                  )}
                  
                  {cached?.emoji && (
                    <span className="text-xs mt-0.5">{cached.emoji}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 선택된 날짜 상세 정보 */}
        {showDetail && (
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700 overflow-hidden">
            {/* 선택 날짜 헤더 */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-400 text-sm">
                    {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({WEEKDAYS[selectedDate.getDay()]})
                  </p>
                  {dailyFortune?.daily_pillar && (
                    <p className="text-white text-lg font-bold mt-1">
                      {dailyFortune.daily_pillar.gan_ko}{dailyFortune.daily_pillar.zhi_ko}일
                      <span className="text-slate-400 text-sm ml-2">
                        ({dailyFortune.daily_pillar.gan}{dailyFortune.daily_pillar.zhi})
                      </span>
                    </p>
                  )}
                </div>
                {dailyFortune?.grade && (
                  <div className={`px-4 py-2 rounded-xl ${gradeColors[dailyFortune.grade]?.bg} ${gradeColors[dailyFortune.grade]?.border} border`}>
                    <span className="text-2xl mr-2">{dailyFortune.emoji}</span>
                    <span className={`font-bold ${gradeColors[dailyFortune.grade]?.text}`}>
                      {dailyFortune.grade}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">일진 분석 중...</p>
              </div>
            ) : dailyFortune?.success ? (
              <div className="p-4 space-y-4">
                {/* 점수 바 */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">오늘의 운세 점수</span>
                    <span className="text-amber-400 font-bold">{dailyFortune.score}점</span>
                  </div>
                  <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${dailyFortune.score}%` }}
                    />
                  </div>
                </div>

                {/* 오늘의 메시지 */}
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span className="text-white font-medium">오늘의 한마디</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{dailyFortune.message}</p>
                </div>

                {/* 좋은 일 / 주의할 일 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/30">
                    <div className="flex items-center gap-1 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 text-xs font-medium">좋은 일</span>
                    </div>
                    <ul className="space-y-1">
                      {dailyFortune.positive_effects?.slice(0, 3).map((item, i) => (
                        <li key={i} className="text-slate-300 text-xs">• {item}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/30">
                    <div className="flex items-center gap-1 mb-2">
                      <AlertCircle className="w-4 h-4 text-orange-400" />
                      <span className="text-orange-400 text-xs font-medium">주의할 일</span>
                    </div>
                    <ul className="space-y-1">
                      {dailyFortune.negative_effects?.slice(0, 3).map((item, i) => (
                        <li key={i} className="text-slate-300 text-xs">• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 행운 요소 */}
                {dailyFortune.lucky_elements && (
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-5 h-5 text-yellow-400" />
                      <span className="text-white font-medium">오늘의 행운</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-pink-400" />
                        <span className="text-slate-400 text-xs">색상</span>
                        <span className="text-white text-sm">{dailyFortune.lucky_elements.color}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-cyan-400" />
                        <span className="text-slate-400 text-xs">방위</span>
                        <span className="text-white text-sm">{dailyFortune.lucky_elements.direction}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-purple-400" />
                        <span className="text-slate-400 text-xs">숫자</span>
                        <span className="text-white text-sm">{dailyFortune.lucky_elements.number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-green-400" />
                        <span className="text-slate-400 text-xs">활동</span>
                        <span className="text-white text-sm">{dailyFortune.lucky_elements.activity}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 신살 정보 */}
                {dailyFortune.shinsal && dailyFortune.shinsal.length > 0 && (
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-5 h-5 text-indigo-400" />
                      <span className="text-white font-medium">오늘의 신살</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dailyFortune.shinsal.map((s, i) => (
                        <span 
                          key={i}
                          className={`px-3 py-1 rounded-full text-xs ${
                            s.is_positive 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                          title={s.description}
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 조언 */}
                {dailyFortune.advice && (
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Sun className="w-5 h-5 text-amber-400" />
                      <span className="text-white font-medium">오늘의 조언</span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{dailyFortune.advice}</p>
                  </div>
                )}

                {/* 처리 시간 */}
                <p className="text-center text-slate-500 text-xs">
                  분석 시간: {dailyFortune.processing_time_ms}ms
                </p>
              </div>
            ) : (
              <div className="p-8 text-center">
                <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">
                  {dailyFortune?.error || '일진 정보를 불러올 수 없습니다'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 하단 안내 */}
        <div className="text-center mt-6 text-xs text-slate-500">
          <Moon className="w-3 h-3 inline mr-1" />
          날짜를 선택하면 해당 일의 운세를 확인할 수 있습니다
        </div>
      </div>
    </div>
  );
}
