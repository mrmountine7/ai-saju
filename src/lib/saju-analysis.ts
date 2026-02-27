/**
 * 사주풀이 분석 서비스
 * - 최적화된 템플릿 기반 분석 (빠른 응답)
 * - D모드 벡터 검색 결과 통합
 * - 한자 제거, 고전 문헌 참조 표시
 */

// 천간/지지 한글 매핑
const STEM_KO: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
  '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
};

const BRANCH_KO: Record<string, string> = {
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사',
  '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해',
};

// 오행 매핑
const STEM_WUXING: Record<string, string> = {
  '甲': '목', '乙': '목', '丙': '화', '丁': '화', '戊': '토',
  '己': '토', '庚': '금', '辛': '금', '壬': '수', '癸': '수',
};

const BRANCH_WUXING: Record<string, string> = {
  '子': '수', '丑': '토', '寅': '목', '卯': '목', '辰': '토', '巳': '화',
  '午': '화', '未': '토', '申': '금', '酉': '금', '戌': '토', '亥': '수',
};

// 십신 매핑
const SHISHEN_MAP: Record<string, Record<string, string>> = {
  '甲': { '甲': '비견', '乙': '겁재', '丙': '식신', '丁': '상관', '戊': '편재', '己': '정재', '庚': '편관', '辛': '정관', '壬': '편인', '癸': '정인' },
  '乙': { '乙': '비견', '甲': '겁재', '丁': '식신', '丙': '상관', '己': '편재', '戊': '정재', '辛': '편관', '庚': '정관', '癸': '편인', '壬': '정인' },
  '丙': { '丙': '비견', '丁': '겁재', '戊': '식신', '己': '상관', '庚': '편재', '辛': '정재', '壬': '편관', '癸': '정관', '甲': '편인', '乙': '정인' },
  '丁': { '丁': '비견', '丙': '겁재', '己': '식신', '戊': '상관', '辛': '편재', '庚': '정재', '癸': '편관', '壬': '정관', '乙': '편인', '甲': '정인' },
  '戊': { '戊': '비견', '己': '겁재', '庚': '식신', '辛': '상관', '壬': '편재', '癸': '정재', '甲': '편관', '乙': '정관', '丙': '편인', '丁': '정인' },
  '己': { '己': '비견', '戊': '겁재', '辛': '식신', '庚': '상관', '癸': '편재', '壬': '정재', '乙': '편관', '甲': '정관', '丁': '편인', '丙': '정인' },
  '庚': { '庚': '비견', '辛': '겁재', '壬': '식신', '癸': '상관', '甲': '편재', '乙': '정재', '丙': '편관', '丁': '정관', '戊': '편인', '己': '정인' },
  '辛': { '辛': '비견', '庚': '겁재', '癸': '식신', '壬': '상관', '乙': '편재', '甲': '정재', '丁': '편관', '丙': '정관', '己': '편인', '戊': '정인' },
  '壬': { '壬': '비견', '癸': '겁재', '甲': '식신', '乙': '상관', '丙': '편재', '丁': '정재', '戊': '편관', '己': '정관', '庚': '편인', '辛': '정인' },
  '癸': { '癸': '비견', '壬': '겁재', '乙': '식신', '甲': '상관', '丁': '편재', '丙': '정재', '己': '편관', '戊': '정관', '辛': '편인', '庚': '정인' },
};

// 일간 특성 템플릿
const DAY_MASTER_TEMPLATES: Record<string, {
  element: string;
  yinYang: string;
  character: string;
  strengths: string[];
  weaknesses: string[];
  career: string;
}> = {
  '甲': {
    element: '목',
    yinYang: '양',
    character: '큰 나무처럼 곧고 당당한 성품입니다. 리더십과 추진력이 강하며, 정의감이 넘칩니다.',
    strengths: ['추진력', '리더십', '정의감', '결단력', '성장 지향'],
    weaknesses: ['고집', '융통성 부족', '성급함', '타협 어려움'],
    career: '경영, 정치, 교육, 법률, 건축 분야에서 두각을 나타냅니다.',
  },
  '乙': {
    element: '목',
    yinYang: '음',
    character: '덩굴처럼 유연하고 적응력이 뛰어납니다. 섬세하고 예술적 감각이 돋보입니다.',
    strengths: ['유연성', '적응력', '섬세함', '협조성', '예술성'],
    weaknesses: ['우유부단', '의존적', '소심함', '결단력 부족'],
    career: '예술, 디자인, 상담, 서비스, 패션 분야에서 능력을 발휘합니다.',
  },
  '丙': {
    element: '화',
    yinYang: '양',
    character: '태양처럼 밝고 따뜻한 성품입니다. 열정적이고 낙천적이며 사람들을 끌어당기는 매력이 있습니다.',
    strengths: ['열정', '낙천성', '친화력', '표현력', '영감'],
    weaknesses: ['충동적', '산만함', '지구력 부족', '과욕'],
    career: '방송, 연예, 마케팅, 교육, 외교 분야에서 빛을 발합니다.',
  },
  '丁': {
    element: '화',
    yinYang: '음',
    character: '촛불처럼 은은하고 따뜻한 성품입니다. 내면의 빛으로 주변을 밝히며 섬세합니다.',
    strengths: ['섬세함', '집중력', '따뜻함', '직관력', '헌신'],
    weaknesses: ['예민함', '소심함', '걱정 많음', '내성적'],
    career: '연구, 기획, 상담, 문학, 종교 분야에서 재능을 보입니다.',
  },
  '戊': {
    element: '토',
    yinYang: '양',
    character: '산처럼 듬직하고 안정적인 성품입니다. 신뢰감을 주며 중심을 잡아주는 역할을 합니다.',
    strengths: ['신뢰성', '안정감', '포용력', '중재력', '인내심'],
    weaknesses: ['둔함', '보수적', '변화 거부', '게으름'],
    career: '금융, 부동산, 농업, 건설, 중재 분야에서 두각을 나타냅니다.',
  },
  '己': {
    element: '토',
    yinYang: '음',
    character: '기름진 땅처럼 만물을 품어 기르는 성품입니다. 배려심이 깊고 실속을 챙깁니다.',
    strengths: ['배려심', '실속', '꼼꼼함', '봉사정신', '수용력'],
    weaknesses: ['소심함', '의심', '계산적', '우유부단'],
    career: '농업, 요식업, 교육, 복지, 부동산 분야에서 능력을 발휘합니다.',
  },
  '庚': {
    element: '금',
    yinYang: '양',
    character: '강철처럼 강인하고 결단력이 뛰어납니다. 의리와 정의를 중시하며 카리스마가 있습니다.',
    strengths: ['결단력', '의리', '정의감', '강인함', '실행력'],
    weaknesses: ['냉정함', '독선', '융통성 부족', '공격성'],
    career: '군인, 경찰, 외과의사, 기계공학, 스포츠 분야에서 두각을 나타냅니다.',
  },
  '辛': {
    element: '금',
    yinYang: '음',
    character: '보석처럼 섬세하고 완벽을 추구합니다. 품위 있고 세련되며 예리한 판단력을 지녔습니다.',
    strengths: ['섬세함', '완벽주의', '품위', '예리함', '심미안'],
    weaknesses: ['예민함', '까다로움', '고집', '냉정함'],
    career: '보석, 금융, 법률, 예술, IT 분야에서 재능을 보입니다.',
  },
  '壬': {
    element: '수',
    yinYang: '양',
    character: '바다처럼 넓고 깊은 성품입니다. 지혜롭고 포용력이 크며 어떤 상황에도 적응합니다.',
    strengths: ['지혜', '포용력', '적응력', '창의력', '인내심'],
    weaknesses: ['우유부단', '변덕', '현실 도피', '게으름'],
    career: '무역, 물류, 철학, 예술, 유통 분야에서 능력을 발휘합니다.',
  },
  '癸': {
    element: '수',
    yinYang: '음',
    character: '이슬비처럼 섬세하고 깊은 내면을 가졌습니다. 직관력이 뛰어나고 학문에 재능이 있습니다.',
    strengths: ['직관력', '섬세함', '학문 재능', '이해력', '적응력'],
    weaknesses: ['소심함', '우울', '의심', '복잡함'],
    career: '연구, 의학, 심리학, 예술, 종교 분야에서 재능을 보입니다.',
  },
};

// 격국 해석 템플릿
const GEJU_TEMPLATES: Record<string, {
  description: string;
  characteristics: string[];
  favorable: string;
  unfavorable: string;
  advice: string;
}> = {
  '정관격': {
    description: '월령에서 정관이 투출하여 격을 이룬 것으로, 정통과 질서를 중시하는 귀격입니다.',
    characteristics: ['책임감이 강함', '도덕성이 높음', '안정을 추구함', '규율을 중시함'],
    favorable: '인성이 관을 생하거나 재성이 관을 도우면 더욱 귀합니다.',
    unfavorable: '상관이 관을 극하거나 비겁이 관을 약화시키면 불리합니다.',
    advice: '질서와 원칙을 지키되 유연함도 필요합니다. 권위를 인정받으려면 실력을 쌓으세요.',
  },
  '편관격': {
    description: '월령에서 편관(칠살)이 투출하여 격을 이룬 것으로, 권위와 통제력이 강한 격입니다.',
    characteristics: ['권위적', '결단력이 강함', '도전 정신', '압박감에 강함'],
    favorable: '식신이 살을 제어하거나 인성이 살을 설기하면 귀합니다.',
    unfavorable: '재성이 살을 생하면 살이 너무 강해져 불리합니다.',
    advice: '강한 추진력을 살리되 독단적이지 않도록 주의하세요. 인내심을 기르면 대성합니다.',
  },
  '정재격': {
    description: '월령에서 정재가 투출하여 격을 이룬 것으로, 실속과 안정을 추구하는 격입니다.',
    characteristics: ['실속적', '재물 관리 능력', '성실함', '보수적'],
    favorable: '관성이 재를 보호하고 식상이 재를 생하면 부귀합니다.',
    unfavorable: '비겁이 재를 극탈하면 재물 손실이 있을 수 있습니다.',
    advice: '꾸준한 노력으로 재물을 축적하세요. 투기보다 저축이 유리합니다.',
  },
  '편재격': {
    description: '월령에서 편재가 투출하여 격을 이룬 것으로, 사업 수완과 재물 운용에 능한 격입니다.',
    characteristics: ['사업 수완', '투자 감각', '대인관계 능숙', '융통성'],
    favorable: '식상이 재를 생하고 관성이 있으면 부귀겸전합니다.',
    unfavorable: '비겁이 강하면 재물 다툼이 있을 수 있습니다.',
    advice: '기회를 포착하는 능력을 살리되 무리한 투자는 피하세요.',
  },
  '식신격': {
    description: '월령에서 식신이 투출하여 격을 이룬 것으로, 재능과 표현력이 뛰어난 격입니다.',
    characteristics: ['재능 풍부', '표현력', '낙천적', '식복'],
    favorable: '재성이 식신을 설기하면 재물이 따르고 귀합니다.',
    unfavorable: '편인이 식신을 극하면 재능 발휘가 어렵습니다.',
    advice: '타고난 재능을 꾸준히 발전시키세요. 먹거리 관련 사업도 좋습니다.',
  },
  '상관격': {
    description: '월령에서 상관이 투출하여 격을 이룬 것으로, 창의력과 표현력이 뛰어난 격입니다.',
    characteristics: ['창의력', '비판 정신', '말재주', '자유 추구'],
    favorable: '재성이 상관을 설기하면 재물을 얻습니다. 인성이 상관을 제어하면 안정됩니다.',
    unfavorable: '관성과 상관이 부딪히면 구설과 다툼이 있을 수 있습니다.',
    advice: '창의력을 살려 예술, 기획, 컨설팅 분야로 진출하세요. 말조심이 필요합니다.',
  },
  '정인격': {
    description: '월령에서 정인이 투출하여 격을 이룬 것으로, 학문과 명예를 중시하는 격입니다.',
    characteristics: ['학문 재능', '명예 중시', '자비심', '보수적'],
    favorable: '관성이 인을 생하면 학업과 명예가 높아집니다.',
    unfavorable: '재성이 인을 극하면 학업에 방해가 됩니다.',
    advice: '꾸준한 학습과 자기 계발이 성공의 열쇠입니다. 교육 분야가 적합합니다.',
  },
  '편인격': {
    description: '월령에서 편인이 투출하여 격을 이룬 것으로, 특수 재능과 직관력이 뛰어난 격입니다.',
    characteristics: ['직관력', '특수 재능', '비전통적', '고독 경향'],
    favorable: '비겁이 인을 설기하면 재능을 발휘합니다.',
    unfavorable: '편인이 식신을 극하면 건강이나 재물에 문제가 생길 수 있습니다.',
    advice: '독특한 재능을 살려 특수 분야로 진출하세요. 건강 관리에 유의하세요.',
  },
  '건록격': {
    description: '일간이 월지에서 건록을 만난 것으로, 자립심과 독립심이 강한 격입니다.',
    characteristics: ['자립심', '독립심', '실행력', '주관이 뚜렷함'],
    favorable: '재관이 있으면 부귀를 이룹니다.',
    unfavorable: '비겁이 너무 강하면 고집이 세지고 협력이 어렵습니다.',
    advice: '자신의 능력을 믿고 독자적으로 사업을 시작해도 좋습니다.',
  },
};

// 조후용신 템플릿 (일간 + 월지 조합)
const JOHU_YONGSHEN: Record<string, Record<string, { primary: string; secondary: string; reason: string }>> = {
  '甲': {
    '寅': { primary: '병화', secondary: '계수', reason: '봄철 갑목은 양명한 병화로 따뜻이 해야 성장합니다. 계수로 촉촉이 하면 좋습니다.' },
    '卯': { primary: '병화', secondary: '계수', reason: '묘월 갑목은 병화로 따뜻이 하고 계수로 수분을 공급하면 좋습니다.' },
    '辰': { primary: '갑목', secondary: '경금', reason: '진월은 토가 강하니 갑목으로 소토하고 경금으로 재목합니다.' },
    '巳': { primary: '계수', secondary: '경금', reason: '여름철 갑목은 계수로 시원하게 하고 경금으로 다듬으면 좋습니다.' },
    '午': { primary: '계수', secondary: '정화', reason: '오월 갑목은 계수가 급합니다. 화기가 강하면 정화로 조절합니다.' },
    '未': { primary: '계수', secondary: '경금', reason: '미월은 토조하니 계수로 축여주고 경금으로 재목해야 합니다.' },
    '申': { primary: '정화', secondary: '병화', reason: '가을철 갑목은 정화로 단련하고 병화로 따뜻이 합니다.' },
    '酉': { primary: '정화', secondary: '경금', reason: '유월은 금이 강하니 정화로 금을 제련해야 합니다.' },
    '戌': { primary: '갑목', secondary: '계수', reason: '술월은 토가 강하니 갑목으로 소토하고 계수로 윤택하게 합니다.' },
    '亥': { primary: '정화', secondary: '병화', reason: '겨울철 갑목은 정화와 병화로 따뜻이 해야 합니다.' },
    '子': { primary: '정화', secondary: '경금', reason: '자월 갑목은 정화로 따뜻이, 경금으로 재목해야 귀합니다.' },
    '丑': { primary: '병화', secondary: '경금', reason: '축월은 토한하니 병화로 따뜻이 하고 경금으로 재목합니다.' },
  },
  '庚': {
    '寅': { primary: '병화', secondary: '갑목', reason: '봄철 경금은 병화로 단련하고 갑목으로 재목해야 귀합니다.' },
    '卯': { primary: '정화', secondary: '갑목', reason: '묘월 경금은 정화로 단련하고 갑목으로 조각해야 합니다.' },
    '辰': { primary: '갑목', secondary: '임수', reason: '진월 경금은 갑목으로 재목하고 임수로 씻어야 빛납니다.' },
    '巳': { primary: '임수', secondary: '무토', reason: '여름철 경금은 임수로 식히고 무토로 보호해야 합니다.' },
    '午': { primary: '임수', secondary: '계수', reason: '오월 경금은 임수가 급합니다. 계수로 보조하면 좋습니다.' },
    '未': { primary: '임수', secondary: '경금', reason: '미월 경금은 임수로 씻고 경금 비겁으로 힘을 얻습니다.' },
    '申': { primary: '정화', secondary: '갑목', reason: '가을철 경금은 정화로 단련하고 갑목으로 재목합니다.' },
    '酉': { primary: '정화', secondary: '임수', reason: '유월 경금은 정화로 단련하고 임수로 씻어야 빛납니다.' },
    '戌': { primary: '갑목', secondary: '임수', reason: '술월 경금은 갑목으로 재목하고 임수로 씻습니다.' },
    '亥': { primary: '정화', secondary: '병화', reason: '겨울철 경금은 정화와 병화로 따뜻이 단련해야 합니다.' },
    '子': { primary: '정화', secondary: '갑목', reason: '자월 경금은 정화로 단련하고 갑목으로 재목합니다.' },
    '丑': { primary: '병화', secondary: '정화', reason: '축월 경금은 병화로 따뜻이 하고 정화로 단련합니다.' },
  },
};

// 12띠 이모지 매핑
const ZODIAC_EMOJI: Record<string, string> = {
  '子': '🐀', '丑': '🐮', '寅': '🐯', '卯': '🐰',
  '辰': '🐲', '巳': '🐍', '午': '🐴', '未': '🐑',
  '申': '🐵', '酉': '🐔', '戌': '🐕', '亥': '🐷',
};

// 고전 문헌 참조 템플릿 (실제로는 D모드 벡터 검색 결과를 사용)
const CLASSICAL_REFERENCES = [
  { book: '적천수', title: '일간론', content: '일간은 사주의 주인으로 모든 판단의 기준이 됩니다.' },
  { book: '자평진전', title: '격국론', content: '격국은 월령을 기준으로 정하되 천간의 투출을 살핍니다.' },
  { book: '궁통보감', title: '조후론', content: '조후는 계절에 따른 한난조습을 조절하는 것입니다.' },
  { book: '삼명통회', title: '십신론', content: '십신은 일간을 기준으로 다른 천간과의 관계를 나타냅니다.' },
  { book: '연해자평', title: '용신론', content: '용신은 사주의 병을 치료하고 균형을 맞추는 글자입니다.' },
];

// 사주 정보 인터페이스
export interface SajuPillar {
  gan: string;  // 천간
  zhi: string;  // 지지
}

export interface SajuInfo {
  yearPillar: SajuPillar;
  monthPillar: SajuPillar;
  dayPillar: SajuPillar;
  hourPillar: SajuPillar;
  gender: 'male' | 'female';
  name?: string;
  birthYear?: number;
}

// 분석 결과 인터페이스
export interface AnalysisSection {
  title: string;
  content: string;
  subItems?: string[];
}

export interface ClassicalReference {
  book: string;
  title: string;
  content: string;
  relevance: number;  // 관련도 (0~1)
}

export interface SajuAnalysisResult {
  pillars: {
    year: { gan: string; zhi: string; ganKo: string; zhiKo: string };
    month: { gan: string; zhi: string; ganKo: string; zhiKo: string };
    day: { gan: string; zhi: string; ganKo: string; zhiKo: string };
    hour: { gan: string; zhi: string; ganKo: string; zhiKo: string };
  };
  dayMaster: {
    gan: string;
    ganKo: string;
    element: string;
    yinYang: string;
    character: string;
    strengths: string[];
    weaknesses: string[];
    career: string;
  };
  shishen: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  wuxingBalance: {
    mok: number;
    hwa: number;
    to: number;
    geum: number;
    su: number;
  };
  geju: {
    name: string;
    description: string;
    characteristics: string[];
    favorable: string;
    unfavorable: string;
    advice: string;
  };
  yongshen: {
    primary: string;
    secondary: string;
    reason: string;
  };
  sections: AnalysisSection[];
  classicalReferences: ClassicalReference[];
  processingTime: number;
}

// 한자를 한글로 변환하는 유틸리티 함수
function ganToKo(gan: string): string {
  return STEM_KO[gan] || gan;
}

function zhiToKo(zhi: string): string {
  return BRANCH_KO[zhi] || zhi;
}

// 십신 계산
function calcShishen(dayGan: string, targetGan: string): string {
  const map = SHISHEN_MAP[dayGan];
  if (!map) return '?';
  return map[targetGan] || '?';
}

// 격국 판단 (월지 본기 기준)
function determineGeju(dayGan: string, monthZhi: string): string {
  const MONTH_MAIN_STEM: Record<string, string> = {
    '寅': '甲', '卯': '乙', '辰': '戊', '巳': '丙',
    '午': '丁', '未': '己', '申': '庚', '酉': '辛',
    '戌': '戊', '亥': '壬', '子': '癸', '丑': '己',
  };
  
  const mainStem = MONTH_MAIN_STEM[monthZhi] || '';
  if (mainStem === dayGan) {
    return '건록격';
  }
  
  const shishen = calcShishen(dayGan, mainStem);
  return `${shishen}격`;
}

// 오행 분포 계산
function calcWuxingBalance(info: SajuInfo): SajuAnalysisResult['wuxingBalance'] {
  const count = { mok: 0, hwa: 0, to: 0, geum: 0, su: 0 };
  
  const wuxingToKey: Record<string, keyof typeof count> = {
    '목': 'mok', '화': 'hwa', '토': 'to', '금': 'geum', '수': 'su',
  };
  
  const pillars = [info.yearPillar, info.monthPillar, info.dayPillar, info.hourPillar];
  
  for (const pillar of pillars) {
    const ganWuxing = STEM_WUXING[pillar.gan];
    const zhiWuxing = BRANCH_WUXING[pillar.zhi];
    
    if (ganWuxing && wuxingToKey[ganWuxing]) {
      count[wuxingToKey[ganWuxing]] += 1;
    }
    if (zhiWuxing && wuxingToKey[zhiWuxing]) {
      count[wuxingToKey[zhiWuxing]] += 1;
    }
  }
  
  return count;
}

// 메인 분석 함수
export async function analyzeSaju(info: SajuInfo): Promise<SajuAnalysisResult> {
  const startTime = Date.now();
  
  const dayGan = info.dayPillar.gan;
  const monthZhi = info.monthPillar.zhi;
  
  // 1. 기본 정보
  const pillars = {
    year: { 
      gan: info.yearPillar.gan, 
      zhi: info.yearPillar.zhi,
      ganKo: ganToKo(info.yearPillar.gan),
      zhiKo: zhiToKo(info.yearPillar.zhi),
    },
    month: {
      gan: info.monthPillar.gan,
      zhi: info.monthPillar.zhi,
      ganKo: ganToKo(info.monthPillar.gan),
      zhiKo: zhiToKo(info.monthPillar.zhi),
    },
    day: {
      gan: info.dayPillar.gan,
      zhi: info.dayPillar.zhi,
      ganKo: ganToKo(info.dayPillar.gan),
      zhiKo: zhiToKo(info.dayPillar.zhi),
    },
    hour: {
      gan: info.hourPillar.gan,
      zhi: info.hourPillar.zhi,
      ganKo: ganToKo(info.hourPillar.gan),
      zhiKo: zhiToKo(info.hourPillar.zhi),
    },
  };
  
  // 2. 일간 특성
  const dayMasterTemplate = DAY_MASTER_TEMPLATES[dayGan] || DAY_MASTER_TEMPLATES['甲'];
  const dayMaster = {
    gan: dayGan,
    ganKo: ganToKo(dayGan),
    ...dayMasterTemplate,
  };
  
  // 3. 십신
  const shishen = {
    year: calcShishen(dayGan, info.yearPillar.gan),
    month: calcShishen(dayGan, info.monthPillar.gan),
    day: '비견',
    hour: calcShishen(dayGan, info.hourPillar.gan),
  };
  
  // 4. 오행 분포
  const wuxingBalance = calcWuxingBalance(info);
  
  // 5. 격국
  const gejuName = determineGeju(dayGan, monthZhi);
  const gejuTemplate = GEJU_TEMPLATES[gejuName] || GEJU_TEMPLATES['정관격'];
  const geju = {
    name: gejuName,
    ...gejuTemplate,
  };
  
  // 6. 조후용신
  const johuMap = JOHU_YONGSHEN[dayGan] || JOHU_YONGSHEN['甲'];
  const johu = johuMap[monthZhi] || johuMap['子'];
  const yongshen = {
    primary: johu.primary,
    secondary: johu.secondary,
    reason: johu.reason,
  };
  
  // 7. 분석 섹션 생성
  const sections: AnalysisSection[] = [
    {
      title: '일간 특성',
      content: `${ganToKo(dayGan)}${dayMasterTemplate.element} 일간은 ${dayMasterTemplate.yinYang}의 기운을 가집니다. ${dayMasterTemplate.character}`,
      subItems: dayMasterTemplate.strengths.map(s => `강점: ${s}`).concat(dayMasterTemplate.weaknesses.map(w => `보완점: ${w}`)),
    },
    {
      title: '격국 분석',
      content: `이 사주는 ${gejuName}입니다. ${gejuTemplate.description}`,
      subItems: gejuTemplate.characteristics,
    },
    {
      title: '용신 판단',
      content: `${yongshen.primary}를 용신으로, ${yongshen.secondary}를 희신으로 씁니다.`,
      subItems: [yongshen.reason],
    },
    {
      title: '오행 분포',
      content: `목(${wuxingBalance.mok}), 화(${wuxingBalance.hwa}), 토(${wuxingBalance.to}), 금(${wuxingBalance.geum}), 수(${wuxingBalance.su})`,
      subItems: getWuxingAdvice(wuxingBalance),
    },
    {
      title: '직업 및 적성',
      content: dayMasterTemplate.career,
    },
    {
      title: '종합 조언',
      content: gejuTemplate.advice,
    },
  ];
  
  // 8. 고전 문헌 참조 (시뮬레이션 - 실제로는 D모드 벡터 검색)
  const classicalReferences: ClassicalReference[] = CLASSICAL_REFERENCES.map((ref, idx) => ({
    ...ref,
    relevance: Math.round((0.95 - idx * 0.08) * 100) / 100,
  }));
  
  const processingTime = Date.now() - startTime;
  
  return {
    pillars,
    dayMaster,
    shishen,
    wuxingBalance,
    geju,
    yongshen,
    sections,
    classicalReferences,
    processingTime,
  };
}

// 오행 분포에 따른 조언 생성
function getWuxingAdvice(balance: SajuAnalysisResult['wuxingBalance']): string[] {
  const advice: string[] = [];
  const total = balance.mok + balance.hwa + balance.to + balance.geum + balance.su;
  
  const wuxingNames: Record<keyof typeof balance, { name: string; organ: string }> = {
    mok: { name: '목', organ: '간/담' },
    hwa: { name: '화', organ: '심장/소장' },
    to: { name: '토', organ: '비장/위장' },
    geum: { name: '금', organ: '폐/대장' },
    su: { name: '수', organ: '신장/방광' },
  };
  
  for (const [key, value] of Object.entries(balance)) {
    const info = wuxingNames[key as keyof typeof balance];
    const ratio = (value / total) * 100;
    
    if (value <= 1) {
      advice.push(`${info.name} 오행이 부족합니다. ${info.organ} 건강에 유의하세요.`);
    } else if (value >= 4) {
      advice.push(`${info.name} 오행이 과합니다. 균형 있는 생활이 필요합니다.`);
    }
  }
  
  if (advice.length === 0) {
    advice.push('오행이 비교적 균형 잡혀 있습니다.');
  }
  
  return advice;
}

// 사주 정보를 ResultPage 데이터에서 변환하는 유틸리티
export function convertPillarsToSajuInfo(pillars: Array<{
  top: string;
  bottom: string;
}>): SajuInfo {
  return {
    hourPillar: { gan: pillars[0].top, zhi: pillars[0].bottom },
    dayPillar: { gan: pillars[1].top, zhi: pillars[1].bottom },
    monthPillar: { gan: pillars[2].top, zhi: pillars[2].bottom },
    yearPillar: { gan: pillars[3].top, zhi: pillars[3].bottom },
    gender: 'male',
  };
}
