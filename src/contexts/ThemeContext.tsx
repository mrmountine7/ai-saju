import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAnalysisMode, type AnalysisMode } from './AnalysisModeContext';

// 모드별 테마 정의
export interface ModeTheme {
  id: AnalysisMode;
  name: string;
  description: string;
  // 메인 컬러
  primary: string;
  primaryGlow: string;
  // 배경
  bgGradient: string;
  bgDark: string;
  // 텍스트
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // 버튼/액센트
  buttonBg: string;
  buttonHover: string;
  buttonText: string;
  // 카드
  cardBg: string;
  cardBorder: string;
  cardBorderWidth: string;
  cardText: string;
  cardTextMuted: string;
  // 폰트
  fontFamily: string;
}

export const MODE_THEMES: Record<AnalysisMode, ModeTheme> = {
  beginner: {
    id: 'beginner',
    name: '일반인 모드',
    description: '누구나 쉽게 이해하는 사주풀이',
    // 로즈 골드 계열 (원본 디자인)
    primary: '#BC8F8F',
    primaryGlow: 'rgba(188, 143, 143, 0.7)',
    bgGradient: 'linear-gradient(to bottom, #000000, #1a0a0a)',
    bgDark: '#0a0505',
    textPrimary: '#BC8F8F',
    textSecondary: '#d4b8b8',
    textMuted: '#8b7070',
    buttonBg: '#BC8F8F',
    buttonHover: '#d4a5a5',
    buttonText: '#1a0a0a',
    cardBg: 'rgba(188, 143, 143, 0.1)',
    cardBorder: 'rgba(188, 143, 143, 0.3)',
    cardBorderWidth: '1px',
    cardText: '#d4b8b8',
    cardTextMuted: '#8b7070',
    fontFamily: "'Klee One', serif",
  },
  advanced: {
    id: 'advanced',
    name: '고급자 모드',
    description: '심화된 명리학 이론과 해석',
    // 퍼플 계열 (신비롭고 깊이있는 느낌)
    primary: '#9370DB',
    primaryGlow: 'rgba(147, 112, 219, 0.7)',
    bgGradient: 'linear-gradient(to bottom, #000000, #0a0a1a)',
    bgDark: '#05050a',
    textPrimary: '#9370DB',
    textSecondary: '#b8a5d4',
    textMuted: '#706088',
    buttonBg: '#9370DB',
    buttonHover: '#a580eb',
    buttonText: '#0a0a1a',
    cardBg: 'rgba(147, 112, 219, 0.1)',
    cardBorder: 'rgba(147, 112, 219, 0.3)',
    cardBorderWidth: '1px',
    cardText: '#b8a5d4',
    cardTextMuted: '#706088',
    fontFamily: "'Klee One', serif",
  },
  expert: {
    id: 'expert',
    name: '전문가 모드',
    description: '9대 고전문헌 원문 기반 감정',
    // 골드 계열 (고급스럽고 권위있는 느낌)
    primary: '#D4AF37',
    primaryGlow: 'rgba(212, 175, 55, 0.8)',
    bgGradient: 'linear-gradient(to bottom, #000000, #1a1a0a)',
    bgDark: '#0a0a05',
    textPrimary: '#D4AF37',
    textSecondary: '#e8d48a',
    textMuted: '#8b8040',
    buttonBg: '#D4AF37',
    buttonHover: '#e8c347',
    buttonText: '#1a1a0a',
    cardBg: 'rgba(212, 175, 55, 0.1)',
    cardBorder: 'rgba(212, 175, 55, 0.3)',
    cardBorderWidth: '1px',
    cardText: '#e8d48a',
    cardTextMuted: '#8b8040',
    fontFamily: "'Klee One', serif",
  },
};

interface ThemeContextType {
  theme: ModeTheme;
  setThemeByMode: (mode: AnalysisMode) => void;
  getCSSVariables: () => Record<string, string>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { mode } = useAnalysisMode();
  const [theme, setTheme] = useState<ModeTheme>(MODE_THEMES[mode]);

  // 모드 변경 시 테마 자동 업데이트
  useEffect(() => {
    setTheme(MODE_THEMES[mode]);
    
    // CSS 변수 업데이트
    const root = document.documentElement;
    const newTheme = MODE_THEMES[mode];
    
    root.style.setProperty('--theme-primary', newTheme.primary);
    root.style.setProperty('--theme-primary-glow', newTheme.primaryGlow);
    root.style.setProperty('--theme-bg-gradient', newTheme.bgGradient);
    root.style.setProperty('--theme-bg-dark', newTheme.bgDark);
    root.style.setProperty('--theme-text-primary', newTheme.textPrimary);
    root.style.setProperty('--theme-text-secondary', newTheme.textSecondary);
    root.style.setProperty('--theme-text-muted', newTheme.textMuted);
    root.style.setProperty('--theme-button-bg', newTheme.buttonBg);
    root.style.setProperty('--theme-button-hover', newTheme.buttonHover);
    root.style.setProperty('--theme-button-text', newTheme.buttonText);
    root.style.setProperty('--theme-card-bg', newTheme.cardBg);
    root.style.setProperty('--theme-card-border', newTheme.cardBorder);
    root.style.setProperty('--theme-font-family', newTheme.fontFamily);
    
    console.log('[Theme] 모드 변경:', mode, newTheme.name);
  }, [mode]);

  const setThemeByMode = (mode: AnalysisMode) => {
    setTheme(MODE_THEMES[mode]);
  };

  const getCSSVariables = (): Record<string, string> => {
    return {
      '--theme-primary': theme.primary,
      '--theme-primary-glow': theme.primaryGlow,
      '--theme-bg-gradient': theme.bgGradient,
      '--theme-bg-dark': theme.bgDark,
      '--theme-text-primary': theme.textPrimary,
      '--theme-text-secondary': theme.textSecondary,
      '--theme-text-muted': theme.textMuted,
      '--theme-button-bg': theme.buttonBg,
      '--theme-button-hover': theme.buttonHover,
      '--theme-button-text': theme.buttonText,
      '--theme-card-bg': theme.cardBg,
      '--theme-card-border': theme.cardBorder,
      '--theme-font-family': theme.fontFamily,
    };
  };

  return (
    <ThemeContext.Provider value={{ theme, setThemeByMode, getCSSVariables }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// 테마 적용 유틸리티 함수
export function getThemeStyles(theme: ModeTheme) {
  return {
    container: {
      background: theme.bgGradient,
    },
    title: {
      color: theme.primary,
      textShadow: `0 0 40px ${theme.primaryGlow}, 0 0 20px ${theme.primaryGlow}`,
      fontFamily: theme.fontFamily,
    },
    button: {
      backgroundColor: theme.buttonBg,
      color: theme.buttonText,
    },
    card: {
      backgroundColor: theme.cardBg,
      borderColor: theme.cardBorder,
    },
    text: {
      primary: { color: theme.textPrimary },
      secondary: { color: theme.textSecondary },
      muted: { color: theme.textMuted },
    },
  };
}
