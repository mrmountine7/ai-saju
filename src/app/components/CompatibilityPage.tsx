import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Users, Sparkles, ChevronRight, Plus, Brain, BookOpen, TrendingUp, AlertCircle, Database, RefreshCw, Clock, CheckCircle, XCircle, Flame, Droplets, Sun, Moon, Wind, Mountain, Star, Zap, Shield, Target, Compass, Scale, ThermometerSun, ThermometerSnowflake } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAnalysisMode } from '@/contexts/AnalysisModeContext';
import { getDeviceId } from '@/lib/device-id';

interface Profile {
  id: string;
  name: string;
  gender: 'male' | 'female';
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: string;
  is_primary?: boolean;
}

interface SajuResult {
  id: string;
  profile_id: string;
  pillars: any;
  interpretation: any;
  synthesis: string;
  easy_explanation: string;
  classical_refs: any[];
  daeun: any;
  seun: any;
}

interface CompatibilityAnalysis {
  success: boolean;
  totalScore: number;
  grade: string;
  summary: string;
  sections: {
    hannan: CompatibilitySection;
    chungHap: CompatibilitySection;
    jijanggan: CompatibilitySection;
    sipsin: CompatibilitySection;
    yongshin: CompatibilitySection;
    daeun: CompatibilitySection;
    overall: CompatibilitySection;
  };
  strengths: string[];
  cautions: string[];
  advice: string;
  classicalRefs: any[];
}

interface CompatibilitySection {
  title: string;
  score: number;
  maxScore: number;
  summary: string;
  details: string[];
  easyExplanation: string;
}

const parseHour = (birthHour: string): number => {
  if (!birthHour || birthHour === 'unknown' || birthHour === '모름') return 12;
  if (birthHour.includes(':')) {
    const hour = parseInt(birthHour.split(':')[0], 10);
    if (!isNaN(hour)) return hour;
  }
  const labelMap: Record<string, number> = {
    '자시': 0, '축시': 2, '인시': 4, '묘시': 6,
    '진시': 8, '사시': 10, '오시': 12, '미시': 14,
    '신시': 16, '유시': 18, '술시': 20, '해시': 22,
  };
  return labelMap[birthHour] ?? 12;
};

function getZodiacAnimal(year: number): { name: string; icon: string } {
  const animals = [
    { name: '원숭이띠', icon: '🐵' }, { name: '닭띠', icon: '🐔' },
    { name: '개띠', icon: '🐕' }, { name: '돼지띠', icon: '🐷' },
    { name: '쥐띠', icon: '🐭' }, { name: '소띠', icon: '🐮' },
    { name: '호랑이띠', icon: '🐯' }, { name: '토끼띠', icon: '🐰' },
    { name: '용띠', icon: '🐲' }, { name: '뱀띠', icon: '🐍' },
    { name: '말띠', icon: '🐴' }, { name: '양띠', icon: '🐑' },
  ];
  return animals[year % 12];
}

const gradeStyles: Record<string, { color: string; bg: string; text: string; emoji: string }> = {
  '천생연분': { color: 'from-pink-500 to-rose-500', bg: 'bg-pink-500/20', text: 'text-pink-400', emoji: '💕' },
  '좋은 인연': { color: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/20', text: 'text-amber-400', emoji: '💗' },
  '보통': { color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-500/20', text: 'text-blue-400', emoji: '💛' },
  '노력 필요': { color: 'from-purple-500 to-violet-500', bg: 'bg-purple-500/20', text: 'text-purple-400', emoji: '💜' },
  '주의 필요': { color: 'from-red-500 to-rose-600', bg: 'bg-red-500/20', text: 'text-red-400', emoji: '⚠️' },
};

export function CompatibilityPage() {
  const navigate = useNavigate();
  const { mode } = useAnalysisMode();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [mySajuResult, setMySajuResult] = useState<SajuResult | null>(null);
  const [partnerSajuResult, setPartnerSajuResult] = useState<SajuResult | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState<'me' | 'partner' | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CompatibilityAnalysis | null>(null);
  const [activeSection, setActiveSection] = useState<string>('overall');
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (myProfile) {
      fetchSajuResult(myProfile.id, 'my');
    }
  }, [myProfile]);

  useEffect(() => {
    if (partnerProfile) {
      fetchSajuResult(partnerProfile.id, 'partner');
    }
  }, [partnerProfile]);

  const fetchProfiles = async () => {
    try {
      const deviceId = getDeviceId();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, gender, birth_year, birth_month, birth_day, birth_hour, is_primary')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProfiles(data || []);
      
      const primary = data?.find(p => p.is_primary);
      if (primary) setMyProfile(primary);
    } catch (error) {
      console.error('프로필 불러오기 오류:', error);
    }
  };

  const fetchSajuResult = async (profileId: string, target: 'my' | 'partner') => {
    try {
      const { data, error } = await supabase
        .from('saju_results')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (target === 'my') {
        setMySajuResult(data || null);
      } else {
        setPartnerSajuResult(data || null);
      }
    } catch (error) {
      console.error(`${target} 사주 결과 불러오기 오류:`, error);
      if (target === 'my') setMySajuResult(null);
      else setPartnerSajuResult(null);
    }
  };

  const navigateToAnalysis = (profile: Profile) => {
    navigate(`/result/${profile.id}`, { state: { profile, fromCompatibility: true } });
  };

  const handleAnalyze = async () => {
    if (!myProfile || !partnerProfile || !mySajuResult || !partnerSajuResult) return;
    
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    const loadingMessages = [
      '두 분의 사주팔자를 비교하고 있어요...',
      '한난조습(寒暖燥濕) 기후 궁합을 분석 중...',
      '합충형파(合沖刑破) 관계를 살펴보고 있어요...',
      '지장간(支藏干) 속 숨은 인연을 찾는 중...',
      '십신(十神) 상호작용을 분석하고 있어요...',
      '용신(用神) 보완 관계를 확인 중...',
      '대운(大運) 흐름의 조화를 살피는 중...',
      '고전 문헌에서 궁합 비결을 찾고 있어요...',
      '종합 해석을 정리하고 있어요...',
    ];
    
    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      setLoadingMessage(loadingMessages[msgIndex % loadingMessages.length]);
      msgIndex++;
    }, 2000);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/saju/compatibility/detailed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person1_profile_id: myProfile.id,
          person1_name: myProfile.name,
          person1_gender: myProfile.gender,
          person1_year: myProfile.birth_year,
          person1_month: myProfile.birth_month,
          person1_day: myProfile.birth_day,
          person1_hour: parseHour(myProfile.birth_hour),
          person1_saju_result: mySajuResult,
          person2_profile_id: partnerProfile.id,
          person2_name: partnerProfile.name,
          person2_gender: partnerProfile.gender,
          person2_year: partnerProfile.birth_year,
          person2_month: partnerProfile.birth_month,
          person2_day: partnerProfile.birth_day,
          person2_hour: parseHour(partnerProfile.birth_hour),
          person2_saju_result: partnerSajuResult,
          analysis_level: mode === 'beginner' ? 'easy' : mode === 'advanced' ? 'detailed' : 'expert',
        }),
      });
      
      if (!response.ok) throw new Error(`API 오류: ${response.status}`);
      
      const result = await response.json();
      setAnalysisResult(result);
    } catch (error) {
      console.error('궁합 분석 오류:', error);
      setAnalysisResult({
        success: false,
        totalScore: 0,
        grade: '',
        summary: '',
        sections: {} as any,
        strengths: [],
        cautions: [],
        advice: '',
        classicalRefs: [],
      });
    } finally {
      clearInterval(msgInterval);
      setIsAnalyzing(false);
    }
  };

  const canAnalyze = myProfile && partnerProfile && mySajuResult && partnerSajuResult;
  const needsMyAnalysis = myProfile && !mySajuResult;
  const needsPartnerAnalysis = partnerProfile && !partnerSajuResult;

  const gradeStyle = gradeStyles[analysisResult?.grade || '보통'] || gradeStyles['보통'];

  const sectionIcons: Record<string, any> = {
    overall: Heart,
    hannan: ThermometerSun,
    chungHap: Zap,
    jijanggan: Mountain,
    sipsin: Users,
    yongshin: Star,
    daeun: Compass,
  };

  const sectionLabels: Record<string, string> = {
    overall: '종합 궁합',
    hannan: '한난조습',
    chungHap: '합충형파',
    jijanggan: '지장간',
    sipsin: '십신 관계',
    yongshin: '용신 보완',
    daeun: '대운 조화',
  };

  const ProfileCard = ({ profile, sajuResult, label, onClick, color, onAnalyze }: { 
    profile: Profile | null; 
    sajuResult: SajuResult | null;
    label: string; 
    onClick: () => void;
    color: string;
    onAnalyze?: () => void;
  }) => (
    <div className="flex-1">
      <div 
        onClick={onClick}
        className={`bg-white rounded-2xl p-4 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-all shadow-sm ${
          profile ? '' : 'border-dashed'
        }`}
      >
        {profile ? (
          <div className="text-center">
            <div className={`w-16 h-16 mx-auto rounded-full ${color} flex items-center justify-center text-3xl mb-3 shadow-lg`}>
              {getZodiacAnimal(profile.birth_year).icon}
            </div>
            <div className="text-gray-900 font-medium">{profile.name}</div>
            <div className="text-gray-600 text-xs mt-1">
              {profile.birth_year}년생 · {profile.gender === 'male' ? '남' : '여'}
            </div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center mb-3">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <div className="text-gray-600 text-sm">{label} 선택</div>
            <div className="text-gray-400 text-xs mt-1">탭하여 선택</div>
          </div>
        )}
      </div>
      
      {profile && !sajuResult && (
        <button
          onClick={onAnalyze}
          className="w-full mt-2 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1"
        >
          <AlertCircle className="w-3 h-3" />
          사주풀이 먼저 받기
        </button>
      )}
      {profile && sajuResult && (
        <div className="mt-2 py-1 text-center">
          <span className="text-xs text-green-600 flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3" />
            사주풀이 완료
          </span>
        </div>
      )}
    </div>
  );

  const SectionCard = ({ sectionKey, section }: { sectionKey: string; section: CompatibilitySection }) => {
    const Icon = sectionIcons[sectionKey] || Heart;
    const isActive = activeSection === sectionKey;
    
    return (
      <div 
        className={`rounded-2xl border transition-all cursor-pointer ${
          isActive 
            ? 'bg-slate-800 border-pink-500/50 shadow-lg shadow-pink-500/10' 
            : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800/70'
        }`}
        onClick={() => setActiveSection(sectionKey)}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${isActive ? 'bg-pink-500/20' : 'bg-slate-700'} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${isActive ? 'text-pink-400' : 'text-slate-400'}`} />
              </div>
              <span className="font-medium text-white">{section.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-lg font-bold ${isActive ? 'text-pink-400' : 'text-white'}`}>
                {section.score}
              </span>
              <span className="text-xs text-slate-500">/{section.maxScore}</span>
            </div>
          </div>
          
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
            <div 
              className={`h-full rounded-full transition-all ${
                section.score / section.maxScore >= 0.8 ? 'bg-pink-500' :
                section.score / section.maxScore >= 0.6 ? 'bg-amber-500' :
                section.score / section.maxScore >= 0.4 ? 'bg-blue-500' : 'bg-slate-500'
              }`}
              style={{ width: `${(section.score / section.maxScore) * 100}%` }}
            />
          </div>
          
          <p className="text-sm text-slate-300">{section.summary}</p>
        </div>
        
        {isActive && (
          <div className="border-t border-slate-700 p-4 space-y-4">
            <div className="bg-slate-900/50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-pink-400 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                쉬운 설명
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {section.easyExplanation}
              </p>
            </div>
            
            {section.details.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-400">상세 분석</h4>
                {section.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-pink-400 mt-0.5">•</span>
                    <span className="text-slate-300">{detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate('/storage')}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">AI 궁합 분석</h1>
            <p className="text-xs text-slate-400">고전문헌 기반 정밀 궁합 해석</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Profile Selection */}
        <div className="flex gap-4 mb-6">
          <ProfileCard 
            profile={myProfile} 
            sajuResult={mySajuResult}
            label="나" 
            onClick={() => setShowProfileSelector('me')}
            color="bg-gradient-to-br from-blue-400 to-blue-600"
            onAnalyze={() => myProfile && navigateToAnalysis(myProfile)}
          />
          
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center">
              <Heart className="w-6 h-6 text-pink-400" />
            </div>
          </div>
          
          <ProfileCard 
            profile={partnerProfile}
            sajuResult={partnerSajuResult}
            label="상대" 
            onClick={() => setShowProfileSelector('partner')}
            color="bg-gradient-to-br from-pink-400 to-rose-600"
            onAnalyze={() => partnerProfile && navigateToAnalysis(partnerProfile)}
          />
        </div>

        {/* Analysis Required Notice */}
        {(needsMyAnalysis || needsPartnerAnalysis) && (
          <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/30 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-400 mb-1">사주풀이가 필요해요</h3>
                <p className="text-sm text-slate-300 mb-3">
                  정확한 궁합 분석을 위해 먼저 각자의 사주풀이를 받아야 해요.
                  사주풀이 결과를 바탕으로 더 깊고 정확한 궁합을 알려드릴게요.
                </p>
                <div className="flex flex-wrap gap-2">
                  {needsMyAnalysis && (
                    <button
                      onClick={() => myProfile && navigateToAnalysis(myProfile)}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium"
                    >
                      {myProfile?.name}님 사주풀이 받기
                    </button>
                  )}
                  {needsPartnerAnalysis && (
                    <button
                      onClick={() => partnerProfile && navigateToAnalysis(partnerProfile)}
                      className="px-3 py-1.5 bg-pink-500 text-white rounded-lg text-xs font-medium"
                    >
                      {partnerProfile?.name}님 사주풀이 받기
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analyze Button */}
        {myProfile && partnerProfile && (
          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing || !canAnalyze}
            className={`w-full py-4 rounded-xl font-medium shadow-lg transition-all mb-6 flex items-center justify-center gap-2 ${
              canAnalyze 
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-pink-500/25 hover:shadow-pink-500/40'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isAnalyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                궁합 분석 중...
              </>
            ) : analysisResult?.success ? (
              <>
                <RefreshCw className="w-5 h-5" />
                다시 분석하기
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                AI 궁합 분석하기
              </>
            )}
          </button>
        )}

        {/* Loading State */}
        {isAnalyzing && (
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 text-center mb-6">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-pink-500/30 rounded-full animate-ping" />
              <div className="absolute inset-2 border-4 border-pink-500/50 rounded-full animate-pulse" />
              <Heart className="absolute inset-0 m-auto w-10 h-10 text-pink-400 animate-pulse" />
            </div>
            <p className="text-white font-medium mb-2">궁합 분석 중...</p>
            <p className="text-slate-400 text-sm mb-4">{loadingMessage}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['한난조습', '합충형파', '지장간', '십신', '용신', '대운'].map((item) => (
                <span key={item} className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded-full animate-pulse">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {analysisResult && analysisResult.success && (
          <>
            {/* Total Score */}
            <div className={`${gradeStyle.bg} rounded-2xl p-6 border border-pink-500/30 mb-6`}>
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">{gradeStyle.emoji}</div>
                <div className="relative w-32 h-32 mx-auto">
                  <svg className="w-32 h-32 -rotate-90">
                    <circle cx="64" cy="64" r="56" className="fill-none stroke-slate-700 stroke-[8]" />
                    <circle 
                      cx="64" cy="64" r="56" 
                      className={`fill-none stroke-[8] ${gradeStyle.text.replace('text-', 'stroke-')}`}
                      strokeDasharray={`${analysisResult.totalScore * 3.52} 352`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-white">{analysisResult.totalScore}</span>
                    <span className={`text-sm ${gradeStyle.text}`}>점</span>
                  </div>
                </div>
                <p className={`text-xl font-bold mt-4 ${gradeStyle.text}`}>{analysisResult.grade}</p>
              </div>
              
              <div className="bg-slate-900/30 rounded-xl p-4">
                <p className="text-sm text-slate-200 leading-relaxed text-center">
                  {analysisResult.summary}
                </p>
              </div>
            </div>

            {/* Section Navigation */}
            <div className="flex overflow-x-auto gap-2 mb-4 pb-2 -mx-4 px-4">
              {Object.entries(sectionLabels).map(([key, label]) => {
                const Icon = sectionIcons[key];
                const isActive = activeSection === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      isActive 
                        ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Section Details */}
            <div className="space-y-4 mb-6">
              {analysisResult.sections && Object.entries(analysisResult.sections)
                .filter(([key]) => key === activeSection)
                .map(([key, section]) => (
                  <SectionCard key={key} sectionKey={key} section={section} />
                ))
              }
            </div>

            {/* Strengths & Cautions */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <h3 className="font-medium text-green-400">좋은 점</h3>
                </div>
                <ul className="space-y-2">
                  {analysisResult.strengths.slice(0, 5).map((item, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                      <span className="text-green-400 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  <h3 className="font-medium text-orange-400">주의할 점</h3>
                </div>
                <ul className="space-y-2">
                  {analysisResult.cautions.slice(0, 5).map((item, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                      <span className="text-orange-400 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Advice */}
            {analysisResult.advice && (
              <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl p-5 border border-pink-500/30 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-pink-400" />
                  <h3 className="font-medium text-white">전문가 조언</h3>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {analysisResult.advice}
                </p>
              </div>
            )}

            {/* Classical References */}
            {analysisResult.classicalRefs?.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-medium text-white">고전 문헌 근거</h3>
                </div>
                <div className="space-y-3">
                  {analysisResult.classicalRefs.slice(0, 5).map((ref, i) => (
                    <div key={i} className="border-l-2 border-indigo-500/50 pl-3">
                      <p className="text-xs text-indigo-400 mb-1">{ref.book_title} - {ref.title}</p>
                      <p className="text-sm text-slate-400">{ref.content?.slice(0, 200)}...</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DB Info */}
            <div className="text-center text-xs text-slate-500">
              <Database className="w-3 h-3 inline mr-1" />
              9종 고전문헌 · 3,238개 청크 · AI 정밀 분석
            </div>
          </>
        )}

        {/* Analysis Failed */}
        {analysisResult && !analysisResult.success && (
          <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/30 text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-medium mb-2">분석 실패</h3>
            <p className="text-slate-400 text-sm mb-4">궁합 분석 중 오류가 발생했습니다.</p>
            <button 
              onClick={handleAnalyze}
              className="px-6 py-3 bg-red-500 text-white rounded-xl font-medium"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Empty State */}
        {(!myProfile || !partnerProfile) && !isAnalyzing && !analysisResult && (
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 text-center">
            <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-white font-medium mb-2">프로필을 선택하세요</h3>
            <p className="text-slate-400 text-sm">
              궁합 분석을 위해 '나'와 '상대' 프로필을 선택해주세요
            </p>
          </div>
        )}
      </div>

      {/* Profile Selector Modal */}
      {showProfileSelector && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setShowProfileSelector(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl z-50 max-h-[70vh] overflow-hidden border-t border-slate-700">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-slate-600 rounded-full" />
            </div>
            <div className="px-6 pb-2">
              <h3 className="text-lg font-bold text-white">
                {showProfileSelector === 'me' ? '나의 프로필 선택' : '상대방 프로필 선택'}
              </h3>
            </div>
            <div className="px-6 pb-8 overflow-y-auto max-h-[50vh]">
              <div className="space-y-2">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => {
                      if (showProfileSelector === 'me') {
                        setMyProfile(profile);
                      } else {
                        setPartnerProfile(profile);
                      }
                      setShowProfileSelector(null);
                      setAnalysisResult(null);
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl">
                      {getZodiacAnimal(profile.birth_year).icon}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white font-medium">{profile.name}</div>
                      <div className="text-slate-400 text-sm">
                        {profile.birth_year}년 {profile.birth_month}월 {profile.birth_day}일
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowProfileSelector(null);
                  navigate('/add');
                }}
                className="w-full mt-4 py-4 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:bg-slate-800/50 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                새 프로필 추가
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
