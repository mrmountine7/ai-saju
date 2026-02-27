import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  FileText,
  Database,
  BookOpen,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  Search,
  Layers,
  GitCompare,
  Brain,
  Clock,
  BarChart3
} from 'lucide-react';

// 타입 정의
interface ValidationSummary {
  total_issues: number;
  by_severity: {
    critical: number;
    warning: number;
    info: number;
  };
  by_type: Record<string, number>;
  by_book?: Record<string, number>;
}

interface ValidationIssue {
  chunk_id: string;
  chunk_uid: string;
  book_title: string;
  issue_type: string;
  severity: string;
  message: string;
  details?: Record<string, any>;
  suggestion?: string;
  llm_analysis?: string;
}

interface ValidationReport {
  timestamp: string;
  total_chunks?: number;
  total_checked?: number;
  patterns_checked?: number;
  issue_count: number;
  summary: ValidationSummary;
  issues: ValidationIssue[];
}

interface IntegratedReport {
  timestamp: string;
  validation_modules: {
    structural: {
      total_chunks: number;
      issues_found: number;
      critical: number;
      warning: number;
    };
    logical: {
      total_checked: number;
      issues_found: number;
      critical: number;
      warning: number;
    };
    cross_validation: {
      patterns_checked: number;
      issues_found: number;
      critical: number;
      warning: number;
    };
  };
  total_summary: {
    total_issues: number;
    total_critical: number;
    total_warning: number;
  };
  recommendations: Array<{
    priority: string;
    action: string;
    count?: number;
    details: string;
  }>;
}

// 샘플 데이터 (실제로는 API에서 가져옴)
const SAMPLE_REPORT: IntegratedReport = {
  timestamp: new Date().toISOString(),
  validation_modules: {
    structural: {
      total_chunks: 3238,
      issues_found: 47,
      critical: 3,
      warning: 28,
    },
    logical: {
      total_checked: 100,
      issues_found: 12,
      critical: 0,
      warning: 8,
    },
    cross_validation: {
      patterns_checked: 11,
      issues_found: 5,
      critical: 0,
      warning: 2,
    }
  },
  total_summary: {
    total_issues: 64,
    total_critical: 3,
    total_warning: 38,
  },
  recommendations: [
    {
      priority: "high",
      action: "심각한 이슈 즉시 수정",
      count: 3,
      details: "빈 콘텐츠, 비정상 문자 등 즉시 수정 필요"
    },
    {
      priority: "medium",
      action: "중복 청크 정리",
      details: "중복 콘텐츠를 제거하여 검색 품질 향상"
    }
  ]
};

const SAMPLE_ISSUES: ValidationIssue[] = [
  {
    chunk_id: "1234",
    chunk_uid: "적천수_4_15",
    book_title: "적천수",
    issue_type: "broken_markup",
    severity: "warning",
    message: "깨진 마크업: 닫는 괄호만 있음",
    details: { pattern: r'}}+', match_count: 3 },
    suggestion: "마크업 제거 또는 수정 필요"
  },
  {
    chunk_id: "1235",
    chunk_uid: "자평진전_4_22",
    book_title: "자평진전",
    issue_type: "empty_content",
    severity: "critical",
    message: "콘텐츠가 비어있습니다",
    suggestion: "해당 청크 삭제 또는 원본에서 재수집"
  },
  {
    chunk_id: "1236",
    chunk_uid: "궁통보감_4_8",
    book_title: "궁통보감",
    issue_type: "duplicate",
    severity: "warning",
    message: "중복 콘텐츠 발견",
    details: { original_chunk_uid: "궁통보감_4_7" },
    suggestion: "중복 청크 삭제 검토"
  }
];

export default function DataQualityDashboard() {
  const navigate = useNavigate();
  const [report, setReport] = useState<IntegratedReport | null>(SAMPLE_REPORT);
  const [issues, setIssues] = useState<ValidationIssue[]>(SAMPLE_ISSUES);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const filteredIssues = issues.filter(issue => {
    if (selectedSeverity !== 'all' && issue.severity !== selectedSeverity) return false;
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'warning': return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      case 'info': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <Info className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getIssueTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'empty_content': '빈 콘텐츠',
      'duplicate': '중복',
      'broken_markup': '깨진 마크업',
      'invalid_chars': '비정상 문자',
      'hierarchy': '계층 구조',
      'sequence': '시퀀스',
      'term_error': '용어 오류',
      'logic_error': '논리 오류',
      'context_break': '문맥 단절',
      'contradiction': '모순',
      'terminology_diff': '용어 차이',
      'interpretation_diff': '해석 차이',
      'missing_coverage': '커버리지 누락'
    };
    return labels[type] || type;
  };

  const handleRunValidation = async () => {
    setIsRunning(true);
    // 실제로는 백엔드 API 호출
    setTimeout(() => {
      setIsRunning(false);
      alert('품질검증이 완료되었습니다. (시뮬레이션)');
    }, 3000);
  };

  const handleDownloadReport = () => {
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileName = `quality_report_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">리포트 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* 헤더 */}
      <div className="bg-slate-800/50 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">데이터 품질검증</h1>
                  <p className="text-xs text-slate-400">9종 87만자 고전문헌 데이터</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">리포트 다운로드</span>
              </button>
              <button
                onClick={handleRunValidation}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg text-white font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">검증 중...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span className="text-sm">검증 실행</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* 전체 이슈 */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">총 이슈</span>
              <BarChart3 className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-3xl font-bold text-white">{report.total_summary.total_issues}</div>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="text-red-400">🔴 {report.total_summary.total_critical}</span>
              <span className="text-amber-400">🟡 {report.total_summary.total_warning}</span>
            </div>
          </div>

          {/* 구조적 검증 */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">구조적 검증</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-3xl font-bold text-white">{report.validation_modules.structural.issues_found}</div>
            <div className="text-xs text-slate-500 mt-2">
              {report.validation_modules.structural.total_chunks.toLocaleString()} 청크 검사
            </div>
          </div>

          {/* 논리적 검증 */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">논리적 검증</span>
              <Brain className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-3xl font-bold text-white">{report.validation_modules.logical.issues_found}</div>
            <div className="text-xs text-slate-500 mt-2">
              {report.validation_modules.logical.total_checked.toLocaleString()} 샘플 검사
            </div>
          </div>

          {/* 교차 검증 */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">교차 검증</span>
              <GitCompare className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-3xl font-bold text-white">{report.validation_modules.cross_validation.issues_found}</div>
            <div className="text-xs text-slate-500 mt-2">
              {report.validation_modules.cross_validation.patterns_checked} 개념 비교
            </div>
          </div>
        </div>

        {/* 권장 조치 */}
        {report.recommendations.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              권장 조치
            </h2>
            <div className="space-y-3">
              {report.recommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    rec.priority === 'high' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : rec.priority === 'medium'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      rec.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {rec.priority.toUpperCase()}
                    </span>
                    <span className="text-white font-medium">{rec.action}</span>
                    {rec.count && (
                      <span className="text-slate-400 text-sm">({rec.count}건)</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{rec.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 이슈 목록 */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                이슈 목록
              </h2>
              
              {/* 필터 */}
              <div className="flex items-center gap-3">
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                >
                  <option value="all">모든 심각도</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-700/50">
            {filteredIssues.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-300">선택한 조건에 해당하는 이슈가 없습니다.</p>
              </div>
            ) : (
              filteredIssues.map((issue, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-700/20 transition-colors">
                  <div 
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpandedIssue(expandedIssue === issue.chunk_uid ? null : issue.chunk_uid)}
                  >
                    <div className={`p-1.5 rounded ${getSeverityColor(issue.severity)}`}>
                      {getSeverityIcon(issue.severity)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">{issue.message}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(issue.severity)} border`}>
                          {issue.severity}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {issue.book_title}
                        </span>
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          {issue.chunk_uid}
                        </span>
                        <span className="bg-slate-700 px-2 py-0.5 rounded">
                          {getIssueTypeLabel(issue.issue_type)}
                        </span>
                      </div>
                    </div>
                    
                    <button className="p-1 text-slate-400 hover:text-white">
                      {expandedIssue === issue.chunk_uid ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  
                  {/* 확장 상세 */}
                  {expandedIssue === issue.chunk_uid && (
                    <div className="mt-4 ml-10 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                      {issue.details && Object.keys(issue.details).length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-slate-300 mb-2">상세 정보</h4>
                          <pre className="text-xs text-slate-400 bg-slate-800 p-2 rounded overflow-x-auto">
                            {JSON.stringify(issue.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {issue.suggestion && (
                        <div className="mt-3 p-3 bg-emerald-500/10 rounded border border-emerald-500/30">
                          <h4 className="text-sm font-medium text-emerald-400 mb-1">수정 제안</h4>
                          <p className="text-sm text-slate-300">{issue.suggestion}</p>
                        </div>
                      )}
                      
                      {issue.llm_analysis && (
                        <div className="mt-3 p-3 bg-purple-500/10 rounded border border-purple-500/30">
                          <h4 className="text-sm font-medium text-purple-400 mb-1">AI 분석</h4>
                          <p className="text-sm text-slate-300">{issue.llm_analysis}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 마지막 검증 시간 */}
        <div className="mt-4 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" />
          마지막 검증: {new Date(report.timestamp).toLocaleString('ko-KR')}
        </div>
      </div>
    </div>
  );
}
