import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Users, Sparkles, ChevronRight, Plus, Brain, BookOpen, TrendingUp, AlertCircle, Database, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { analyzeCompatibility, type CompatibilityResponse } from '@/lib/saju-api-client';

interface Profile {
  id: string;
  name: string;
  gender: 'male' | 'female';
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: string;
}

// 시간 문자열을 숫자로 변환
const hourMap: Record<string, number> = {
  '자시': 0, '축시': 2, '인시': 4, '묘시': 6,
  '진시': 8, '사시': 10, '오시': 12, '미시': 14,
  '신시': 16, '유시': 18, '술시': 20, '해시': 22,
};

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

// 궁합 등급별 스타일
const gradeStyles: Record<string, { color: string; bg: string; text: string }> = {
  '천생연분': { color: 'from-pink-500 to-rose-500', bg: 'bg-pink-500/20', text: 'text-pink-400' },
  '최상': { color: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/20', text: 'text-amber-400' },
  '상': { color: 'from-green-500 to-emerald-500', bg: 'bg-green-500/20', text: 'text-green-400' },
  '중상': { color: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  '중': { color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  '중하': { color: 'from-purple-500 to-violet-500', bg: 'bg-purple-500/20', text: 'text-purple-400' },
  '하': { color: 'from-orange-500 to-red-500', bg: 'bg-orange-500/20', text: 'text-orange-400' },
  '주의': { color: 'from-red-500 to-rose-600', bg: 'bg-red-500/20', text: 'text-red-400' },
};

export function CompatibilityPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'result' | 'detail' | 'question'>('result');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState<'me' | 'partner' | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CompatibilityResponse | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [isAskingAi, setIsAskingAi] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, gender, birth_year, birth_month, birth_day, birth_hour, is_primary')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProfiles(data || []);
      
      const primary = data?.find(p => p.is_primary);
      if (primary) setMyProfile(primary);
    } catch (error) {
      console.error('프로필 불러오기 오류:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!myProfile || !partnerProfile) return;
    
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    try {
      const result = await analyzeCompatibility({
        person1: {
          name: myProfile.name,
          gender: myProfile.gender,
          year: myProfile.birth_year,
          month: myProfile.birth_month,
          day: myProfile.birth_day,
          hour: hourMap[myProfile.birth_hour] ?? 12,
        },
        person2: {
          name: partnerProfile.name,
          gender: partnerProfile.gender,
          year: partnerProfile.birth_year,
          month: partnerProfile.birth_month,
          day: partnerProfile.birth_day,
          hour: hourMap[partnerProfile.birth_hour] ?? 12,
        },
      });
      
      setAnalysisResult(result);
    } catch (error) {
      console.error('궁합 분석 오류:', error);
      setAnalysisResult({
        success: false,
        processing_time_ms: 0,
        total_score: 0,
        grade: '',
        categories: [],
        summary: '',
        positive_factors: [],
        caution_factors: [],
        detailed_analysis: '',
        classical_references: [],
        advice: '',
        error: '궁합 분석 중 오류가 발생했습니다.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // AI 질문 처리 (추후 API 연동)
  const handleAskAi = async () => {
    if (!aiQuestion.trim() || !analysisResult) return;
    setIsAskingAi(true);
    
    // 시뮬레이션 (실제로는 API 호출)
    await new Promise(resolve => setTimeout(resolve, 1500));
    setAiAnswer(`두 분의 궁합에 대한 "${aiQuestion}"에 대한 답변입니다.\n\n${analysisResult.summary}\n\n${analysisResult.advice}`);
    setIsAskingAi(false);
  };

  // 분석 결과에서 카테고리 데이터 추출
  const categories = analysisResult?.categories?.length ? analysisResult.categories.map((cat, i) => ({
    name: cat.name,
    score: cat.score,
    color: ['bg-pink-500', 'bg-purple-500', 'bg-green-500', 'bg-blue-500', 'bg-amber-500', 'bg-cyan-500'][i % 6],
    icon: [Heart, Users, TrendingUp, Sparkles, BookOpen, Brain][i % 6],
    description: cat.description,
  })) : [
    { name: '성격 궁합', score: 0, color: 'bg-pink-500', icon: Heart, description: '' },
    { name: '가치관', score: 0, color: 'bg-purple-500', icon: Users, description: '' },
    { name: '재물운', score: 0, color: 'bg-green-500', icon: TrendingUp, description: '' },
    { name: '자녀운', score: 0, color: 'bg-blue-500', icon: Sparkles, description: '' },
  ];

  const compatibilityScore = analysisResult?.total_score || 0;
  const grade = analysisResult?.grade || '';
  const gradeStyle = gradeStyles[grade] || gradeStyles['중'];

  const ProfileCard = ({ profile, label, onClick, color }: { 
    profile: Profile | null; 
    label: string; 
    onClick: () => void;
    color: string;
  }) => (
    <div 
      onClick={onClick}
      className={`flex-1 bg-slate-800/50 rounded-2xl p-4 border border-slate-700 cursor-pointer hover:bg-slate-700/50 transition-all ${
        profile ? '' : 'border-dashed'
      }`}
    >
      {profile ? (
        <div className="text-center">
          <div className={`w-16 h-16 mx-auto rounded-full ${color} flex items-center justify-center text-3xl mb-3 shadow-lg`}>
            {getZodiacAnimal(profile.birth_year).icon}
          </div>
          <div className="text-white font-medium">{profile.name}</div>
          <div className="text-slate-400 text-xs mt-1">
            {profile.birth_year}년생 · {profile.gender === 'male' ? '남' : '여'}
          </div>
          <div className="text-xs text-slate-500 mt-1">{label}</div>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-700 border-2 border-dashed border-slate-600 flex items-center justify-center mb-3">
            <Plus className="w-8 h-8 text-slate-500" />
          </div>
          <div className="text-slate-400 text-sm">{label} 선택</div>
          <div className="text-slate-500 text-xs mt-1">탭하여 선택</div>
        </div>
      )}
    </div>
  );

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
            <p className="text-xs text-slate-400">고전문헌 기반 궁합 해석</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Profile Selection - 운수도원 스타일 */}
        <div className="flex gap-4 mb-6">
          <ProfileCard 
            profile={myProfile} 
            label="나" 
            onClick={() => setShowProfileSelector('me')}
            color="bg-gradient-to-br from-blue-400 to-blue-600"
          />
          
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center">
              <Heart className="w-6 h-6 text-pink-400" />
            </div>
          </div>
          
          <ProfileCard 
            profile={partnerProfile} 
            label="상대" 
            onClick={() => setShowProfileSelector('partner')}
            color="bg-gradient-to-br from-pink-400 to-rose-600"
          />
        </div>

        {/* Analyze Button */}
        {myProfile && partnerProfile && (
          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-medium shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transition-all mb-6 flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isAnalyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                궁합 분석 중...
              </>
            ) : analysisResult ? (
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
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-pink-500/30 rounded-full animate-ping" />
              <div className="absolute inset-2 border-4 border-pink-500/50 rounded-full animate-pulse" />
              <Heart className="absolute inset-0 m-auto w-8 h-8 text-pink-400" />
            </div>
            <p className="text-white font-medium mb-2">궁합 분석 중...</p>
            <p className="text-slate-400 text-sm">고전문헌에서 궁합 정보 검색</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {['삼명통회', '적천수', '궁통보감'].map((book) => (
                <span key={book} className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded-full animate-pulse">
                  {book}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {analysisResult && analysisResult.success && (
          <>
            {/* Score Circle - 운수도원 스타일 */}
            <div className={`bg-gradient-to-br ${gradeStyle.bg} rounded-2xl p-6 border border-pink-500/30 mb-6`}>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="relative w-28 h-28">
                    <svg className="w-28 h-28 -rotate-90">
                      <circle cx="56" cy="56" r="50" className="fill-none stroke-slate-700 stroke-[8]" />
                      <circle 
                        cx="56" cy="56" r="50" 
                        className={`fill-none stroke-[8] ${gradeStyle.text.replace('text-', 'stroke-')}`}
                        strokeDasharray={`${compatibilityScore * 3.14} 314`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-white">{compatibilityScore}</span>
                      <span className={`text-xs ${gradeStyle.text}`}>점</span>
                    </div>
                  </div>
                  <p className={`font-medium mt-2 ${gradeStyle.text}`}>{grade || '분석 완료'}</p>
                </div>
                
                <div className="space-y-3">
                  {categories.map((cat) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <cat.icon className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-400 w-14">{cat.name}</span>
                      <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${cat.color} rounded-full transition-all`}
                          style={{ width: `${cat.score}%` }}
                        />
                      </div>
                      <span className="text-xs text-white w-8">{cat.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 처리 시간 */}
              <div className="flex items-center justify-center gap-2 mt-4 text-slate-500 text-xs">
                <Clock className="w-3 h-3" />
                분석 시간: {(analysisResult.processing_time_ms / 1000).toFixed(1)}초
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              {[
                { id: 'result', label: '궁합 결과' },
                { id: 'detail', label: '상세 분석' },
                { id: 'question', label: 'AI 질문' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
                    activeTab === tab.id 
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 border border-slate-700">
              {activeTab === 'result' && (
                <div className="space-y-4">
                  {/* 종합 궁합 */}
                  <div className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 rounded-xl p-4 border border-pink-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-5 h-5 text-pink-400" />
                      <h3 className="font-medium text-white">종합 궁합</h3>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {analysisResult.summary || '두 분의 궁합 분석 결과입니다.'}
                    </p>
                    {analysisResult.classical_references?.[0] && (
                      <p className="text-xs text-pink-400/80 mt-2">
                        <BookOpen className="w-3 h-3 inline mr-1" />
                        {analysisResult.classical_references[0].book_title}: "{analysisResult.classical_references[0].content.slice(0, 50)}..."
                      </p>
                    )}
                  </div>

                  {/* 긍정적 요소 */}
                  {analysisResult.positive_factors?.length > 0 && (
                    <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <h3 className="font-medium text-white">좋은 궁합 요소</h3>
                      </div>
                      <ul className="space-y-1">
                        {analysisResult.positive_factors.map((factor, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-green-400 mt-1">•</span>
                            {factor}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 주의 요소 */}
                  {analysisResult.caution_factors?.length > 0 && (
                    <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-orange-400" />
                        <h3 className="font-medium text-white">주의할 점</h3>
                      </div>
                      <ul className="space-y-1">
                        {analysisResult.caution_factors.map((factor, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-orange-400 mt-1">•</span>
                            {factor}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 조언 */}
                  {analysisResult.advice && (
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        <h3 className="font-medium text-white">조언</h3>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {analysisResult.advice}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'detail' && (
                <div className="space-y-4">
                  {analysisResult.detailed_analysis ? (
                    <>
                      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="w-5 h-5 text-amber-400" />
                          <h3 className="font-medium text-white">심층 분석</h3>
                        </div>
                        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                          {analysisResult.detailed_analysis}
                        </div>
                      </div>

                      {/* 고전 문헌 참조 */}
                      {analysisResult.classical_references?.length > 0 && (
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
                          <div className="flex items-center gap-2 mb-3">
                            <BookOpen className="w-5 h-5 text-indigo-400" />
                            <h3 className="font-medium text-white">고전 문헌 근거</h3>
                          </div>
                          <div className="space-y-3">
                            {analysisResult.classical_references.slice(0, 3).map((ref, i) => (
                              <div key={i} className="border-l-2 border-indigo-500/50 pl-3">
                                <p className="text-xs text-indigo-400 mb-1">{ref.book_title} - {ref.title}</p>
                                <p className="text-sm text-slate-400">{ref.content.slice(0, 150)}...</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Brain className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">상세 분석 정보가 없습니다</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'question' && (
                <div className="space-y-4">
                  <textarea 
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 min-h-[100px]"
                    placeholder="궁합에 대해 궁금한 점을 물어보세요... 예) 두 사람이 사업을 하면 어떨까요?"
                  />
                  <button 
                    onClick={handleAskAi}
                    disabled={isAskingAi || !aiQuestion.trim()}
                    className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAskingAi ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        답변 생성 중...
                      </>
                    ) : (
                      <>
                        <Brain className="w-5 h-5" />
                        AI 답변 요청
                      </>
                    )}
                  </button>
                  
                  {aiAnswer && (
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-pink-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-5 h-5 text-pink-400" />
                        <span className="font-medium text-white">AI 답변</span>
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-line">{aiAnswer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DB Info Footer */}
            <div className="text-center mt-6 text-xs text-slate-500">
              <Database className="w-3 h-3 inline mr-1" />
              9종 고전문헌 · 3,238개 청크 기반 AI 분석
            </div>
          </>
        )}

        {/* 분석 실패 */}
        {analysisResult && !analysisResult.success && (
          <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/30 text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-medium mb-2">분석 실패</h3>
            <p className="text-slate-400 text-sm mb-4">{analysisResult.error}</p>
            <button 
              onClick={handleAnalyze}
              className="px-6 py-3 bg-red-500 text-white rounded-xl font-medium"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Empty State */}
        {!myProfile || !partnerProfile ? (
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 text-center">
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-white font-medium mb-2">프로필을 선택하세요</h3>
            <p className="text-slate-400 text-sm">
              궁합 분석을 위해 '나'와 '상대' 프로필을 선택해주세요
            </p>
          </div>
        ) : null}
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
                      setAnalysisComplete(false);
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
