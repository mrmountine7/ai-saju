import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Crown, 
  BookOpen, 
  Search, 
  Users, 
  BarChart3, 
  FileText,
  Plus,
  User,
  ChevronRight,
  Sparkles,
  Database,
  TrendingUp,
  MessageSquare,
  Shield
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface QuickActionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  badge?: string;
}

function QuickAction({ icon, title, description, onClick, badge }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-xl p-4 text-left transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white">{title}</h3>
            {badge && (
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{description}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-colors" />
      </div>
    </button>
  );
}

export function ExpertModePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recentClients] = useState([
    { id: '1', name: '김철수', lastAnalysis: '2026-01-15', analyses: 3 },
    { id: '2', name: '이영희', lastAnalysis: '2026-01-12', analyses: 2 },
    { id: '3', name: '박지민', lastAnalysis: '2026-01-10', analyses: 5 },
  ]);

  const handleNewAnalysis = () => {
    navigate('/add');
  };

  const handleClassicsSearch = () => {
    navigate('/expert/classics');
  };

  const handleAiQnA = () => {
    navigate('/expert/qna');
  };

  const handleClientManagement = () => {
    navigate('/expert/clients');
  };

  const handleExport = () => {
    alert('내보내기 옵션을 선택하세요. (구현 예정)');
  };

  const handleDataQuality = () => {
    navigate('/expert/quality');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">전문가 모드</h1>
                <Crown className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-sm text-slate-400">
                {user?.email || '전문가'}님 환영합니다
              </p>
            </div>
          </div>
          <button
            onClick={handleNewAnalysis}
            className="bg-purple-500 hover:bg-purple-600 text-white p-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400">고전 청크</span>
            </div>
            <p className="text-xl font-bold text-white">3,238</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">총 고객</span>
            </div>
            <p className="text-xl font-bold text-white">{recentClients.length}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400">이번 달</span>
            </div>
            <p className="text-xl font-bold text-white">12</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            빠른 실행
          </h2>
          <div className="space-y-3">
            <QuickAction
              icon={<BookOpen className="w-5 h-5 text-purple-400" />}
              title="심층 사주 분석"
              description="고전 9종 기반 상세 분석 진행"
              onClick={handleNewAnalysis}
            />
            <QuickAction
              icon={<Search className="w-5 h-5 text-purple-400" />}
              title="고전 원문 검색"
              description="3,238개 청크에서 원문/풀이 검색 및 저장"
              onClick={handleClassicsSearch}
              badge="저장 기능"
            />
            <QuickAction
              icon={<MessageSquare className="w-5 h-5 text-purple-400" />}
              title="AI 명리 Q&A"
              description="AI와 대화하며 명리 질문/답변 저장"
              onClick={handleAiQnA}
              badge="즐겨찾기"
            />
            <QuickAction
              icon={<Users className="w-5 h-5 text-purple-400" />}
              title="손님 관리"
              description="고객 검색, 그룹핑, 상담 이력 관리"
              onClick={handleClientManagement}
              badge="그룹핑"
            />
            <QuickAction
              icon={<FileText className="w-5 h-5 text-purple-400" />}
              title="결과 내보내기"
              description="PDF, Excel, 텍스트 형식 지원"
              onClick={handleExport}
            />
            <QuickAction
              icon={<Shield className="w-5 h-5 text-emerald-400" />}
              title="데이터 품질검증"
              description="87만자 데이터 자동 검증 및 오류 리포트"
              onClick={handleDataQuality}
              badge="AI 검증"
            />
          </div>
        </div>

        {/* Recent Clients */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              최근 상담 고객
            </h2>
            <button
              onClick={handleClientManagement}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              전체 보기
            </button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 divide-y divide-slate-700">
            {recentClients.map((client) => (
              <div
                key={client.id}
                className="p-4 flex items-center justify-between hover:bg-slate-800/80 transition-colors cursor-pointer"
                onClick={() => alert(`${client.name} 고객 정보 보기 (구현 예정)`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{client.name}</h3>
                    <p className="text-sm text-slate-400">
                      마지막 분석: {client.lastAnalysis}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-300">{client.analyses}회</p>
                  <p className="text-xs text-slate-500">분석</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Classic Books Reference */}
        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-2xl p-5 border border-purple-500/30">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            수록 고전 문헌
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {['삼명통회', '적천수', '연해자평', '자평진전', '궁통보감', '명리정종', '신봉통고', '명리탐원', '적천수천미'].map((book) => (
              <div
                key={book}
                className="bg-slate-800/50 rounded-lg py-2 px-3 text-sm text-slate-300"
              >
                {book}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/classics-info')}
            className="w-full mt-4 text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center justify-center gap-1"
          >
            고전 문헌 상세 보기
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExpertModePage;
