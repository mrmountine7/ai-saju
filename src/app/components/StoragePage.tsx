import { useNavigate } from 'react-router-dom';
import { Menu, Search, Plus, Crown, Bookmark, Database, Sparkles, ChevronRight, ArrowLeft, Calendar, Heart, Star, TrendingUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationCenter';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getDeviceId } from '@/lib/device-id';
import { useAnalysisMode, ANALYSIS_MODES } from '@/contexts/AnalysisModeContext';

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
    } catch (error) {
      console.error('프로필 불러오기 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 즐겨찾기 목록
  const favorites = profiles.filter(p => p.is_favorite);
  
  // 내 프로필 (is_primary가 true인 것)
  const myProfile = profiles.find(p => p.is_primary);

  // 시진 레이블 변환
  const getTimeLabel = (birthHour: string) => {
    const timeLabels: Record<string, string> = {
      'unknown': '모름',
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

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="p-1.5 -ml-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-300" />
              </button>
              <Database className="w-5 h-5 text-amber-400" />
              <span className="text-lg font-bold text-white">사주 보관소</span>
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
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Menu className="w-6 h-6 text-slate-300" />
              </button>
            </div>
          </div>

          {/* Mode Indicator */}
          <div className="mb-6">
            <button
              onClick={() => setShowModeSelector(!showModeSelector)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                mode === 'beginner' ? 'bg-white/90 border-amber-400 hover:bg-white' :
                mode === 'advanced' ? 'bg-slate-500/50 border-slate-400 hover:bg-slate-500/70' :
                'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  mode === 'beginner' ? 'bg-amber-100' :
                  mode === 'advanced' ? 'bg-slate-400/50' :
                  'bg-purple-500/20'
                }`}>
                  {mode === 'beginner' && <Star className="w-4 h-4 text-amber-500" />}
                  {mode === 'advanced' && <TrendingUp className="w-4 h-4 text-white" />}
                  {mode === 'expert' && <Crown className="w-4 h-4 text-purple-400" />}
                </div>
                <div className="text-left">
                  <span className={`text-sm font-medium ${
                    mode === 'beginner' ? 'text-amber-600' :
                    mode === 'advanced' ? 'text-white' :
                    'text-purple-400'
                  }`}>{modeInfo.name}</span>
                  <p className={`text-xs ${
                    mode === 'beginner' ? 'text-slate-600' :
                    mode === 'advanced' ? 'text-slate-200' :
                    'text-slate-500'
                  }`}>{modeInfo.description}</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 transition-transform ${
                mode === 'beginner' ? 'text-slate-500' :
                mode === 'advanced' ? 'text-slate-300' :
                'text-slate-400'
              } ${showModeSelector ? 'rotate-90' : ''}`} />
            </button>

            {/* Mode Selector Dropdown */}
            {showModeSelector && (
              <div className="mt-2 bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700 overflow-hidden">
                {(Object.keys(ANALYSIS_MODES) as Array<keyof typeof ANALYSIS_MODES>).map((modeKey) => {
                  const modeData = ANALYSIS_MODES[modeKey];
                  const isSelected = mode === modeKey;
                  return (
                    <button
                      key={modeKey}
                      onClick={() => {
                        setMode(modeKey);
                        setShowModeSelector(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        isSelected 
                          ? modeKey === 'beginner' ? 'bg-white/20' :
                            modeKey === 'advanced' ? 'bg-slate-500/30' :
                            'bg-purple-500/20'
                          : 'hover:bg-slate-700/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        modeKey === 'beginner' ? 'bg-amber-100' :
                        modeKey === 'advanced' ? 'bg-slate-500/50' :
                        'bg-purple-500/20'
                      }`}>
                        {modeKey === 'beginner' && <Star className="w-4 h-4 text-amber-500" />}
                        {modeKey === 'advanced' && <TrendingUp className="w-4 h-4 text-slate-200" />}
                        {modeKey === 'expert' && <Crown className="w-4 h-4 text-purple-400" />}
                      </div>
                      <div className="flex-1 text-left">
                        <span className={`text-sm font-medium ${
                          modeKey === 'beginner' ? 'text-amber-400' :
                          modeKey === 'advanced' ? 'text-slate-300' :
                          'text-purple-400'
                        }`}>{modeData.name}</span>
                        <p className="text-xs text-slate-500">{modeData.description}</p>
                      </div>
                      {isSelected && (
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          modeKey === 'beginner' ? 'bg-amber-500' :
                          modeKey === 'advanced' ? 'bg-slate-400' :
                          'bg-purple-500'
                        }`}>
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
              <span className="text-base font-semibold text-white">나의 프로필</span>
              <Search className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white transition-colors" />
            </div>
            <div 
              className="bg-slate-800/50 backdrop-blur rounded-xl p-4 cursor-pointer hover:bg-slate-700/50 transition-colors border border-slate-700"
              onClick={() => myProfile ? navigate(`/add?id=${myProfile.id}`) : navigate('/add')}
            >
              {myProfile ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/25">
                    {getZodiacAnimal(myProfile.birth_year).icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{myProfile.name}</div>
                    <div className="text-sm text-slate-400">{formatBirth(myProfile)} {myProfile.city}</div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-xs ${
                    mode === 'beginner' ? 'bg-amber-500/20 text-amber-400' :
                    mode === 'advanced' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {modeInfo.name}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-700 border-2 border-dashed border-slate-600 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-slate-500" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-400">프로필을 설정하세요</div>
                    <div className="text-sm text-slate-500">클릭하여 프로필 추가</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Favorites */}
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white mb-3">즐겨찾기</h2>
            <div 
              className={`bg-slate-800/50 backdrop-blur rounded-xl px-4 py-4 transition-all duration-200 border ${
                dragOverFavorite ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700'
              } ${isDragMode ? 'border-dashed border-amber-500/50' : ''}`}
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
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">
                        {getZodiacAnimal(profile.birth_year).icon}
                      </div>
                      <span className="text-xs text-slate-300 text-center w-14 truncate">{profile.name}</span>
                    </div>
                  ) : (
                    <div 
                      key={`empty-${index}`} 
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
                        <Plus className={`w-5 h-5 ${isDragMode ? 'text-amber-400' : 'text-slate-600'}`} />
                      </div>
                      <span className="text-xs text-transparent h-4">-</span>
                    </div>
                  );
                })}
              </div>
              {isDragMode && (
                <div className="text-sm text-amber-400 flex items-center justify-center gap-2 mt-3">
                  <Bookmark className="w-4 h-4" />
                  드롭하여 추가
                </div>
              )}
            </div>
          </div>

          {/* Saved List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">저장목록</h2>
              <button 
                onClick={() => navigate('/add')}
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
              >
                추가하기
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 space-y-3 border border-slate-700">
              {loading ? (
                <div className="text-center text-slate-400 py-8">불러오는 중...</div>
              ) : profiles.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  저장된 명식이 없습니다.<br />
                  <button 
                    onClick={() => navigate('/add')}
                    className="text-amber-400 hover:text-amber-300 mt-2"
                  >
                    새로 추가하기
                  </button>
                </div>
              ) : (
                <>
                  {isDragMode && (
                    <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-lg mb-2 border border-amber-500/30">
                      <span className="text-sm text-amber-400">드래그하여 순서 변경</span>
                      <button
                        onClick={handleExitDragMode}
                        className="px-3 py-1 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors"
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
                      className={`flex items-center gap-4 p-3 rounded-xl select-none transition-all duration-200 ${
                        isDragMode ? 'cursor-grab hover:bg-amber-500/10' : 'cursor-pointer hover:bg-slate-700/50'
                      } ${
                        draggedIndex === index ? 'opacity-50 scale-95' : ''
                      } ${
                        dragOverIndex === index ? 'border-2 border-amber-400 bg-amber-500/10' : ''
                      } ${
                        dragModeIndex === index && isDragMode ? 'ring-2 ring-amber-400 bg-amber-500/10' : ''
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center flex-shrink-0 text-xl">
                        {getZodiacAnimal(profile.birth_year).icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{profile.name}</div>
                        <div className="text-sm text-slate-400">{formatBirth(profile)} {profile.city}</div>
                      </div>
                      {profile.is_favorite && (
                        <Bookmark className="w-4 h-4 text-amber-400 fill-amber-400" />
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

      {/* Bottom Popup Menu - Dark Theme */}
      {showPopup && selectedProfile && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setShowPopup(false)}
          />
          
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl z-50 animate-slide-up border-t border-slate-700">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-slate-600 rounded-full" />
            </div>
            
            <div className="text-center py-5 border-b border-slate-700">
              <h3 className="text-xl font-semibold text-white">{selectedProfile.name}</h3>
              <p className="text-sm text-slate-400 mt-1">{formatBirth(selectedProfile)}</p>
            </div>
            
            <div className="py-2">
              <button 
                onClick={() => {
                  navigate(`/result?id=${selectedProfile.id}`);
                  setShowPopup(false);
                }}
                className="w-full py-4 text-center text-base text-white hover:bg-slate-800 border-b border-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles className="w-5 h-5 text-amber-400" />
                AI 사주풀이
              </button>
              
              <button 
                onClick={() => {
                  navigate('/daily', { state: { profile: selectedProfile } });
                  setShowPopup(false);
                }}
                className="w-full py-4 text-center text-base text-white hover:bg-slate-800 border-b border-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Calendar className="w-5 h-5 text-cyan-400" />
                일진 캘린더
              </button>
              
              <button 
                onClick={() => {
                  navigate('/compatibility');
                  setShowPopup(false);
                }}
                className="w-full py-4 text-center text-base text-white hover:bg-slate-800 border-b border-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Heart className="w-5 h-5 text-pink-400" />
                궁합 분석
              </button>
              
              <button 
                onClick={handleViewDetail}
                className="w-full py-4 text-center text-base text-white hover:bg-slate-800 border-b border-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Search className="w-5 h-5 text-slate-400" />
                명식 상세보기
              </button>
              
              <button 
                onClick={handleSetPrimary}
                className="w-full py-4 text-center text-base text-white hover:bg-slate-800 border-b border-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Crown className="w-5 h-5 text-amber-400" />
                프로필 등록
              </button>
              
              <button 
                onClick={handleToggleFavorite}
                className="w-full py-4 text-center text-base text-white hover:bg-slate-800 border-b border-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Bookmark className={`w-5 h-5 ${selectedProfile.is_favorite ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                {selectedProfile.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 등록'}
              </button>
              
              <button 
                onClick={handleDelete}
                className="w-full py-4 text-center text-base text-red-400 hover:bg-slate-800 transition-colors"
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
