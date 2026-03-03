import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, FileText, Download, Trash2, User, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { getDeviceId } from '@/lib/device-id';
import { useAnalysisMode } from '@/contexts/AnalysisModeContext';
import { MODE_THEMES } from '@/contexts/ThemeContext';

interface SajuHistoryItem {
  id: string;
  created_at: string;
  updated_at?: string;
  name: string;
  birth_date: string;
  birth_time?: string;
  gender: string;
  is_lunar?: boolean;
  pillars: {
    year: { gan: string; zhi: string };
    month: { gan: string; zhi: string };
    day: { gan: string; zhi: string };
    hour: { gan: string; zhi: string };
  };
  day_master: { gan: string; element: string };
  geju: { name: string; description?: string };
  yongshen: { primary: string; secondary: string; reason?: string };
  synthesis?: string;
  easy_explanation?: string;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { mode } = useAnalysisMode();
  const theme = MODE_THEMES[mode];
  const [history, setHistory] = useState<SajuHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [user, isAdmin]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const deviceId = getDeviceId();
      
      let query = supabase
        .from('saju_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      // 관리자는 모든 분석 이력 조회 가능
      if (isAdmin) {
        // 관리자: 필터 없이 모든 이력 조회
        console.log('[Admin] 모든 분석 이력 조회');
      } else if (user) {
        // 일반 회원: 회원 ID 또는 기기 ID로 조회
        query = query.or(`user_id.eq.${user.id},device_id.eq.${deviceId}`);
      } else {
        // 비회원: 기기 ID로만 조회
        query = query.eq('device_id', deviceId);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        throw fetchError;
      }
      
      setHistory((data || []) as SajuHistoryItem[]);
    } catch (err) {
      setError('분석 이력을 불러오는 데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAnalysisStatus = (item: SajuHistoryItem) => {
    if (item.synthesis) {
      return { label: '상세 분석', color: 'bg-amber-500/20 text-amber-400' };
    }
    return { label: '기본 분석', color: 'bg-slate-500/20 text-slate-400' };
  };

  const handleViewResult = (item: SajuHistoryItem) => {
    // 저장된 결과를 세션 스토리지에 임시 저장 후 결과 페이지로 이동
    const resultData = {
      profileId: `history_${item.id}`,
      profile: {
        id: `history_${item.id}`,
        name: item.name,
        birthDate: item.birth_date,
        birthTime: item.birth_time || '',
        gender: item.gender,
        isLunar: item.is_lunar || false,
      },
      result: {
        success: true,
        processing_time_ms: 0,
        pillars: item.pillars,
        day_master: item.day_master,
        geju: item.geju,
        yongshen: item.yongshen,
        wuxing_balance: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
        synthesis: item.synthesis || '',
        easy_explanation: item.easy_explanation || '',
        classical_references: [],
      },
      pillars: [],
      timestamp: Date.now(),
    };
    sessionStorage.setItem('saju_analysis_cache', JSON.stringify(resultData));
    navigate(`/result?id=history_${item.id}`);
  };

  const handleDelete = async (item: SajuHistoryItem) => {
    if (!confirm(`${item.name}님의 분석 결과를 삭제하시겠습니까?`)) return;
    
    try {
      const { error } = await supabase
        .from('saju_results')
        .delete()
        .eq('id', item.id);
      
      if (error) throw error;
      
      setHistory(prev => prev.filter(h => h.id !== item.id));
    } catch (err) {
      console.error('삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bgGradient }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">분석 이력을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: theme.bgGradient }}>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">분석 이력</h1>
          {isAdmin && (
            <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
              관리자
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {history.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">아직 분석 이력이 없습니다</p>
            <p className="text-slate-500 text-sm mb-6">
              사주 분석을 시작하고 결과를 저장해보세요
            </p>
            <button
              onClick={() => navigate('/storage')}
              className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-6 rounded-xl transition-colors"
            >
              사주 분석 시작하기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => {
              const statusInfo = getAnalysisStatus(item);
              return (
                <div
                  key={item.id}
                  className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">
                          {item.name || '이름 없음'}
                        </h3>
                        <p className="text-sm text-slate-400">
                          {item.birth_date} {item.birth_time && `/ ${item.birth_time}`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* 사주 요약 정보 */}
                  <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-slate-400">일간:</span>
                        <span className="text-white font-medium">{item.day_master?.gan || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">격국:</span>
                        <span className="text-white font-medium">{item.geju?.name || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">용신:</span>
                        <span className="text-amber-400 font-medium">{item.yongshen?.primary || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatTime(item.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewResult(item)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      결과 보기
                    </button>
                    {item.synthesis && (
                      <button className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" />
                        PDF
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(item)}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
