import { useNavigate } from 'react-router-dom';
import { Menu, Search, Plus, Crown, Bookmark, Database, Sparkles, ChevronRight, ArrowLeft, Calendar, Heart, Star, TrendingUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationCenter';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getDeviceId } from '@/lib/device-id';
import { useAnalysisMode, ANALYSIS_MODES } from '@/contexts/AnalysisModeContext';
import { MODE_THEMES } from '@/contexts/ThemeContext';

interface Profile {
  id: string;
  name: string;
  gender: 'male' | 'female';
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: string;
  calendar_type: 'solar' | 'lunar';
  city: string | null;
  is_favorite: boolean;
  is_primary: boolean;
}

// 띠 계산 함수
function getZodiacAnimal(year: number): { name: string; icon: string } {
  const animals = [
    { name: '원숭이띠', icon: '🐵' },
    { name: '닭띠', icon: '🐔' },
    { name: '개띠', icon: '🐕' },
    { name: '돼지띠', icon: '🐷' },
    { name: '쥐띠', icon: '🐭' },
    { name: '소띠', icon: '🐮' },
    { name: '호랑이띠', icon: '🐯' },
    { name: '토끼띠', icon: '🐰' },
    { name: '용띠', icon: '🐲' },
    { name: '뱀띠', icon: '🐍' },
    { name: '말띠', icon: '🐴' },
    { name: '양띠', icon: '🐑' },
  ];
  return animals[year % 12];
}

export function StoragePage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { mode, modeInfo, setMode } = useAnalysisMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragMode, setIsDragMode] = useState(false); // 드래그 모드 활성화 여부
  const [dragModeIndex, setDragModeIndex] = useState<number | null>(null); // 드래그 모드 활성화된 아이템
  const [draggedProfile, setDraggedProfile] = useState<Profile | null>(null); // 드래그 중인 프로필
  const [dragOverFavorite, setDragOverFavorite] = useState(false); // 즐겨찾기 영역 위에 있는지

  // Supabase에서 프로필 목록 불러오기
  useEffect(() => {
    fetchProfiles();
  }, [user, isAdmin]);

  const fetchProfiles = async () => {
    try {
      const deviceId = getDeviceId();
      
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      // 관리자는 모든 프로필 조회 가능
      if (isAdmin) {
        // 관리자: 필터 없이 모든 프로필 조회
        console.log('[Admin] 모든 프로필 조회');
      } else if (user) {
        // 일반 회원: user_id 또는 device_id로 본인 프로필만 조회
        query = query.or(`user_id.eq.${user.id},device_id.eq.${deviceId}`);
      } else {
        // 비회원: device_id로만 조회
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error('프로필 불러오기 오류:', error?.message || error?.code || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  };

  // 즐겨찾기 목록
  const favorites = profiles.filter(p => p.is_favorite);
  
  // 내 프로필 (is_primary가 true인 것)
  const myProfile = profiles.find(p => p.is_primary);

  // 시진 레이블 변환 (전통 12시진 체계)
  const getTimeLabel = (birthHour: string) => {
    const timeLabels: Record<string, string> = {
      'unknown': '모름',
      // 새 시진 체계 (정시법)
      '00:00': '자시',
      '02:00': '축시',
      '04:00': '인시',
      '06:00': '묘시',
      '08:00': '진시',
      '10:00': '사시',
      '12:00': '오시',
      '14:00': '미시',
      '16:00': '신시',
      '18:00': '유시',
      '20:00': '술시',
      '22:00': '해시',
      // 이전 호환 (기존 데이터용)
      '23:30': '자시',
      '01:30': '축시',
      '03:30': '인시',
      '05:30': '묘시',
      '07:30': '진시',
      '09:30': '사시',
      '11:30': '오시',
      '13:30': '미시',
      '15:30': '신시',
      '17:30': '유시',
      '19:30': '술시',
      '21:30': '해시',
    };
    return timeLabels[birthHour] || birthHour;
  };

  // 생년월일 포맷팅
  const formatBirth = (profile: Profile) => {
    const calType = profile.calendar_type === 'lunar_leap' ? '음윤' : profile.calendar_type === 'lunar' ? '음' : '양';
    const timeLabel = getTimeLabel(profile.birth_hour);
    return `${profile.birth_year}/${String(profile.birth_month).padStart(2, '0')}/${String(profile.birth_day).padStart(2, '0')} ${timeLabel}(${calType})`;
  };

  // 롱프레스 시작 (1초 후 드래그 모드 활성화)
  const handlePressStart = (profile: Profile, index: number) => {
    longPressTimer.current = setTimeout(() => {
      setIsDragMode(true);
      setDragModeIndex(index);
      setSelectedProfile(profile);
    }, 1000); // 1초
  };

  // 롱프레스 취소
  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // 일반 클릭 - 팝업 메뉴 표시
  const handleItemClick = (e: React.MouseEvent, profile: Profile) => {
    // 드래그 모드일 때는 클릭 무시
    if (isDragMode) {
      e.preventDefault();
      return;
    }
    setSelectedProfile(profile);
    setShowPopup(true);
  };

  // 드래그 모드 종료
  const handleExitDragMode = () => {
    setIsDragMode(false);
    setDragModeIndex(null);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 명식 상세보기 (명식등록 화면 이동)
  const handleViewDetail = () => {
    if (selectedProfile) {
      navigate(`/add?id=${selectedProfile.id}`);
    }
    setShowPopup(false);
  };

  // 드래그 시작
  const handleDragStart = (index: number, profile: Profile) => {
    setDraggedIndex(index);
    setDraggedProfile(profile);
  };

  // 드래그 중 (다른 아이템 위에 있을 때)
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  // 드래그 종료 (드롭)
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDraggedProfile(null);
      return;
    }

    // 배열 순서 변경
    const newProfiles = [...profiles];
    const [draggedItem] = newProfiles.splice(draggedIndex, 1);
    newProfiles.splice(dropIndex, 0, draggedItem);
    setProfiles(newProfiles);

    setDraggedIndex(null);
    setDragOverIndex(null);
    setDraggedProfile(null);
  };

  // 드래그 종료 (드롭 없이)
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragOverFavorite(false);
    setDraggedProfile(null);
  };

  // 즐겨찾기 영역에 드래그 오버
  const handleFavoriteDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedProfile) {
      setDragOverFavorite(true);
    }
  };

  // 즐겨찾기 영역에서 드래그 벗어남
  const handleFavoriteDragLeave = () => {
    setDragOverFavorite(false);
  };

  // 즐겨찾기 영역에 드롭 - 즐겨찾기 등록
  const handleFavoriteDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedProfile && !draggedProfile.is_favorite) {
      try {
        await supabase
          .from('profiles')
          .update({ is_favorite: true })
          .eq('id', draggedProfile.id);
        fetchProfiles();
      } catch (error) {
        console.error('즐겨찾기 등록 오류:', error);
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragOverFavorite(false);
    setDraggedProfile(null);
    handleExitDragMode();
  };

  // 프로필 등록 (is_primary 설정)
  const handleSetPrimary = async () => {
    if (!selectedProfile) return;
    try {
      // 기존 프로필 해제
      await supabase.from('profiles').update({ is_primary: false }).eq('is_primary', true);
      // 선택한 프로필을 프라이머리로 설정
      await supabase.from('profiles').update({ is_primary: true }).eq('id', selectedProfile.id);
      setShowPopup(false);
      fetchProfiles();
    } catch (error) {
      console.error('프로필 등록 오류:', error);
    }
  };

  // 즐겨찾기 토글
  const handleToggleFavorite = async () => {
    if (!selectedProfile) return;
    try {
      await supabase
        .from('profiles')
        .update({ is_favorite: !selectedProfile.is_favorite })
        .eq('id', selectedProfile.id);
      setShowPopup(false);
      fetchProfiles();
    } catch (error) {
      console.error('즐겨찾기 오류:', error);
    }
  };

  // 명식 삭제
  const handleDelete = async () => {
    if (!selectedProfile) return;
    if (!confirm(`"${selectedProfile.name}" 명식을 삭제하시겠습니까?`)) return;
    try {
      await supabase.from('profiles').delete().eq('id', selectedProfile.id);
      setShowPopup(false);
      fetchProfiles();
    } catch (error) {
      console.error('삭제 오류:', error);
    }
  };

  // 현재 모드의 테마
  const theme = MODE_THEMES[mode];

  return (
    <>
      <div className="min-h-screen relative overflow-hidden" style={{ background: theme.bgGradient }}>
        {/* 천간/지지 배경 장식 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.06]">
          {/* 천간 (天干) - 좌측 */}
          <div className="absolute text-2xl text-gray-400" style={{ top: '3%', left: '5%', transform: 'rotate(-15deg)' }}>甲</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '12%', left: '18%', transform: 'rotate(8deg)' }}>乙</div>
          <div className="absolute text-2xl text-gray-400" style={{ top: '22%', left: '3%', transform: 'rotate(-10deg)' }}>丙</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '35%', left: '15%', transform: 'rotate(12deg)' }}>丁</div>
          <div className="absolute text-2xl text-gray-400" style={{ top: '48%', left: '6%', transform: 'rotate(-8deg)' }}>戊</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '58%', left: '20%', transform: 'rotate(15deg)' }}>己</div>
          <div className="absolute text-2xl text-gray-400" style={{ top: '70%', left: '4%', transform: 'rotate(-12deg)' }}>庚</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '82%', left: '16%', transform: 'rotate(6deg)' }}>辛</div>
          <div className="absolute text-2xl text-gray-400" style={{ top: '90%', left: '8%', transform: 'rotate(-18deg)' }}>壬</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '95%', left: '22%', transform: 'rotate(10deg)' }}>癸</div>

          {/* 지지 (地支) - 우측 */}
          <div className="absolute text-2xl text-gray-400" style={{ top: '5%', right: '6%', transform: 'rotate(12deg)' }}>子</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '14%', right: '18%', transform: 'rotate(-10deg)' }}>丑</div>
          <div className="absolute text-2xl text-gray-400" style={{ top: '25%', right: '4%', transform: 'rotate(18deg)' }}>寅</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '38%', right: '15%', transform: 'rotate(-15deg)' }}>卯</div>
          <div className="absolute text-2xl text-gray-400" style={{ top: '50%', right: '7%', transform: 'rotate(8deg)' }}>辰</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '60%', right: '20%', transform: 'rotate(-12deg)' }}>巳</div>
          <div className="absolute text-2xl text-gray-400" style={{ top: '72%', right: '5%', transform: 'rotate(15deg)' }}>午</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '83%', right: '17%', transform: 'rotate(-8deg)' }}>未</div>
          <div className="absolute text-2xl text-gray-400" style={{ top: '92%', right: '8%', transform: 'rotate(10deg)' }}>申</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '97%', right: '22%', transform: 'rotate(-6deg)' }}>酉</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '8%', right: '35%', transform: 'rotate(5deg)' }}>戌</div>
          <div className="absolute text-xl text-gray-400" style={{ top: '8%', left: '35%', transform: 'rotate(-5deg)' }}>亥</div>
        </div>
        
        <div className="max-w-lg mx-auto px-4 py-6 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="p-1.5 -ml-1.5 rounded-full transition-colors"
                style={{ backgroundColor: `${theme.primary}10` }}
              >
                <ArrowLeft className="w-5 h-5" style={{ color: theme.textSecondary }} />
              </button>
              <Database className="w-5 h-5" style={{ color: theme.primary, filter: `drop-shadow(0 0 8px ${theme.primaryGlow})` }} />
              <span 
                className="text-lg font-bold" 
                style={{ 
                  color: theme.textPrimary,
                  textShadow: `0 0 20px ${theme.primaryGlow}, 0 0 10px ${theme.primaryGlow}`
                }}
              >사주 보관소</span>
              {isAdmin && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                  관리자
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-full transition-colors"
                style={{ backgroundColor: `${theme.primary}10` }}
              >
                <Menu className="w-6 h-6" style={{ color: theme.textSecondary }} />
              </button>
            </div>
          </div>

          {/* Mode Indicator */}
          <div className="mb-6">
            <button
              onClick={() => setShowModeSelector(!showModeSelector)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
              style={{ 
                backgroundColor: theme.cardBg, 
                border: `${theme.cardBorderWidth} solid ${theme.cardBorder}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${theme.primary}30` }}
                >
                  {mode === 'beginner' && <Star className="w-4 h-4" style={{ color: theme.primary }} />}
                  {mode === 'advanced' && <TrendingUp className="w-4 h-4" style={{ color: theme.primary }} />}
                  {mode === 'expert' && <Crown className="w-4 h-4" style={{ color: theme.primary }} />}
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium" style={{ color: theme.cardText }}>{modeInfo.name}</span>
                  <p className="text-xs" style={{ color: theme.cardTextMuted }}>{modeInfo.description}</p>
                </div>
              </div>
              <ChevronRight 
                className={`w-5 h-5 transition-transform ${showModeSelector ? 'rotate-90' : ''}`} 
                style={{ color: theme.cardTextMuted }}
              />
            </button>

            {/* Mode Selector Dropdown */}
            {showModeSelector && (
              <div 
                className="mt-2 backdrop-blur rounded-xl overflow-hidden"
                style={{ backgroundColor: theme.cardBg, border: `${theme.cardBorderWidth} solid ${theme.cardBorder}` }}
              >
                {(Object.keys(ANALYSIS_MODES) as Array<keyof typeof ANALYSIS_MODES>).map((modeKey) => {
                  const modeData = ANALYSIS_MODES[modeKey];
                  const modeTheme = MODE_THEMES[modeKey];
                  const isSelected = mode === modeKey;
                  return (
                    <button
                      key={modeKey}
                      onClick={() => {
                        setMode(modeKey);
                        setShowModeSelector(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                      style={{ 
                        backgroundColor: isSelected ? `${modeTheme.primary}20` : 'transparent',
                      }}
                    >
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${modeTheme.primary}30` }}
                      >
                        {modeKey === 'beginner' && <Star className="w-4 h-4" style={{ color: modeTheme.primary }} />}
                        {modeKey === 'advanced' && <TrendingUp className="w-4 h-4" style={{ color: modeTheme.primary }} />}
                        {modeKey === 'expert' && <Crown className="w-4 h-4" style={{ color: modeTheme.primary }} />}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-sm font-medium" style={{ color: modeTheme.cardText }}>{modeData.name}</span>
                        <p className="text-xs" style={{ color: modeTheme.cardTextMuted }}>{modeData.description}</p>
                      </div>
                      {isSelected && (
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: modeTheme.primary }}
                        >
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Profile Card */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span 
                className="text-base font-semibold" 
                style={{ color: theme.textSecondary, textShadow: `0 0 15px ${theme.primaryGlow}` }}
              >나의 프로필</span>
              <Search className="w-5 h-5 cursor-pointer transition-colors" style={{ color: theme.textMuted }} />
            </div>
            <div 
              className="backdrop-blur rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
              style={{ 
                backgroundColor: theme.cardBg, 
                border: `${theme.cardBorderWidth} solid ${theme.cardBorder}`,
                boxShadow: `0 4px 20px ${theme.primaryGlow}40`
              }}
              onClick={() => myProfile ? navigate(`/add?id=${myProfile.id}`) : navigate('/add')}
            >
              {myProfile ? (
                <div className="flex items-center gap-4">
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg"
                    style={{ 
                      background: `linear-gradient(135deg, ${theme.primary}, ${theme.buttonHover})`,
                      boxShadow: `0 10px 25px ${theme.primaryGlow}`
                    }}
                  >
                    {getZodiacAnimal(myProfile.birth_year).icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium" style={{ color: theme.cardText }}>{myProfile.name}</div>
                    <div className="text-sm" style={{ color: theme.cardTextMuted }}>{formatBirth(myProfile)} {myProfile.city}</div>
                  </div>
                  <div 
                    className="px-2 py-1 rounded-lg text-xs"
                    style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}
                  >
                    {modeInfo.name}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div 
                    className="w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center"
                    style={{ borderColor: theme.cardBorder }}
                  >
                    <Plus className="w-6 h-6" style={{ color: theme.cardTextMuted }} />
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: theme.cardText }}>프로필을 설정하세요</div>
                    <div className="text-sm" style={{ color: theme.cardTextMuted }}>클릭하여 프로필 추가</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Favorites */}
          <div className="mb-6">
            <h2 
              className="text-base font-semibold mb-3" 
              style={{ color: theme.textSecondary, textShadow: `0 0 15px ${theme.primaryGlow}` }}
            >즐겨찾기</h2>
            <div 
              className="backdrop-blur rounded-xl px-4 py-4 transition-all duration-200"
              style={{ 
                backgroundColor: dragOverFavorite ? `${theme.primary}15` : theme.cardBg, 
                border: `${theme.cardBorderWidth} ${isDragMode ? 'dashed' : 'solid'} ${dragOverFavorite ? theme.primary : theme.cardBorder}`,
                boxShadow: `0 4px 20px ${theme.primaryGlow}30`
              }}
              onDragOver={handleFavoriteDragOver}
              onDragLeave={handleFavoriteDragLeave}
              onDrop={handleFavoriteDrop}
            >
              <div className="grid grid-cols-5 gap-2 w-full items-start justify-items-center">
                {Array.from({ length: 5 }).map((_, index) => {
                  const profile = favorites[index];
                  return profile ? (
                    <div 
                      key={profile.id} 
                      className="flex flex-col items-center gap-1.5 cursor-pointer"
                      onClick={() => {
                        setSelectedProfile(profile);
                        setShowPopup(true);
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg"
                        style={{ 
                          background: `linear-gradient(135deg, ${theme.primary}, ${theme.buttonHover})`,
                          boxShadow: `0 8px 20px ${theme.primaryGlow}`
                        }}
                      >
                        {getZodiacAnimal(profile.birth_year).icon}
                      </div>
                      <span className="text-xs text-center w-14 truncate" style={{ color: theme.textSecondary }}>{profile.name}</span>
                    </div>
                  ) : (
                    <div 
                      key={`empty-${index}`} 
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div 
                        className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center"
                        style={{ borderColor: theme.cardBorder }}
                      >
                        <Plus className="w-5 h-5" style={{ color: isDragMode ? theme.primary : theme.textMuted }} />
                      </div>
                      <span className="text-xs text-transparent h-4">-</span>
                    </div>
                  );
                })}
              </div>
              {isDragMode && (
                <div className="text-sm flex items-center justify-center gap-2 mt-3" style={{ color: theme.primary }}>
                  <Bookmark className="w-4 h-4" />
                  드롭하여 추가
                </div>
              )}
            </div>
          </div>

          {/* Saved List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 
                className="text-base font-semibold" 
                style={{ color: theme.textSecondary, textShadow: `0 0 15px ${theme.primaryGlow}` }}
              >저장목록</h2>
              <button 
                onClick={() => navigate('/add')}
                className="text-sm transition-colors flex items-center gap-1"
                style={{ color: theme.primary, textShadow: `0 0 10px ${theme.primaryGlow}` }}
              >
                추가하기
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div 
              className="backdrop-blur rounded-xl p-4 space-y-3"
              style={{ 
                backgroundColor: theme.cardBg, 
                border: `${theme.cardBorderWidth} solid ${theme.cardBorder}`,
                boxShadow: `0 4px 20px ${theme.primaryGlow}30`
              }}
            >
              {loading ? (
                <div className="text-center py-8" style={{ color: theme.cardTextMuted }}>불러오는 중...</div>
              ) : profiles.length === 0 ? (
                <div className="text-center py-8" style={{ color: theme.cardText }}>
                  저장된 명식이 없습니다.<br />
                  <button 
                    onClick={() => navigate('/add')}
                    className="mt-2"
                    style={{ color: theme.primary }}
                  >
                    새로 추가하기
                  </button>
                </div>
              ) : (
                <>
                  {isDragMode && (
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg mb-2 border"
                      style={{ backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}50` }}
                    >
                      <span className="text-sm" style={{ color: theme.primary }}>드래그하여 순서 변경</span>
                      <button
                        onClick={handleExitDragMode}
                        className="px-3 py-1 text-white rounded-lg text-sm transition-colors"
                        style={{ backgroundColor: theme.primary }}
                      >
                        완료
                      </button>
                    </div>
                  )}
                  {profiles.map((profile, index) => (
                    <div 
                      key={profile.id}
                      draggable={isDragMode}
                      onDragStart={() => isDragMode && handleDragStart(index, profile)}
                      onDragOver={(e) => isDragMode && handleDragOver(e, index)}
                      onDrop={(e) => isDragMode && handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => !isDragMode && handleItemClick(e, profile)}
                      onMouseDown={() => handlePressStart(profile, index)}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onTouchStart={() => handlePressStart(profile, index)}
                      onTouchEnd={handlePressEnd}
                      className="flex items-center gap-4 p-3 rounded-xl select-none transition-all duration-200"
                      style={{
                        cursor: isDragMode ? 'grab' : 'pointer',
                        opacity: draggedIndex === index ? 0.5 : 1,
                        transform: draggedIndex === index ? 'scale(0.95)' : 'none',
                        border: dragOverIndex === index ? `2px solid ${theme.primary}` : 'none',
                        backgroundColor: (dragOverIndex === index || (dragModeIndex === index && isDragMode)) ? `${theme.primary}15` : 'transparent',
                        boxShadow: dragModeIndex === index && isDragMode ? `0 0 0 2px ${theme.primary}` : 'none'
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xl"
                        style={{ borderColor: theme.cardBorder, backgroundColor: `${theme.primary}10` }}
                      >
                        {getZodiacAnimal(profile.birth_year).icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: theme.cardText }}>{profile.name}</div>
                        <div className="text-sm" style={{ color: theme.cardTextMuted }}>{formatBirth(profile)} {profile.city}</div>
                      </div>
                      {profile.is_favorite && (
                        <Bookmark className="w-4 h-4" style={{ color: theme.primary, fill: theme.primary }} />
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Bottom Popup Menu - Theme Styled */}
      {showPopup && selectedProfile && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setShowPopup(false)}
          />
          
          <div 
            className="fixed bottom-0 left-0 right-0 rounded-t-3xl z-50 animate-slide-up border-t"
            style={{ background: theme.bgGradient, borderColor: theme.cardBorder }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 rounded-full" style={{ backgroundColor: theme.cardBorder }} />
            </div>
            
            <div className="text-center py-5 border-b" style={{ borderColor: theme.cardBorder }}>
              <h3 className="text-xl font-semibold" style={{ color: theme.textPrimary }}>{selectedProfile.name}</h3>
              <p className="text-sm mt-1" style={{ color: theme.textMuted }}>{formatBirth(selectedProfile)}</p>
            </div>
            
            <div className="py-2">
              <button 
                onClick={() => {
                  navigate(`/result?id=${selectedProfile.id}`);
                  setShowPopup(false);
                }}
                className="w-full py-4 text-center text-base border-b flex items-center justify-center gap-2 transition-colors"
                style={{ color: theme.textSecondary, borderColor: theme.cardBorder }}
              >
                <Sparkles className="w-5 h-5" style={{ color: theme.primary }} />
                天乙貴人 풀이
              </button>
              
              <button 
                onClick={() => {
                  navigate('/daily', { state: { profile: selectedProfile } });
                  setShowPopup(false);
                }}
                className="w-full py-4 text-center text-base border-b flex items-center justify-center gap-2 transition-colors"
                style={{ color: theme.textSecondary, borderColor: theme.cardBorder }}
              >
                <Calendar className="w-5 h-5" style={{ color: theme.primary }} />
                일진 캘린더
              </button>
              
              <button 
                onClick={() => {
                  navigate('/compatibility');
                  setShowPopup(false);
                }}
                className="w-full py-4 text-center text-base border-b flex items-center justify-center gap-2 transition-colors"
                style={{ color: theme.textSecondary, borderColor: theme.cardBorder }}
              >
                <Heart className="w-5 h-5" style={{ color: theme.primary }} />
                궁합 분석
              </button>
              
              <button 
                onClick={handleViewDetail}
                className="w-full py-4 text-center text-base border-b flex items-center justify-center gap-2 transition-colors"
                style={{ color: theme.textSecondary, borderColor: theme.cardBorder }}
              >
                <Search className="w-5 h-5" style={{ color: theme.textMuted }} />
                명식 상세보기
              </button>
              
              <button 
                onClick={handleSetPrimary}
                className="w-full py-4 text-center text-base border-b flex items-center justify-center gap-2 transition-colors"
                style={{ color: theme.textSecondary, borderColor: theme.cardBorder }}
              >
                <Crown className="w-5 h-5" style={{ color: theme.primary }} />
                프로필 등록
              </button>
              
              <button 
                onClick={handleToggleFavorite}
                className="w-full py-4 text-center text-base border-b flex items-center justify-center gap-2 transition-colors"
                style={{ color: theme.textSecondary, borderColor: theme.cardBorder }}
              >
                <Bookmark 
                  className="w-5 h-5" 
                  style={{ 
                    color: selectedProfile.is_favorite ? theme.primary : theme.textMuted,
                    fill: selectedProfile.is_favorite ? theme.primary : 'none'
                  }} 
                />
                {selectedProfile.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 등록'}
              </button>
              
              <button 
                onClick={handleDelete}
                className="w-full py-4 text-center text-base text-red-400 transition-colors"
              >
                명식 삭제
              </button>
            </div>
            
            <div className="h-8" />
          </div>
        </>
      )}
    </>
  );
}
