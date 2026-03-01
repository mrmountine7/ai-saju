import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AnalysisMode = 'beginner' | 'advanced' | 'expert';

interface AnalysisModeInfo {
  id: AnalysisMode;
  name: string;
  description: string;
  features: string[];
}

export const ANALYSIS_MODES: Record<AnalysisMode, AnalysisModeInfo> = {
  beginner: {
    id: 'beginner',
    name: '일반 모드',
    description: '쉽고 부드러운 표현',
    features: [
      '벡터/그래프DB 기반 분석',
      '쉬운 용어로 풀어쓴 해설',
      '일상 언어 중심 표현',
      '핵심 내용 요약 제공',
    ],
  },
  advanced: {
    id: 'advanced',
    name: '고급 모드',
    description: '명리 전문 용어 사용',
    features: [
      '벡터/그래프DB 전체 검색',
      '명리학 전문 용어 사용',
      '상세 격국/용신 분석',
      '고전 문헌 참조 표시',
    ],
  },
  expert: {
    id: 'expert',
    name: '전문가 모드',
    description: '9대 고전문헌 원문 기반 감정',
    features: [
      '원문/풀이 검색 (저장/즐겨찾기)',
      'AI 질의응답 (저장/즐겨찾기)',
      '손님 관리 (검색/그룹핑)',
      '고전 원문 직접 인용',
    ],
  },
};

interface AnalysisModeContextType {
  mode: AnalysisMode;
  modeInfo: AnalysisModeInfo;
  setMode: (mode: AnalysisMode) => void;
  isExpertMode: boolean;
  isAdvancedOrAbove: boolean;
}

const AnalysisModeContext = createContext<AnalysisModeContextType | null>(null);

const STORAGE_KEY = 'analysis_mode';

export function AnalysisModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AnalysisMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'beginner' || saved === 'advanced' || saved === 'expert')) {
        return saved as AnalysisMode;
      }
    }
    return 'beginner';
  });

  const setMode = (newMode: AnalysisMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === 'beginner' || saved === 'advanced' || saved === 'expert')) {
      setModeState(saved as AnalysisMode);
    }
  }, []);

  const value: AnalysisModeContextType = {
    mode,
    modeInfo: ANALYSIS_MODES[mode],
    setMode,
    isExpertMode: mode === 'expert',
    isAdvancedOrAbove: mode === 'advanced' || mode === 'expert',
  };

  return (
    <AnalysisModeContext.Provider value={value}>
      {children}
    </AnalysisModeContext.Provider>
  );
}

export function useAnalysisMode() {
  const context = useContext(AnalysisModeContext);
  if (!context) {
    throw new Error('useAnalysisMode must be used within AnalysisModeProvider');
  }
  return context;
}

export function getModeApiParam(mode: AnalysisMode): string {
  switch (mode) {
    case 'beginner':
      return 'easy';
    case 'advanced':
      return 'detailed';
    case 'expert':
      return 'expert';
    default:
      return 'easy';
  }
}
