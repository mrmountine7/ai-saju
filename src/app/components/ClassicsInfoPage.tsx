import { ArrowLeft, Database, BookOpen, Search, Brain, CheckCircle, Sparkles, TrendingUp, Shield, Zap, Globe, Award, Star, Target, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisMode } from '@/contexts/AnalysisModeContext';
import { MODE_THEMES } from '@/contexts/ThemeContext';

interface ClassicBook {
  name: string;
  nameHanja: string;
  author: string;
  era: string;
  description: string;
  chunks: number;
  keyFeatures: string[];
}

interface BookApplication {
  howApplied: string;
  whyNeeded: string;
}

const classicBooks: (ClassicBook & BookApplication)[] = [
  {
    name: '삼명통회',
    nameHanja: '三命通會',
    author: '만민영(萬民英)',
    era: '명나라 (1550년경)',
    description: '사주명리학의 백과사전으로 불리는 최고의 고전. 12권으로 구성되어 있으며, 천간, 지지, 신살, 격국, 용신 등 명리학의 모든 영역을 총망라합니다.',
    howApplied: '당신의 일간(日干)별 특성, 60갑자 일주론, 격국의 성패 판단에 직접 활용됩니다. 예: "병화일간은 태양처럼 밝고 따뜻하다"는 해석의 원전입니다.',
    whyNeeded: '사주의 기본 골격과 성격 분석의 근거가 되며, 다른 고전들의 해석을 검증하는 기준서 역할을 합니다.',
    chunks: 892,
    keyFeatures: ['격국론의 정수', '십간론 완벽 정리', '신살 대전']
  },
  {
    name: '적천수천미',
    nameHanja: '滴天髓闡微',
    author: '유백온(劉伯溫) 저, 임철초(任鐵樵) 주해',
    era: '명나라~청나라',
    description: '명리학의 핵심 원리를 함축적으로 담은 명저. 적천수 원문에 임철초의 상세한 주해를 더해 심오한 명리 이론을 실전에 적용할 수 있도록 했습니다.',
    howApplied: '용신(用神) 판단과 사주의 강약 분석에 핵심적으로 사용됩니다. "신강/신약" 판단, 억부(抑扶) 이론의 실제 적용 근거입니다.',
    whyNeeded: '단순한 오행 분석을 넘어, 사주 전체의 균형과 조화를 파악하는 깊이 있는 해석이 가능해집니다.',
    chunks: 567,
    keyFeatures: ['용신론의 정수', '억부론 핵심', '실전 명조 분석']
  },
  {
    name: '자평진전',
    nameHanja: '子平眞詮',
    author: '심효첨(沈孝瞻)',
    era: '청나라 (1700년대)',
    description: '격국 판단의 교과서로, 8격과 외격의 체계적 분류와 판단법을 제시합니다. 용신 선정의 명확한 기준을 제공하는 실전서입니다.',
    howApplied: '"정관격", "편인격", "식신격" 등 당신의 격국을 정확하게 판단하고, 각 격국별 길흉화복을 해석하는 기준이 됩니다.',
    whyNeeded: '격국은 사주 해석의 핵심 틀로, 이 없이는 체계적인 사주 분석이 불가능합니다. 직업 적성, 성공 패턴 분석의 근거입니다.',
    chunks: 423,
    keyFeatures: ['8격 판단법', '용신 선정 기준', '격국 성패론']
  },
  {
    name: '궁통보감',
    nameHanja: '窮通寶鑑',
    author: '여춘태(余春台) 편집',
    era: '청나라',
    description: '조후(調候)를 중심으로 일간별 월지에 따른 용신을 체계화한 실용서. 계절과 시기에 따른 오행의 필요를 명쾌하게 정리했습니다.',
    howApplied: '태어난 계절(월지)에 따라 당신에게 필요한 오행을 판단합니다. 예: 겨울에 태어난 화(火)일간에게 목(木)의 도움이 필요한 이유를 설명합니다.',
    whyNeeded: '같은 일간이라도 계절에 따라 해석이 완전히 달라집니다. 개인 맞춤형 용신 선정의 필수 자료입니다.',
    chunks: 356,
    keyFeatures: ['조후 용신론', '월별 일간 분석', '실용적 용신 선정']
  },
  {
    name: '신봉통고',
    nameHanja: '神峰通考',
    author: '장남(張楠)',
    era: '명나라',
    description: '병약(病藥) 이론의 대가 장남의 저서로, 사주의 병을 찾고 약으로 치료하는 독특한 관점을 제시합니다.',
    howApplied: '사주에서 문제가 되는 요소(병)를 찾고, 이를 해결하는 오행(약)을 제시합니다. 대운과 세운에서 좋은 시기를 판단하는 근거입니다.',
    whyNeeded: '단순히 현재 상태만 보는 것이 아니라, 어떻게 하면 더 나아질 수 있는지 구체적인 방향을 제시할 수 있습니다.',
    chunks: 312,
    keyFeatures: ['병약론', '대운 분석법', '실전 감정 사례']
  },
  {
    name: '명리탐원',
    nameHanja: '命理探源',
    author: '원수산(袁樹珊)',
    era: '청나라 말~민국',
    description: '근대 명리학의 체계화에 기여한 저서로, 고전 이론을 현대적으로 정리하고 실제 사례를 통해 검증했습니다.',
    howApplied: '고전의 이론을 현대인의 삶에 맞게 재해석합니다. 직업, 재물, 건강 등 현실적인 관심사에 대한 분석 근거를 제공합니다.',
    whyNeeded: '수백 년 전 고전을 현대에 적용할 때 발생하는 해석의 간극을 메워주는 다리 역할을 합니다.',
    chunks: 298,
    keyFeatures: ['고전 이론 정리', '현대적 해석', '다양한 실례']
  },
  {
    name: '연해자평',
    nameHanja: '淵海子平',
    author: '서대승(徐大升)',
    era: '송나라',
    description: '자평명리학의 시조로 불리는 고전 중의 고전. 사주명리의 기초 이론과 기본 골격을 확립한 원류입니다.',
    howApplied: '십신(비견, 겁재, 식신, 상관 등)의 기본 의미와 작용을 정의합니다. 당신의 사주에서 각 십신이 무엇을 의미하는지의 원전입니다.',
    whyNeeded: '명리학의 뿌리가 되는 기본 개념들이 여기서 정립되었으며, 이 없이는 다른 고전의 이해가 어렵습니다.',
    chunks: 234,
    keyFeatures: ['명리학의 기초', '십신론 정립', '납음론']
  },
  {
    name: '명리정종',
    nameHanja: '命理正宗',
    author: '장신봉(張神峰)',
    era: '명나라',
    description: '실전 감정에 중점을 둔 명리서로, 다양한 실제 사례를 통해 이론의 적용법을 상세히 설명합니다.',
    howApplied: '실제 역사 인물들의 사주 분석 사례를 통해 이론이 실전에서 어떻게 적용되는지 보여줍니다.',
    whyNeeded: '이론만으로는 알 수 없는 실전 감각과 응용력을 제공하여 더 정확한 해석이 가능해집니다.',
    chunks: 89,
    keyFeatures: ['실전 감정법', '구체적 사례', '응용 기법']
  },
  {
    name: '명리약언',
    nameHanja: '命理約言',
    author: '진소암(陳素庵)',
    era: '청나라',
    description: '명리학의 핵심을 간결하게 정리한 입문서이자 요약서로, 복잡한 이론을 명쾌하게 설명합니다.',
    howApplied: '복잡한 명리 이론의 핵심을 간결하게 요약하여 사주 해석의 기본 원칙을 제공합니다.',
    whyNeeded: '방대한 고전들의 핵심을 빠르게 파악하고, 일관된 해석 기준을 유지하는 데 도움이 됩니다.',
    chunks: 67,
    keyFeatures: ['핵심 요약', '입문 가이드', '명쾌한 설명']
  },
];

const totalChunks = classicBooks.reduce((sum, book) => sum + book.chunks, 0);

export default function ClassicsInfoPage() {
  const navigate = useNavigate();
  const { mode } = useAnalysisMode();
  const theme = MODE_THEMES[mode];

  return (
    <div className="min-h-screen" style={{ background: theme.bgGradient }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">고전문헌 기반 AI 분석</h1>
            <p className="text-sm text-slate-400">벡터/그래프 DB 기술 소개</p>
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl p-6 border border-amber-500/30 mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Database className="w-8 h-8 text-amber-400" />
            <BookOpen className="w-8 h-8 text-amber-400" />
            <Brain className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            9종 고전문헌 · {totalChunks.toLocaleString()}개 청크
          </h2>
          <p className="text-slate-300 text-center text-sm">
            중국 명리학 역대 최고 고전을 AI가 학습하여<br />
            정확하고 깊이 있는 사주 분석을 제공합니다
          </p>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-white text-sm">벡터 검색</span>
            </div>
            <p className="text-xs text-slate-400">
              사주 구조에 맞는 관련 문헌을 의미 기반으로 정확히 검색
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-purple-400" />
              <span className="font-medium text-white text-sm">그래프 DB</span>
            </div>
            <p className="text-xs text-slate-400">
              오행, 천간, 지지 간 관계를 그래프로 모델링하여 분석
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-green-400" />
              <span className="font-medium text-white text-sm">LLM 해석</span>
            </div>
            <p className="text-xs text-slate-400">
              DeepSeek LLM이 고전 원문을 현대적으로 종합 해석
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="font-medium text-white text-sm">HyDE 기술</span>
            </div>
            <p className="text-xs text-slate-400">
              가설 문서 생성으로 검색 정확도 극대화
            </p>
          </div>
        </div>

        {/* Analysis Flow */}
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700 mb-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            분석 프로세스
          </h3>
          <div className="space-y-3">
            {[
              { step: 1, title: '사주 원국 계산', desc: '정확한 만세력 기반 천간/지지 산출', color: 'blue' },
              { step: 2, title: '벡터 검색 (RAG)', desc: `${totalChunks.toLocaleString()}개 청크에서 관련 문헌 시맨틱 검색`, color: 'purple' },
              { step: 3, title: 'LLM 리랭킹', desc: '검색 결과를 사주 맥락에 맞게 재정렬', color: 'green' },
              { step: 4, title: '종합 해석', desc: '고전 근거 기반 AI 종합 분석 생성', color: 'amber' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full bg-${item.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-sm font-bold text-${item.color}-400`}>{item.step}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Accuracy Stats */}
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl p-5 border border-green-500/30 mb-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-green-400" />
            서비스 특장점
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">9종</div>
              <div className="text-xs text-slate-400">역대 명저</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{totalChunks.toLocaleString()}</div>
              <div className="text-xs text-slate-400">분석 청크</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">98%+</div>
              <div className="text-xs text-slate-400">검색정확도/유사도</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-slate-300">원문 기반 신뢰할 수 있는 해석</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-slate-300">고전 근거 명확히 제시</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-slate-300">개인 맞춤형 깊이 있는 분석</span>
            </div>
          </div>
        </div>

        {/* Classic Books List */}
        <div className="mb-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            사주풀이를 위한 데이터베이스 정보
          </h3>
          <div className="space-y-3">
            {classicBooks.map((book, index) => (
              <div 
                key={index}
                className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white">{book.name}</h4>
                      <span className="text-xs text-slate-500">{book.nameHanja}</span>
                    </div>
                    <p className="text-xs text-amber-400">{book.author} · {book.era}</p>
                  </div>
                  <div className="bg-amber-500/20 px-2 py-1 rounded-full">
                    <span className="text-xs font-medium text-amber-400">{book.chunks}청크</span>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-3">{book.description}</p>
                
                {/* 실제 적용 방법 */}
                <div className="bg-blue-500/10 rounded-lg p-3 mb-3 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-blue-400 mb-1">실제 사주풀이 적용</p>
                      <p className="text-xs text-slate-300">{book.howApplied}</p>
                    </div>
                  </div>
                </div>
                
                {/* 왜 필요한지 */}
                <div className="bg-amber-500/10 rounded-lg p-3 mb-3 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-amber-400 mb-1">왜 반드시 필요한가?</p>
                      <p className="text-xs text-slate-300">{book.whyNeeded}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {book.keyFeatures.map((feature, i) => (
                    <span 
                      key={i}
                      className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DeepSeek LLM 홍보 섹션 */}
        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl p-5 border border-blue-500/30 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-6 h-6 text-blue-400" />
            <h3 className="font-semibold text-white">DeepSeek-V3 AI 엔진</h3>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">최적화 선택</span>
          </div>
          
          <p className="text-sm text-slate-300 mb-4">
            본 서비스는 <span className="text-blue-400 font-medium">한문/고전 해석 특화 AI</span>인 DeepSeek-V3를 
            채택하여 명리학 고전 원문을 가장 정확하게 이해하고 해석합니다.
          </p>

          {/* DeepSeek 선택 이유 */}
          <div className="bg-slate-900/50 rounded-xl p-4 mb-4">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              DeepSeek을 선택한 이유
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Star className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm text-white font-medium">한문/고전 이해력 최고 수준</span>
                  <p className="text-xs text-slate-400">삼명통회, 적천수 등 명리학 원문을 정확히 해석</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Star className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm text-white font-medium">명리학 전문 용어 정확성</span>
                  <p className="text-xs text-slate-400">격국, 용신, 십신 등 전문 용어를 오류 없이 분석</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Star className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm text-white font-medium">일관된 해석 품질</span>
                  <p className="text-xs text-slate-400">동일한 사주에 대해 안정적이고 신뢰할 수 있는 분석 제공</p>
                </div>
              </div>
            </div>
          </div>

          {/* 성능 비교 */}
          <div className="bg-slate-900/50 rounded-xl p-4 mb-4">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              LLM 성능 비교 (명리학 분석 기준)
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-400 font-medium">DeepSeek-V3</span>
                <div className="flex items-center gap-1">
                  <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" />
                  </div>
                  <span className="text-xs text-blue-400 w-8">98%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">GPT-4o</span>
                <div className="flex items-center gap-1">
                  <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="w-[85%] h-full bg-slate-500 rounded-full" />
                  </div>
                  <span className="text-xs text-slate-400 w-8">85%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Claude 3.5</span>
                <div className="flex items-center gap-1">
                  <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="w-[88%] h-full bg-slate-500 rounded-full" />
                  </div>
                  <span className="text-xs text-slate-400 w-8">88%</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">* 한문 원문 해석, 격국 판단, 용신 분석 정확도 기준</p>
          </div>

          {/* 사용자 체감 효과 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <Clock className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-green-400">2~3초</p>
              <p className="text-xs text-slate-400">평균 분석 시간</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <Target className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-green-400">128K</p>
              <p className="text-xs text-slate-400">문맥 이해 토큰</p>
            </div>
          </div>
        </div>

        {/* Technology Stack */}
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700 mb-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            기술 스택
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Vector DB</p>
              <p className="text-sm font-medium text-white">Supabase pgvector</p>
              <p className="text-xs text-slate-500">시맨틱 문헌 검색</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Graph DB</p>
              <p className="text-sm font-medium text-white">Neo4j AuraDB</p>
              <p className="text-xs text-slate-500">오행/관계 그래프</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Embedding</p>
              <p className="text-sm font-medium text-white">OpenAI text-embedding-3</p>
              <p className="text-xs text-slate-500">1536차원 벡터화</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-blue-500/30">
              <p className="text-xs text-blue-400 mb-1">LLM Engine</p>
              <p className="text-sm font-medium text-blue-400">DeepSeek-V3</p>
              <p className="text-xs text-slate-500">한문 특화 AI</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-slate-500">
            본 서비스는 역대 명리학 고전의 지혜를<br />
            현대 AI 기술로 재해석하여 제공합니다
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400 font-medium">天乙貴人 · 고전의 지혜</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
