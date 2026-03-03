/**
 * 사주풀이 D모드 API 클라이언트 (v2.0)
 * - saju-classics-pipeline 백엔드 API 호출
 * - 벡터DB 검색 + LLM 분석 연동
 * - 일진/오늘운세, 궁합, 확장분석 API 추가
 */

// API 서버 URL (환경변수 또는 Railway 프로덕션 도메인)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ai-saju-production.up.railway.app';
console.log('[API] Base URL:', API_BASE_URL);

// API 상태 체크 캐시 (5분)
let healthCheckCache: { healthy: boolean; timestamp: number } | null = null;
const HEALTH_CACHE_TTL = 5 * 60 * 1000;

export type AnalysisLevel = 'easy' | 'detailed' | 'expert';

export interface SajuRequest {
  name: string;
  gender: 'male' | 'female';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  is_lunar: boolean;
  is_leap_month?: boolean;
  target_year?: number;
  analysis_level?: AnalysisLevel;
}

export interface SearchResult {
  book_title: string;
  title: string;
  content: string;
  score: number;
  matched_patterns: string[];
}

export interface SajuAnalysisResponse {
  success: boolean;
  processing_time_ms: number;
  pillars: {
    year: { gan: string; zhi: string };
    month: { gan: string; zhi: string };
    day: { gan: string; zhi: string };
    hour: { gan: string; zhi: string };
  };
  day_master: {
    gan: string;
    element: string;
  };
  geju: {
    name: string;
    description?: string;
  };
  yongshen: {
    primary: string;
    secondary: string;
    reason: string;
  };
  wuxing_balance: {
    목: number;
    화: number;
    토: number;
    금: number;
    수: number;
  };
  synthesis: string;
  easy_explanation: string;
  classical_references: SearchResult[];
  daewoon_summary?: string;
  sewoon_summary?: string;
  error?: string;
}

/**
 * D모드 사주 분석 API 호출
 * - 벡터DB HyDE + LLM 리랭킹
 * - LLM 종합 해석
 */
export async function analyzeSajuDMode(request: SajuRequest): Promise<SajuAnalysisResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/saju/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        target_year: request.target_year || new Date().getFullYear(),
        analysis_level: request.analysis_level || 'easy',
      }),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const data: SajuAnalysisResponse = await response.json();
    return data;
  } catch (error) {
    console.error('D모드 분석 API 호출 실패:', error);
    
    // API 서버 연결 실패 시 폴백
    return {
      success: false,
      processing_time_ms: 0,
      pillars: {
        year: { gan: '', zhi: '' },
        month: { gan: '', zhi: '' },
        day: { gan: '', zhi: '' },
        hour: { gan: '', zhi: '' },
      },
      day_master: { gan: '', element: '' },
      geju: { name: '' },
      yongshen: { primary: '', secondary: '', reason: '' },
      wuxing_balance: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
      synthesis: '',
      easy_explanation: '',
      classical_references: [],
      error: error instanceof Error ? error.message : 'API 연결 실패',
    };
  }
}

/**
 * API 서버 상태 확인 (캐시 사용)
 */
export async function checkApiHealth(): Promise<boolean> {
  // 캐시된 결과 사용
  if (healthCheckCache && Date.now() - healthCheckCache.timestamp < HEALTH_CACHE_TTL) {
    return healthCheckCache.healthy;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });
    const healthy = response.ok;
    healthCheckCache = { healthy, timestamp: Date.now() };
    return healthy;
  } catch {
    healthCheckCache = { healthy: false, timestamp: Date.now() };
    return false;
  }
}

/**
 * API 서버 상세 상태 확인
 */
export async function checkApiHealthDetailed(): Promise<{
  status: string;
  redis: string;
  httpClient: string;
  system?: { cpu_percent: number; memory_percent: number };
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/health/detailed`, { method: 'GET' });
    if (response.ok) {
      return await response.json();
    }
    return { status: 'unhealthy', redis: 'unknown', httpClient: 'unknown' };
  } catch {
    return { status: 'unreachable', redis: 'unknown', httpClient: 'unknown' };
  }
}

// 대운/세운/월운 요청 인터페이스
export interface FortuneRequest {
  name: string;
  gender: 'male' | 'female';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  is_lunar: boolean;
  is_leap_month?: boolean;
  target_year: number;
  target_month?: number;
}

// 대운 항목 인터페이스
export interface DaewoonItem {
  age_start: number;
  age_end: number;
  gan: string;
  zhi: string;
  gan_ko: string;
  zhi_ko: string;
  shishen: string;
  is_current: boolean;
}

// 대운/세운/월운 응답 인터페이스
export interface FortuneAnalysisResponse {
  success: boolean;
  processing_time_ms: number;
  fortune_type: 'daewoon' | 'sewoon' | 'wolwoon';
  current_fortune: {
    gan_ko?: string;
    zhi_ko?: string;
    age_start?: number;
    age_end?: number;
    shishen?: string;
    year?: number;
    month?: number;
  };
  fortune_list: DaewoonItem[];
  positive_factors: string[];
  negative_factors: string[];
  impact_on_wonguk: string;
  detailed_analysis: string;
  classical_references: SearchResult[];
  error?: string;
}

// 개운법 요청 인터페이스
export interface GaewoonRequest {
  name: string;
  gender: 'male' | 'female';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  is_lunar: boolean;
  is_leap_month?: boolean;
  yongshen?: string;
}

// 개운법 응답 인터페이스
export interface GaewoonResponse {
  success: boolean;
  processing_time_ms: number;
  yongshen_element: string;
  gaewoon_methods: Array<{
    category: string;
    items: string[];
  }>;
  favorable_colors: string[];
  favorable_directions: string[];
  favorable_numbers: number[];
  favorable_foods: string[];
  detailed_advice: string;
  classical_references: SearchResult[];
  error?: string;
}

/**
 * 대운 상세 분석 API 호출
 */
export async function analyzeDaewoon(request: FortuneRequest): Promise<FortuneAnalysisResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/saju/fortune/daewoon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('대운 분석 API 호출 실패:', error);
    return {
      success: false,
      processing_time_ms: 0,
      fortune_type: 'daewoon',
      current_fortune: {},
      fortune_list: [],
      positive_factors: [],
      negative_factors: [],
      impact_on_wonguk: '',
      detailed_analysis: '',
      classical_references: [],
      error: error instanceof Error ? error.message : 'API 연결 실패',
    };
  }
}

/**
 * 세운 상세 분석 API 호출
 */
export async function analyzeSewoon(request: FortuneRequest): Promise<FortuneAnalysisResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/saju/fortune/sewoon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('세운 분석 API 호출 실패:', error);
    return {
      success: false,
      processing_time_ms: 0,
      fortune_type: 'sewoon',
      current_fortune: {},
      fortune_list: [],
      positive_factors: [],
      negative_factors: [],
      impact_on_wonguk: '',
      detailed_analysis: '',
      classical_references: [],
      error: error instanceof Error ? error.message : 'API 연결 실패',
    };
  }
}

/**
 * 월운 상세 분석 API 호출
 */
export async function analyzeWolwoon(request: FortuneRequest): Promise<FortuneAnalysisResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/saju/fortune/wolwoon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        target_month: request.target_month || new Date().getMonth() + 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('월운 분석 API 호출 실패:', error);
    return {
      success: false,
      processing_time_ms: 0,
      fortune_type: 'wolwoon',
      current_fortune: {},
      fortune_list: [],
      positive_factors: [],
      negative_factors: [],
      impact_on_wonguk: '',
      detailed_analysis: '',
      classical_references: [],
      error: error instanceof Error ? error.message : 'API 연결 실패',
    };
  }
}

/**
 * 개운법 분석 API 호출
 */
export async function analyzeGaewoon(request: GaewoonRequest): Promise<GaewoonResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/saju/gaewoon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('개운법 분석 API 호출 실패:', error);
    return {
      success: false,
      processing_time_ms: 0,
      yongshen_element: '',
      gaewoon_methods: [],
      favorable_colors: [],
      favorable_directions: [],
      favorable_numbers: [],
      favorable_foods: [],
      detailed_advice: '',
      classical_references: [],
      error: error instanceof Error ? error.message : 'API 연결 실패',
    };
  }
}

// ================================================
// 일진/오늘운세 API
// ================================================

export interface DailyFortuneRequest {
  name: string;
  gender: 'male' | 'female';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  is_lunar: boolean;
  is_leap_month?: boolean;
  target_date?: string; // YYYY-MM-DD
}

export interface DailyFortuneResponse {
  success: boolean;
  processing_time_ms: number;
  date: string;
  daily_pillar: { gan: string; zhi: string; gan_ko: string; zhi_ko: string };
  grade: string;
  emoji: string;
  score: number;
  message: string;
  shinsal: Array<{ name: string; description: string; is_positive: boolean }>;
  positive_effects: string[];
  negative_effects: string[];
  advice: string;
  lucky_elements: {
    color: string;
    direction: string;
    number: number;
    activity: string;
  };
  error?: string;
}

/**
 * 일진/오늘운세 API 호출
 */
export async function analyzeDailyFortune(request: DailyFortuneRequest): Promise<DailyFortuneResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/saju/daily`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('일진 분석 API 호출 실패:', error);
    return {
      success: false,
      processing_time_ms: 0,
      date: '',
      daily_pillar: { gan: '', zhi: '', gan_ko: '', zhi_ko: '' },
      grade: '',
      emoji: '',
      score: 0,
      message: '',
      shinsal: [],
      positive_effects: [],
      negative_effects: [],
      advice: '',
      lucky_elements: { color: '', direction: '', number: 0, activity: '' },
      error: error instanceof Error ? error.message : 'API 연결 실패',
    };
  }
}

/**
 * 월간 일진 배치 조회 (캘린더용)
 */
export async function getMonthlyDailyFortunes(
  request: Omit<DailyFortuneRequest, 'target_date'>,
  year: number,
  month: number
): Promise<DailyFortuneResponse[]> {
  const results: DailyFortuneResponse[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // 병렬로 일진 조회 (최대 5개씩)
  const batchSize = 5;
  for (let i = 1; i <= daysInMonth; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, daysInMonth + 1); j++) {
      const targetDate = `${year}-${String(month).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
      batch.push(analyzeDailyFortune({ ...request, target_date: targetDate }));
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }
  
  return results;
}

// ================================================
// 궁합 API
// ================================================

export interface CompatibilityPersonInput {
  name: string;
  gender: 'male' | 'female';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  is_lunar?: boolean;
}

export interface CompatibilityRequest {
  person1: CompatibilityPersonInput;
  person2: CompatibilityPersonInput;
}

// 백엔드 API 요청 형식 (flat structure)
interface CompatibilityApiRequest {
  person1_name: string;
  person1_gender: string;
  person1_year: number;
  person1_month: number;
  person1_day: number;
  person1_hour: number;
  person1_minute: number;
  person1_is_lunar: boolean;
  person2_name: string;
  person2_gender: string;
  person2_year: number;
  person2_month: number;
  person2_day: number;
  person2_hour: number;
  person2_minute: number;
  person2_is_lunar: boolean;
}

export interface CompatibilityResponse {
  success: boolean;
  processing_time_ms: number;
  total_score: number;
  grade: string;
  categories: Array<{
    name: string;
    score: number;
    description: string;
  }>;
  summary: string;
  positive_factors: string[];
  caution_factors: string[];
  detailed_analysis: string;
  classical_references: SearchResult[];
  advice: string;
  error?: string;
}

/**
 * 궁합 분석 API 호출
 */
export async function analyzeCompatibility(request: CompatibilityRequest): Promise<CompatibilityResponse> {
  try {
    // 프론트엔드 형식을 백엔드 API 형식으로 변환
    const apiRequest: CompatibilityApiRequest = {
      person1_name: request.person1.name,
      person1_gender: request.person1.gender,
      person1_year: request.person1.year,
      person1_month: request.person1.month,
      person1_day: request.person1.day,
      person1_hour: request.person1.hour,
      person1_minute: request.person1.minute ?? 0,
      person1_is_lunar: request.person1.is_lunar ?? false,
      person2_name: request.person2.name,
      person2_gender: request.person2.gender,
      person2_year: request.person2.year,
      person2_month: request.person2.month,
      person2_day: request.person2.day,
      person2_hour: request.person2.hour,
      person2_minute: request.person2.minute ?? 0,
      person2_is_lunar: request.person2.is_lunar ?? false,
    };
    
    const response = await fetch(`${API_BASE_URL}/api/saju/compatibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('궁합 API 응답 오류:', response.status, errorText);
      throw new Error(`API 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('궁합 분석 API 호출 실패:', error);
    return {
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
      error: error instanceof Error ? error.message : 'API 연결 실패',
    };
  }
}

// ================================================
// 확장 분석 API (신살, 운세 교차 분석 포함)
// ================================================

export interface ExtendedAnalysisResponse {
  success: boolean;
  processing_time_ms: number;
  pillars: {
    year: { gan: string; zhi: string };
    month: { gan: string; zhi: string };
    day: { gan: string; zhi: string };
    hour: { gan: string; zhi: string };
  };
  day_master: { gan: string; element: string };
  geju: {
    name: string;
    category?: string;
    description?: string;
    characteristics?: string;
    favorable_jobs?: string;
    strength?: string;
    weakness?: string;
    classical_ref?: string;
  };
  yongshen: {
    primary: string;
    secondary: string;
    tertiary?: string;
    reason: string;
    classical?: string;
  };
  wuxing_balance: { 목: number; 화: number; 토: number; 금: number; 수: number };
  synthesis: string;
  easy_explanation: string;
  classical_references: SearchResult[];
  shinsal: Record<string, Array<{ name: string; description: string }>>;
  fortune_interactions: Record<string, string[]>;
  error?: string;
}

/**
 * 확장 분석 API 호출 (신살 + 운세 교차 분석)
 */
export async function analyzeExtended(request: SajuRequest): Promise<ExtendedAnalysisResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/saju/analyze/extended`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        target_year: request.target_year || new Date().getFullYear(),
      }),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('확장 분석 API 호출 실패:', error);
    return {
      success: false,
      processing_time_ms: 0,
      pillars: {
        year: { gan: '', zhi: '' },
        month: { gan: '', zhi: '' },
        day: { gan: '', zhi: '' },
        hour: { gan: '', zhi: '' },
      },
      day_master: { gan: '', element: '' },
      geju: { name: '' },
      yongshen: { primary: '', secondary: '', reason: '' },
      wuxing_balance: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
      synthesis: '',
      easy_explanation: '',
      classical_references: [],
      shinsal: {},
      fortune_interactions: {},
      error: error instanceof Error ? error.message : 'API 연결 실패',
    };
  }
}
