import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, Loader2, BookOpen, ChevronDown, ChevronUp, AlertCircle, Database, Brain, Sparkles, TrendingUp, Heart, Briefcase, Shield, Crown, Lock, LogIn, History, Download, Save, Check, Share2, FileDown, Users } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { analyzeSajuDMode, checkApiHealth, type SajuAnalysisResponse, type SajuRequest } from '@/lib/saju-api-client';
import { useProfile, type Profile } from '@/lib/profile-context';
import { useAuth } from '@/lib/auth-context';
import { PremiumAnalysisSection } from '@/app/components/PremiumAnalysisSection';
import { supabase } from '@/lib/supabase';
import { getDeviceId } from '@/lib/device-id';
import { generateSajuPDF } from '@/lib/pdf-generator';
import { useAnalysisMode, getModeApiParam, ANALYSIS_MODES } from '@/contexts/AnalysisModeContext';

// 천간 한자-한글 매핑
const ganHanja: Record<string, string> = {
  '갑': '甲', '을': '乙', '병': '丙', '정': '丁', '무': '戊',
  '기': '己', '경': '庚', '신': '辛', '임': '壬', '계': '癸',
};

// 지지 한자-한글 매핑
const zhiHanja: Record<string, string> = {
  '자': '子', '축': '丑', '인': '寅', '묘': '卯', '진': '辰', '사': '巳',
  '오': '午', '미': '未', '신': '申', '유': '酉', '술': '戌', '해': '亥',
};

// 천간 오행 매핑
const ganWuxing: Record<string, string> = {
  '갑': '목', '을': '목', '병': '화', '정': '화', '무': '토',
  '기': '토', '경': '금', '신': '금', '임': '수', '계': '수',
};

// 지지 오행 매핑
const zhiWuxing: Record<string, string> = {
  '자': '수', '축': '토', '인': '목', '묘': '목', '진': '토', '사': '화',
  '오': '화', '미': '토', '신': '금', '유': '금', '술': '토', '해': '수',
};

// 오행별 색상 매핑
const wuxingColorMap: Record<string, string> = {
  '목': 'text-green-500',
  '화': 'text-red-500',
  '토': 'text-yellow-500',
  '금': 'text-gray-400',
  '수': 'text-blue-500',
};

// 격국별 설명
function getGejuDescription(gejuName: string): string {
  const descriptions: Record<string, string> = {
    // 정격 (正格) - 10가지
    '정관격': '정관격은 월지 또는 월간에 정관이 투출하여 격을 이룬 것입니다. 정관은 나를 바르게 제어하는 힘으로, 규율과 책임감, 명예를 중시합니다. 공직, 관리직에 적합하며 안정적인 삶을 추구합니다.',
    '편관격': '편관격(칠살격)은 월지 또는 월간에 편관이 투출한 격입니다. 편관은 강한 제어력과 권위를 상징하며, 결단력과 추진력이 뛰어납니다. 무관, 경찰, 군인 등 권위적 직업에 적합합니다.',
    '정인격': '정인격은 월지 또는 월간에 정인이 투출한 격입니다. 정인은 나를 바르게 생해주는 힘으로, 학문과 교육, 자격증 취득에 유리합니다. 어머니의 사랑처럼 따뜻하고 보호적인 성향입니다.',
    '편인격': '편인격은 월지 또는 월간에 편인이 투출한 격입니다. 편인은 특수한 재능과 비범한 사고력을 나타냅니다. 예술, 종교, 철학, 의술 등 특수 분야에서 두각을 나타내며 독창적입니다.',
    '식신격': '식신격은 월지 또는 월간에 식신이 투출한 격입니다. 식신은 내가 생하는 같은 음양의 오행으로, 의식주와 표현력을 관장합니다. 요리, 예술, 교육 분야에 적합하며 온화하고 여유롭습니다.',
    '상관격': '상관격은 월지 또는 월간에 상관이 투출한 격입니다. 상관은 뛰어난 언변과 표현력, 예술적 감각을 나타냅니다. 자유로운 사고와 개혁적 성향이 강하며, 전문직이나 예술 분야에서 성공합니다.',
    '정재격': '정재격은 월지 또는 월간에 정재가 투출한 격입니다. 정재는 정당한 노력으로 얻는 재물을 상징합니다. 근면성실하고 저축을 잘하며, 안정적인 사업이나 봉급 생활에 적합합니다.',
    '편재격': '편재격은 월지 또는 월간에 편재가 투출한 격입니다. 편재는 유동적 재물과 투기적 성향을 나타냅니다. 사업 수완이 뛰어나고 재테크 감각이 있으며, 큰 돈을 다루는 일에 적합합니다.',
    '건록격': '건록격은 일간이 월지에서 건록(임관)을 얻은 격입니다. 일간의 기운이 가장 왕성한 상태로, 자립심과 독립심이 강합니다. 스스로의 힘으로 성공하며 리더십이 뛰어납니다.',
    '양인격': '양인격은 일간이 월지에서 제왕(양인)을 얻은 격입니다. 일간의 기운이 극도로 강하여 과감하고 결단력이 있습니다. 무관, 외과의사, 운동선수 등 칼과 관련된 직업에 적합합니다.',
    
    // 특수격 (特殊格)
    '종격': '종격은 일간이 매우 약하여 다른 오행을 따르는 격입니다. 자신을 낮추고 강한 세력을 따름으로써 오히려 발복합니다. 유연성과 적응력이 뛰어나며 큰 조직에서 성공합니다.',
    '종재격': '종재격은 일간이 약하고 재성이 강하여 재성을 따르는 격입니다. 재물운이 강하고 사업 수완이 뛰어납니다. 부자 사주의 대표적인 격국입니다.',
    '종살격': '종살격은 일간이 약하고 관살이 강하여 관살을 따르는 격입니다. 권력과 명예를 얻기 쉬우며, 고위 공직자나 기업 임원으로 성공할 수 있습니다.',
    '종아격': '종아격은 일간이 약하고 식상이 강하여 식상을 따르는 격입니다. 예술적 재능이 뛰어나고 표현력이 좋습니다. 예술가, 작가, 연예인으로 성공할 수 있습니다.',
    '종강격': '종강격은 일간이 매우 강하여 비겁과 인성만으로 이루어진 격입니다. 자존심이 강하고 독립적이며, 자신만의 길을 개척합니다.',
    '화기격': '화기격은 특정 오행으로 기운이 모여 변화하는 격입니다. 큰 변화와 성취를 이룰 수 있으며, 시대를 이끄는 인물이 될 수 있습니다.',
    '곡직격': '곡직격(곡직인수격)은 갑을목 일간이 해묘미 목국을 이룬 격입니다. 인자하고 어진 성품으로 교육, 의료, 봉사 분야에서 성공합니다.',
    '염상격': '염상격은 병정화 일간이 인오술 화국을 이룬 격입니다. 열정적이고 화려하며 예술, 문화, 정치 분야에서 두각을 나타냅니다.',
    '가색격': '가색격은 무기토 일간이 진술축미 토국을 이룬 격입니다. 중후하고 신뢰가 있으며 부동산, 농업, 건설 분야에서 성공합니다.',
    '종혁격': '종혁격은 경신금 일간이 사유축 금국을 이룬 격입니다. 결단력과 실행력이 뛰어나며 금융, 제조업, 법조계에서 성공합니다.',
    '윤하격': '윤하격은 임계수 일간이 신자진 수국을 이룬 격입니다. 지혜롭고 유연하며 학문, 연구, 컨설팅 분야에서 성공합니다.',
  };
  
  // 격국명에서 핵심 키워드 추출하여 매칭
  for (const [key, desc] of Object.entries(descriptions)) {
    if (gejuName.includes(key.replace('격', ''))) {
      return desc;
    }
  }
  
  return '이 격국은 월지와 월간의 관계에서 도출된 것으로, 명주의 기본 성향과 적성을 나타냅니다.';
}

// 천간(일간/월간) 특성 설명
function getGanDescription(gan: string): string {
  const descriptions: Record<string, string> = {
    '갑': '갑목(甲木)은 큰 나무, 대들보를 상징합니다. 곧고 강직하며 리더십이 있습니다. 새로운 시작과 성장의 기운을 가지고 있어 개척 정신이 강하고 진취적입니다.',
    '을': '을목(乙木)은 풀, 넝쿨, 화초를 상징합니다. 유연하고 적응력이 뛰어나며 부드럽습니다. 예술적 감각이 있고 섬세하며 협조적인 성향입니다.',
    '병': '병화(丙火)는 태양을 상징합니다. 밝고 화려하며 열정적입니다. 리더십이 강하고 주변을 따뜻하게 비추는 카리스마가 있으며 솔직담백합니다.',
    '정': '정화(丁火)는 촛불, 등불을 상징합니다. 부드럽고 섬세하며 내면이 밝습니다. 예술적 재능과 직관력이 뛰어나고 따뜻한 배려심을 가졌습니다.',
    '무': '무토(戊土)는 산, 둑, 제방을 상징합니다. 중후하고 믿음직스러우며 포용력이 큽니다. 안정적이고 신뢰감을 주며 중재자 역할을 잘합니다.',
    '기': '기토(己土)는 논밭, 정원의 흙을 상징합니다. 부드럽고 수용적이며 실용적입니다. 세심하고 꼼꼼하며 주변을 잘 살피는 성향입니다.',
    '경': '경금(庚金)은 쇠, 칼, 바위를 상징합니다. 강하고 결단력 있으며 의리가 있습니다. 정의감이 강하고 냉철한 판단력을 가졌습니다.',
    '신': '신금(辛金)은 보석, 귀금속을 상징합니다. 섬세하고 예민하며 아름다움을 추구합니다. 완벽주의 성향이 있고 예술적 감각이 뛰어납니다.',
    '임': '임수(壬水)는 바다, 강물, 큰 물을 상징합니다. 지혜롭고 유연하며 포용력이 큽니다. 창의적이고 진취적이며 변화를 두려워하지 않습니다.',
    '계': '계수(癸水)는 비, 이슬, 샘물을 상징합니다. 부드럽고 침착하며 인내심이 강합니다. 직관력과 영감이 뛰어나고 내면이 깊습니다.',
  };
  return descriptions[gan] || `${gan}의 특성입니다.`;
}

// 지지(일지/월지) 특성 설명
function getZhiDescription(zhi: string): string {
  const descriptions: Record<string, string> = {
    '자': '자수(子水)는 쥐띠로 밤 23시~01시를 관장합니다. 지혜롭고 영리하며 적응력이 뛰어납니다. 새로운 시작의 기운을 가지며 번식력과 생명력을 상징합니다.',
    '축': '축토(丑土)는 소띠로 새벽 01시~03시를 관장합니다. 성실하고 우직하며 인내심이 강합니다. 금고의 역할로 재물을 저장하는 기운이 있습니다.',
    '인': '인목(寅木)은 호랑이띠로 새벽 03시~05시를 관장합니다. 용맹하고 진취적이며 리더십이 있습니다. 봄의 시작으로 새로운 출발의 기운입니다.',
    '묘': '묘목(卯木)은 토끼띠로 아침 05시~07시를 관장합니다. 온화하고 예술적이며 사교적입니다. 봄의 꽃처럼 화사하고 생기 있는 기운입니다.',
    '진': '진토(辰土)는 용띠로 아침 07시~09시를 관장합니다. 변화무쌍하고 신비로우며 큰 꿈을 품습니다. 수고(水庫)로 물을 저장하는 역할을 합니다.',
    '사': '사화(巳火)는 뱀띠로 오전 09시~11시를 관장합니다. 지혜롭고 신중하며 통찰력이 있습니다. 여름의 시작으로 열정이 피어나는 기운입니다.',
    '오': '오화(午火)는 말띠로 낮 11시~13시를 관장합니다. 활동적이고 열정적이며 정열적입니다. 태양이 가장 높이 뜬 시간으로 최고의 양기를 가집니다.',
    '미': '미토(未土)는 양띠로 오후 13시~15시를 관장합니다. 온순하고 예술적이며 다재다능합니다. 목고(木庫)로 목의 기운을 저장합니다.',
    '신': '신금(申金)은 원숭이띠로 오후 15시~17시를 관장합니다. 영리하고 재치있으며 다재다능합니다. 가을의 시작으로 결실을 맺기 시작하는 기운입니다.',
    '유': '유금(酉金)은 닭띠로 저녁 17시~19시를 관장합니다. 정확하고 예리하며 미적 감각이 뛰어납니다. 가을의 수확처럼 결실과 완성의 기운입니다.',
    '술': '술토(戌土)는 개띠로 저녁 19시~21시를 관장합니다. 충직하고 의리있으며 보호적입니다. 화고(火庫)로 화의 기운을 저장합니다.',
    '해': '해수(亥水)는 돼지띠로 밤 21시~23시를 관장합니다. 정직하고 순수하며 복이 많습니다. 겨울의 시작으로 저장과 휴식의 기운입니다.',
  };
  return descriptions[zhi] || `${zhi}의 특성입니다.`;
}

// 일주(천간+지지 조합) 특성 설명 - 60갑자 (장점, 단점 포함)
function getIljuDescription(gan: string, zhi: string): string {
  const ilju = gan + zhi;
  const descriptions: Record<string, string> = {
    // 갑(甲) 일주
    '갑자': '갑자일주는 큰 나무가 깊은 물 위에 떠 있는 형상으로, 해중금(海中金)에 해당합니다. [장점] 지혜롭고 창의적이며 학문에 뛰어납니다. 독립심이 강하고 새로운 것을 개척하는 능력이 있으며, 직관력과 통찰력이 탁월합니다. 리더십이 있고 큰 그림을 그릴 줄 압니다. [단점] 고집이 세고 타협을 잘 못합니다. 감정 기복이 있을 수 있고, 외로움을 잘 타며 속마음을 잘 드러내지 않아 오해를 받기 쉽습니다. 현실보다 이상을 추구하는 경향이 있습니다.',
    '갑인': '갑인일주는 호랑이 위에 큰 나무가 서 있는 형상으로, 대계수(大溪水)에 해당합니다. [장점] 기백이 넘치고 리더십이 강하며 진취적입니다. 도전 정신이 강하고 큰 뜻을 품으며, 자신감이 넘치고 추진력이 좋습니다. 정의감이 강하고 불의를 참지 못합니다. [단점] 성격이 급하고 참을성이 부족합니다. 자존심이 강해 남의 말을 잘 듣지 않고, 독단적으로 행동할 수 있습니다. 승부욕이 지나쳐 무리하는 경향이 있습니다.',
    '갑진': '갑진일주는 용이 나무를 타고 하늘로 오르는 형상으로, 복등화(覆燈火)에 해당합니다. [장점] 변화와 발전의 기운이 강하고 큰 포부를 가집니다. 신비로운 매력이 있고 카리스마가 뛰어납니다. 창의적이고 독창적인 아이디어가 많으며 큰 성공을 이룰 잠재력이 있습니다. [단점] 변덕이 심하고 한 가지에 집중하기 어렵습니다. 현실 감각이 부족하고 이상만 추구하다 실패할 수 있습니다. 인간관계에서 갈등이 생기기 쉽습니다.',
    '갑오': '갑오일주는 밝은 햇살 아래 나무가 무성한 형상으로, 사중금(砂中金)에 해당합니다. [장점] 활동적이고 열정적이며 밝은 성격입니다. 명예욕이 있고 사회적 인정을 받으려 노력합니다. 표현력이 좋고 대인관계가 원만하며 인기가 많습니다. [단점] 허영심이 있고 체면을 중시합니다. 감정적으로 행동하기 쉽고 충동적인 결정을 할 수 있습니다. 참을성이 부족하고 끈기가 약합니다.',
    '갑신': '갑신일주는 도끼가 나무를 다듬는 형상으로, 천중수(泉中水)에 해당합니다. [장점] 재능을 갈고 닦아 성공하는 타입입니다. 결단력 있고 실행력이 강하며 일처리가 깔끔합니다. 분석력이 뛰어나고 현실적입니다. [단점] 날카롭고 비판적이어서 주변과 마찰이 있을 수 있습니다. 스트레스를 많이 받고 신경이 예민합니다. 완벽주의 성향으로 자신과 타인에게 엄격합니다.',
    '갑술': '갑술일주는 산 위에 큰 나무가 서 있는 형상으로, 산두화(山頭火)에 해당합니다. [장점] 고고하고 독립적이며 원칙을 중시합니다. 말년에 크게 성공하는 기운이 있고 끈기와 인내력이 강합니다. 신뢰감을 주고 책임감이 강합니다. [단점] 고집이 세고 융통성이 부족합니다. 외골수적인 면이 있어 대인관계가 좁을 수 있습니다. 초년에는 고생이 많을 수 있습니다.',
    
    // 을(乙) 일주
    '을축': '을축일주는 겨울 땅에 화초가 뿌리내린 형상으로, 해중금(海中金)에 해당합니다. [장점] 인내심이 강하고 꾸준합니다. 어려운 환경에서도 적응하며 끈기 있게 성장합니다. 착실하고 성실하며 재물을 모으는 능력이 있습니다. [단점] 소극적이고 자신감이 부족할 수 있습니다. 변화를 두려워하고 보수적입니다. 감정을 억누르다 폭발할 수 있습니다.',
    '을묘': '을묘일주는 봄 정원의 화초가 활짝 핀 형상으로, 대계수(大溪水)에 해당합니다. [장점] 아름답고 예술적이며 사교성이 뛰어납니다. 화목하고 평화를 사랑하며 인복이 좋습니다. 감성이 풍부하고 섬세합니다. [단점] 우유부단하고 결단력이 부족합니다. 의존적인 면이 있고 독립성이 약합니다. 감정에 치우쳐 판단하기 쉽습니다.',
    '을사': '을사일주는 불 옆에 꽃이 핀 형상으로, 복등화(覆燈火)에 해당합니다. [장점] 화려하고 총명하며 언변이 뛰어납니다. 변화에 민감하고 적응력이 좋습니다. 재치 있고 순발력이 뛰어납니다. [단점] 변덕스럽고 불안정할 수 있습니다. 질투심이 강하고 예민합니다. 한 가지에 오래 집중하기 어렵습니다.',
    '을미': '을미일주는 여름 정원의 풀이 무성한 형상으로, 사중금(砂中金)에 해당합니다. [장점] 온화하고 다정다감하며 예술적입니다. 감성이 풍부하고 섬세하며 배려심이 깊습니다. 음식이나 예술에 재능이 있습니다. [단점] 우울해지기 쉽고 감정 기복이 있습니다. 우유부단하고 걱정이 많습니다. 자기 주장이 약할 수 있습니다.',
    '을유': '을유일주는 가을 정원의 꽃이 시드는 형상으로, 천중수(泉中水)에 해당합니다. [장점] 섬세하고 예민하며 완벽을 추구합니다. 미적 감각이 뛰어나고 예술적 재능이 있습니다. 분석력이 좋습니다. [단점] 지나치게 예민하여 스트레스를 많이 받습니다. 비관적이 되기 쉽고 자존감이 낮아질 수 있습니다. 건강에 신경 써야 합니다.',
    '을해': '을해일주는 겨울 연못의 연꽃 형상으로, 산두화(山頭火)에 해당합니다. [장점] 순수하고 고결하며 지혜롭습니다. 내면의 아름다움을 간직하고 복이 많습니다. 학문에 뛰어나고 영적인 감각이 있습니다. [단점] 현실 감각이 부족하고 이상적입니다. 외로움을 잘 타고 소외감을 느끼기 쉽습니다. 실행력이 부족할 수 있습니다.',
    
    // 병(丙) 일주
    '병자': '병자일주는 태양이 물에 비치는 형상으로, 간하수(澗下水)에 해당합니다. [장점] 밝고 총명하며 지혜롭습니다. 겉으로는 화려하면서 내면에 깊은 생각을 품습니다. 학문과 예술에 재능이 있고 직관력이 뛰어납니다. 매력적이고 인기가 많습니다. [단점] 내면의 갈등이 많고 감정 기복이 있습니다. 겉과 속이 다른 이중성이 있을 수 있습니다. 연애에서 문제가 생기기 쉽고 배우자 운에 신경 써야 합니다. 물과 불의 충돌로 건강 관리가 필요합니다.',
    '병인': '병인일주는 해 뜨는 산의 호랑이 형상으로, 노중화(爐中火)에 해당합니다. [장점] 위엄 있고 카리스마가 넘칩니다. 권위와 명예를 중시하며 리더십이 강합니다. 용맹하고 추진력이 뛰어나며 큰 일을 도모합니다. [단점] 자존심이 강하고 고집이 셉니다. 타협을 잘 못하고 융통성이 부족합니다. 성격이 급하고 충동적일 수 있습니다.',
    '병진': '병진일주는 태양이 용과 함께 승천하는 형상으로, 사중토(砂中土)에 해당합니다. [장점] 큰 꿈을 가지고 높이 날아오릅니다. 변화와 성공의 기운이 강하고 비범한 재능이 있습니다. 창의적이고 리더십이 뛰어납니다. [단점] 변덕이 심하고 안정감이 부족합니다. 현실보다 이상을 추구하여 실패할 수 있습니다. 인간관계에서 갈등이 생기기 쉽습니다.',
    '병오': '병오일주는 한낮의 태양이 정점에 오른 형상으로, 천하수(天河水)에 해당합니다. [장점] 열정적이고 활동적이며 에너지가 넘칩니다. 정열과 의지가 강하고 밝고 긍정적입니다. 카리스마가 있고 인기가 많습니다. [단점] 너무 뜨거워서 타인을 지치게 할 수 있습니다. 조급하고 참을성이 부족합니다. 화를 잘 내고 감정 조절이 어렵습니다.',
    '병신': '병신일주는 태양이 금속을 달구는 형상으로, 산하화(山下火)에 해당합니다. [장점] 결단력 있고 추진력이 강합니다. 일을 성사시키는 능력이 뛰어나고 실행력이 좋습니다. 현실적이고 실용적입니다. [단점] 날카롭고 비판적이어서 주변과 마찰이 있습니다. 스트레스를 많이 받고 신경이 예민합니다. 타인에게 상처를 주기 쉽습니다.',
    '병술': '병술일주는 저녁노을이 산에 비치는 형상으로, 옥상토(屋上土)에 해당합니다. [장점] 따뜻하고 충직하며 의리가 있습니다. 말년까지 열정을 유지하고 끈기가 있습니다. 신뢰감을 주고 책임감이 강합니다. [단점] 고집이 세고 융통성이 부족합니다. 지나치게 원칙적이어서 딱딱해 보입니다. 초년에 고생이 많을 수 있습니다.',
    
    // 정(丁) 일주
    '정축': '정축일주는 어둠 속 등불이 빛나는 형상으로, 간하수(澗下水)에 해당합니다. [장점] 은은하고 깊은 지혜가 있습니다. 묵묵히 자신의 길을 가며 인내심이 강합니다. 착실하고 성실하며 재물 복이 있습니다. [단점] 소극적이고 자기 표현이 부족합니다. 외로움을 잘 타고 우울해지기 쉽습니다. 변화를 두려워합니다.',
    '정묘': '정묘일주는 봄밤의 촛불 형상으로, 노중화(爐中火)에 해당합니다. [장점] 따뜻하고 부드러우며 예술적입니다. 섬세하고 감성이 풍부하며 인복이 좋습니다. 화목하고 사교성이 뛰어납니다. [단점] 우유부단하고 결단력이 부족합니다. 감정에 치우쳐 판단하기 쉽습니다. 의존적인 면이 있습니다.',
    '정사': '정사일주는 불꽃이 타오르는 형상으로, 사중토(砂中土)에 해당합니다. [장점] 열정적이고 지혜로우며 통찰력이 있습니다. 비범한 재능을 가지고 총명합니다. 언변이 뛰어나고 설득력이 강합니다. [단점] 예민하고 신경질적일 수 있습니다. 변덕이 있고 감정 기복이 심합니다. 건강 관리가 필요합니다.',
    '정미': '정미일주는 여름밤의 등불 형상으로, 천하수(天河水)에 해당합니다. [장점] 따뜻하고 포근하며 예술성이 높습니다. 음식과 관련된 재능이 있고 손재주가 좋습니다. 배려심이 깊고 인복이 좋습니다. [단점] 걱정이 많고 소심할 수 있습니다. 우울해지기 쉽고 자존감이 낮아질 때가 있습니다. 건강에 신경 써야 합니다.',
    '정유': '정유일주는 가을밤의 횃불 형상으로, 산하화(山下火)에 해당합니다. [장점] 예리하고 정확하며 미적 감각이 뛰어납니다. 완성도를 추구하고 분석력이 좋습니다. 섬세하고 꼼꼼합니다. [단점] 지나치게 예민하고 비판적입니다. 완벽주의로 스트레스를 많이 받습니다. 대인관계에서 마찰이 있을 수 있습니다.',
    '정해': '정해일주는 겨울밤의 등대 형상으로, 옥상토(屋上土)에 해당합니다. [장점] 지혜롭고 인자하며 희생정신이 있습니다. 어둠을 밝히는 역할을 하며 영적인 감각이 뛰어납니다. 복이 많고 말년이 좋습니다. [단점] 현실 감각이 부족하고 이상적입니다. 외로움을 잘 타고 고독합니다. 실행력이 부족할 수 있습니다.',
    
    // 무(戊) 일주
    '무자': '무자일주는 큰 산 아래 깊은 물이 있는 형상으로, 벽력화(霹靂火)에 해당합니다. [장점] 중후하면서도 지혜롭습니다. 깊은 생각과 넓은 포용력을 가지고 있어 큰 그릇입니다. 학문에 뛰어나고 직관력이 좋습니다. [단점] 내면의 갈등이 많고 우울해지기 쉽습니다. 겉과 속이 달라 오해를 받을 수 있습니다. 이성 관계에 신경 써야 합니다.',
    '무인': '무인일주는 호랑이가 산을 지키는 형상으로, 성두토(城頭土)에 해당합니다. [장점] 위엄 있고 신뢰감을 줍니다. 책임감이 강하고 리더십이 있으며 대인배 기질이 있습니다. 용감하고 추진력이 좋습니다. [단점] 고집이 세고 융통성이 부족합니다. 자존심이 강해 타협을 잘 못합니다. 성격이 급할 수 있습니다.',
    '무진': '무진일주는 산 위에 구름이 피어오르는 형상으로, 대림목(大林木)에 해당합니다. [장점] 포부가 크고 변화무쌍합니다. 큰 일을 도모하는 기운이 있고 재물 복이 좋습니다. 창의적이고 비범합니다. [단점] 고집이 세고 독선적일 수 있습니다. 변덕이 있고 안정감이 부족합니다. 인간관계에서 갈등이 생기기 쉽습니다.',
    '무오': '무오일주는 뜨거운 사막의 모래 언덕 형상으로, 천상화(天上火)에 해당합니다. [장점] 열정적이고 의지가 강합니다. 뜨거운 의지로 목표를 향해 나아가며 추진력이 좋습니다. 밝고 긍정적입니다. [단점] 고집이 세고 융통성이 없습니다. 너무 뜨거워서 타인을 지치게 합니다. 참을성이 부족하고 급합니다.',
    '무신': '무신일주는 산 속에 광물이 묻힌 형상으로, 대역토(大驛土)에 해당합니다. [장점] 내면에 재능을 숨기고 있습니다. 실속을 추구하며 실리적이고 현실적입니다. 분석력이 좋고 일처리가 깔끔합니다. [단점] 속마음을 잘 드러내지 않아 오해를 받습니다. 계산적으로 보일 수 있습니다. 인간관계가 넓지 않습니다.',
    '무술': '무술일주는 높은 산이 우뚝 솟은 형상으로, 평지목(平地木)에 해당합니다. [장점] 고고하고 독립적이며 원칙적입니다. 흔들림 없는 신념을 가지고 신뢰감을 줍니다. 끈기와 인내력이 강합니다. [단점] 고집이 세고 융통성이 부족합니다. 외골수적이어서 대인관계가 좁습니다. 고독하고 외로울 수 있습니다.',
    
    // 기(己) 일주
    '기축': '기축일주는 비옥한 논밭 형상으로, 벽력화(霹靂火)에 해당합니다. [장점] 성실하고 근면하며 재물복이 있습니다. 착실하게 재산을 모으고 검소합니다. 인내심이 강하고 꾸준합니다. [단점] 소심하고 걱정이 많습니다. 변화를 두려워하고 보수적입니다. 자기 표현이 부족합니다.',
    '기묘': '기묘일주는 봄 정원의 기름진 땅 형상으로, 성두토(城頭土)에 해당합니다. [장점] 부드럽고 예술적이며 사교적입니다. 인복이 좋고 화목하며 대인관계가 원만합니다. 감성이 풍부합니다. [단점] 우유부단하고 결단력이 부족합니다. 의존적인 면이 있고 독립성이 약합니다. 감정에 치우칩니다.',
    '기사': '기사일주는 뜨거운 땅의 형상으로, 대림목(大林木)에 해당합니다. [장점] 열정적이면서도 세심합니다. 일처리가 꼼꼼하고 추진력이 있습니다. 총명하고 언변이 뛰어납니다. [단점] 예민하고 신경질적일 수 있습니다. 걱정이 많고 불안해합니다. 건강 관리가 필요합니다.',
    '기미': '기미일주는 여름 들판의 비옥한 땅 형상으로, 천상화(天上火)에 해당합니다. [장점] 온순하고 배려심이 깊습니다. 음식이나 예술에 재능이 있고 손재주가 좋습니다. 인복이 좋습니다. [단점] 우울해지기 쉽고 걱정이 많습니다. 소심하고 자기 주장이 약합니다. 건강에 신경 써야 합니다.',
    '기유': '기유일주는 가을 들판의 황금빛 땅 형상으로, 대역토(大驛土)에 해당합니다. [장점] 세밀하고 정확하며 실용적입니다. 결실을 맺는 기운이 있고 재물 복이 좋습니다. 분석력이 뛰어납니다. [단점] 예민하고 비판적입니다. 완벽주의로 스트레스를 받습니다. 대인관계에서 마찰이 있을 수 있습니다.',
    '기해': '기해일주는 겨울 논의 휴식 형상으로, 평지목(平地木)에 해당합니다. [장점] 순수하고 복이 많습니다. 내면을 가꾸며 지혜를 쌓고 학문에 뛰어납니다. 말년이 좋습니다. [단점] 현실 감각이 부족하고 이상적입니다. 게으를 수 있고 실행력이 부족합니다. 외로움을 잘 탑니다.',
    
    // 경(庚) 일주
    '경자': '경자일주는 차가운 물속의 금속 형상으로, 벽상토(壁上土)에 해당합니다. [장점] 냉철하고 지혜로우며 결단력이 있습니다. 머리가 좋고 판단력이 뛰어나며 학문에 재능이 있습니다. 총명합니다. [단점] 차갑고 냉정하여 정이 없어 보입니다. 고독하고 외로울 수 있습니다. 감정 표현이 서툽니다.',
    '경인': '경인일주는 산 속의 광맥 형상으로, 송백목(松柏木)에 해당합니다. [장점] 강인하고 진취적이며 도전적입니다. 개척 정신이 강하고 추진력이 좋습니다. 용감하고 의리가 있습니다. [단점] 성격이 급하고 충동적입니다. 마찰이 많고 갈등이 생기기 쉽습니다. 타협을 잘 못합니다.',
    '경진': '경진일주는 구름 속 번개 형상으로, 백랍금(白蠟金)에 해당합니다. [장점] 변화무쌍하고 비범합니다. 큰 변화와 성취를 이루며 재능이 뛰어납니다. 카리스마가 있습니다. [단점] 변덕이 심하고 안정감이 부족합니다. 인간관계에서 갈등이 많습니다. 고집이 셉니다.',
    '경오': '경오일주는 뜨거운 불에 달궈지는 쇠 형상으로, 노방토(路傍土)에 해당합니다. [장점] 열정적이고 결단력 있습니다. 단련을 통해 성공하며 의지가 강합니다. 추진력이 좋습니다. [단점] 성격이 급하고 충동적입니다. 화를 잘 내고 감정 조절이 어렵습니다. 인내심이 부족합니다.',
    '경신': '경신일주는 순수한 금속 덩어리 형상으로, 석류목(石榴木)에 해당합니다. [장점] 강직하고 의리가 있습니다. 자존심이 강하고 정의로우며 원칙을 중시합니다. 결단력이 있습니다. [단점] 고집이 세고 융통성이 없습니다. 타협을 잘 못하고 독선적입니다. 대인관계가 좁을 수 있습니다.',
    '경술': '경술일주는 산 속에 묻힌 광석 형상으로, 채천금(釵釧金)에 해당합니다. [장점] 충직하고 의리있으며 묵묵히 실력을 쌓습니다. 신뢰감을 주고 책임감이 강합니다. 끈기가 있습니다. [단점] 고집이 세고 융통성이 부족합니다. 고독하고 외로울 수 있습니다. 표현이 서툽니다.',
    
    // 신(辛) 일주
    '신축': '신축일주는 땅 속에 묻힌 보석 형상으로, 벽상토(壁上土)에 해당합니다. [장점] 내면의 가치가 빛납니다. 인내하며 때를 기다리고 끈기가 있습니다. 착실하고 재물 복이 있습니다. [단점] 자기 표현이 부족하고 소극적입니다. 외로움을 잘 타고 우울해지기 쉽습니다. 변화를 두려워합니다.',
    '신묘': '신묘일주는 봄 새벽의 이슬 맺힌 보석 형상으로, 송백목(松柏木)에 해당합니다. [장점] 섬세하고 아름답습니다. 예술적 재능이 뛰어나고 감성이 풍부합니다. 사교성이 좋습니다. [단점] 예민하고 상처받기 쉽습니다. 우유부단하고 결단력이 부족합니다. 의존적인 면이 있습니다.',
    '신사': '신사일주는 불꽃에 빛나는 보석 형상으로, 백랍금(白蠟金)에 해당합니다. [장점] 화려하고 총명합니다. 재능이 빛을 발하며 언변이 뛰어납니다. 매력적이고 인기가 많습니다. [단점] 변덕스럽고 예민합니다. 질투심이 강하고 감정 기복이 있습니다. 건강 관리가 필요합니다.',
    '신미': '신미일주는 따뜻한 땅의 보석 형상으로, 노방토(路傍土)에 해당합니다. [장점] 온화하면서도 가치있습니다. 예술과 미에 재능이 있고 손재주가 좋습니다. 인복이 좋습니다. [단점] 우울해지기 쉽고 걱정이 많습니다. 소심하고 자기 주장이 약합니다. 건강에 신경 써야 합니다.',
    '신유': '신유일주는 순수한 보석 그 자체로, 석류목(石榴木)에 해당합니다. [장점] 완벽을 추구하고 미적 감각이 뛰어납니다. 자존심이 강하고 품격이 있습니다. 섬세하고 꼼꼼합니다. [단점] 지나치게 예민하고 비판적입니다. 자존심 때문에 손해를 볼 수 있습니다. 대인관계가 좁습니다.',
    '신해': '신해일주는 바다의 진주 형상으로, 채천금(釵釧金)에 해당합니다. [장점] 순수하고 아름다우며 지혜롭습니다. 복이 많고 학문에 뛰어납니다. 말년이 좋습니다. [단점] 현실 감각이 부족하고 이상적입니다. 외로움을 잘 타고 고독합니다. 실행력이 부족할 수 있습니다.',
    
    // 임(壬) 일주
    '임자': '임자일주는 큰 바다의 형상으로, 상자목(桑柘木)에 해당합니다. [장점] 지혜가 깊고 포용력이 큽니다. 큰 그릇으로 많은 것을 담으며 학문에 뛰어납니다. 총명하고 창의적입니다. [단점] 우유부단하고 결단력이 부족합니다. 변덕이 있고 한 가지에 집중하기 어렵습니다. 방향성을 잃기 쉽습니다.',
    '임인': '임인일주는 산에서 흘러내리는 폭포 형상으로, 금박금(金箔金)에 해당합니다. [장점] 진취적이고 힘이 넘칩니다. 새로운 것을 개척하고 추진력이 좋습니다. 용감하고 리더십이 있습니다. [단점] 성격이 급하고 충동적입니다. 지속력이 부족하고 쉽게 포기합니다. 인내심이 약합니다.',
    '임진': '임진일주는 용이 구름을 타고 승천하는 형상으로, 장류수(長流水)에 해당합니다. [장점] 비범하고 큰 뜻을 품습니다. 크게 성공할 기운이 있고 재능이 뛰어납니다. 카리스마가 있습니다. [단점] 변덕이 심하고 안정감이 부족합니다. 고집이 세고 타협을 잘 못합니다. 인간관계에서 갈등이 있습니다.',
    '임오': '임오일주는 뜨거운 태양 아래 물이 증발하는 형상으로, 양류목(楊柳木)에 해당합니다. [장점] 열정과 지혜가 공존합니다. 변화에 능하고 적응력이 좋습니다. 밝고 활동적입니다. [단점] 내면의 갈등이 많고 불안정합니다. 감정 기복이 심하고 충동적입니다. 건강 관리가 필요합니다.',
    '임신': '임신일주는 금생수로 맑은 샘물이 솟는 형상으로, 검봉금(劍鋒金)에 해당합니다. [장점] 총명하고 재능이 뛰어납니다. 학문에 뛰어나고 분석력이 좋습니다. 날카롭고 명석합니다. [단점] 예민하고 신경질적입니다. 비판적이고 날카로워 주변과 마찰이 있습니다. 스트레스를 많이 받습니다.',
    '임술': '임술일주는 산 속 깊은 호수 형상으로, 대해수(大海水)에 해당합니다. [장점] 깊고 고요하며 지혜롭습니다. 내면이 깊고 학문에 뛰어납니다. 신뢰감을 주고 포용력이 있습니다. [단점] 고독하고 외로울 수 있습니다. 속마음을 잘 드러내지 않아 오해를 받습니다. 우울해지기 쉽습니다.',
    
    // 계(癸) 일주
    '계축': '계축일주는 겨울 논의 빗물 형상으로, 상자목(桑柘木)에 해당합니다. [장점] 차분하고 인내심이 강합니다. 묵묵히 실력을 쌓고 착실합니다. 재물 복이 있습니다. [단점] 소극적이고 자기 표현이 부족합니다. 외로움을 잘 타고 우울해지기 쉽습니다. 변화를 두려워합니다.',
    '계묘': '계묘일주는 봄비가 내리는 형상으로, 금박금(金箔金)에 해당합니다. [장점] 부드럽고 생명력을 키웁니다. 성장과 발전의 기운이 있고 인복이 좋습니다. 예술적 감각이 뛰어납니다. [단점] 우유부단하고 결단력이 부족합니다. 의존적인 면이 있습니다. 감정에 치우칩니다.',
    '계사': '계사일주는 불과 물이 만나는 형상으로, 장류수(長流水)에 해당합니다. [장점] 지혜롭고 통찰력이 있습니다. 변화와 적응에 능하고 총명합니다. 비범한 재능이 있습니다. [단점] 내면의 갈등이 많고 불안정합니다. 예민하고 신경질적입니다. 건강 관리가 필요합니다.',
    '계미': '계미일주는 여름비가 들판을 적시는 형상으로, 양류목(楊柳木)에 해당합니다. [장점] 온화하고 자상합니다. 주변을 잘 보살피고 배려심이 깊습니다. 인복이 좋습니다. [단점] 걱정이 많고 우울해지기 쉽습니다. 소심하고 자기 주장이 약합니다. 건강에 신경 써야 합니다.',
    '계유': '계유일주는 가을이슬이 빛나는 형상으로, 검봉금(劍鋒金)에 해당합니다. [장점] 맑고 깨끗하며 총명합니다. 섬세한 재능이 있고 분석력이 뛰어납니다. 학문에 재능이 있습니다. [단점] 지나치게 예민하고 비판적입니다. 차갑고 냉정해 보일 수 있습니다. 스트레스를 많이 받습니다.',
    '계해': '계해일주는 큰 바다의 형상으로, 대해수(大海水)에 해당합니다. [장점] 지혜가 무궁무진합니다. 포용력이 크고 복이 많으며 학문에 뛰어납니다. 큰 그릇입니다. [단점] 우유부단하고 결단력이 부족합니다. 방향성을 잃기 쉽고 게으를 수 있습니다. 현실 감각이 부족합니다.',
  };
  
  return descriptions[ilju] || `${ilju}일주는 ${gan}(천간)과 ${zhi}(지지)의 조합으로 형성됩니다. 이 일주는 독특한 기질과 특성을 가지며, 천간의 성질과 지지의 기운이 조화를 이루어 명주의 기본 성격과 운명을 결정합니다.`;
}

// 프로필을 API 요청 형식으로 변환
function profileToSajuRequest(profile: Profile): SajuRequest {
  // 시진 형식(HH:MM) 또는 'unknown' 처리
  let hour = 12; // 기본값 (오시 중간)
  let minute = 0;
  
  if (profile.birth_hour && profile.birth_hour !== 'unknown') {
    const parts = profile.birth_hour.split(':').map(Number);
    hour = parts[0] || 12;
    minute = parts[1] || 0;
  }
  
  const isLunar = profile.calendar_type === 'lunar' || profile.calendar_type === 'lunar_leap';
  const isLeapMonth = profile.calendar_type === 'lunar_leap';
  return {
    name: profile.name,
    gender: profile.gender,
    year: profile.birth_year,
    month: profile.birth_month,
    day: profile.birth_day,
    hour,
    minute,
    is_lunar: isLunar,
    is_leap_month: isLeapMonth,
    target_year: new Date().getFullYear(),
  };
}

// Pillar 타입 정의
interface PillarDisplay {
  time: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  topLabel: string;
  bottomLabel: string;
  topWuxing: string;
  bottomWuxing: string;
}

// 분석 결과에서 사주 원국 표시 데이터 생성
function createPillarsFromResult(result: SajuAnalysisResponse): PillarDisplay[] {
  const createPillar = (time: string, gan: string, zhi: string): PillarDisplay => {
    const ganWx = ganWuxing[gan] || '?';
    const zhiWx = zhiWuxing[zhi] || '?';
    return {
      time,
      top: ganHanja[gan] || gan,
      topColor: wuxingColorMap[ganWx] || 'text-white',
      bottom: zhiHanja[zhi] || zhi,
      bottomColor: wuxingColorMap[zhiWx] || 'text-white',
      topLabel: gan,
      bottomLabel: zhi,
      topWuxing: ganWx,
      bottomWuxing: zhiWx,
    };
  };

  return [
    createPillar('시주', result.pillars.hour.gan, result.pillars.hour.zhi),
    createPillar('일주', result.pillars.day.gan, result.pillars.day.zhi),
    createPillar('월주', result.pillars.month.gan, result.pillars.month.zhi),
    createPillar('연주', result.pillars.year.gan, result.pillars.year.zhi),
  ];
}

// 세션 스토리지 캐시 키
const CACHE_KEY = 'saju_analysis_cache';

// 캐시에서 분석 결과 가져오기
function getCachedAnalysis(profileId: string): { profile: Profile; result: SajuAnalysisResponse; pillars: PillarDisplay[] } | null {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    console.log('[Cache] 캐시 확인:', profileId, cached ? '있음' : '없음');
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    console.log('[Cache] 캐시 profileId:', data.profileId, '요청 profileId:', profileId, '일치:', data.profileId === profileId);
    if (data.profileId === profileId && data.result?.success) {
      console.log('[Cache] 캐시 히트!');
      return { profile: data.profile, result: data.result, pillars: data.pillars };
    }
    console.log('[Cache] 캐시 미스 (profileId 불일치 또는 result 없음)');
    return null;
  } catch (e) {
    console.error('[Cache] 캐시 읽기 오류:', e);
    return null;
  }
}

// 분석 결과를 캐시에 저장
function setCachedAnalysis(profileId: string, profile: Profile, result: SajuAnalysisResponse, pillars: PillarDisplay[]) {
  try {
    const cacheData = {
      profileId,
      profile,
      result,
      pillars,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log('[Cache] 캐시 저장 완료:', profileId, profile.name);
  } catch (e) {
    console.error('[Cache] 캐시 저장 오류:', e);
  }
}

// DB에서 저장된 분석 결과 불러오기 (기기 ID 또는 회원 ID로 조회)
async function loadSavedAnalysis(deviceId: string, userId: string | null, profile: Profile): Promise<{ result: SajuAnalysisResponse; pillars: PillarDisplay[] } | null> {
  try {
    // 먼저 회원 ID로 조회 (회원인 경우)
    if (userId) {
      const { data, error } = await supabase
        .from('saju_results')
        .select('*')
        .eq('user_id', userId)
        .eq('name', profile.name)
        .eq('birth_date', profile.birthDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        console.log('[DB] 회원 저장 결과 로드:', data.name);
        return convertDbDataToResult(data);
      }
    }

    // 기기 ID로 조회
    const { data, error } = await supabase
      .from('saju_results')
      .select('*')
      .eq('device_id', deviceId)
      .eq('name', profile.name)
      .eq('birth_date', profile.birthDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('[DB] 저장된 분석 결과 없음');
      return null;
    }

    console.log('[DB] 기기 저장 결과 로드:', data.name);
    return convertDbDataToResult(data);
  } catch (e) {
    console.error('[DB] 분석 결과 로드 오류:', e);
    return null;
  }
}

// DB 데이터를 결과 객체로 변환
function convertDbDataToResult(data: Record<string, unknown>): { result: SajuAnalysisResponse; pillars: PillarDisplay[] } {
  const result: SajuAnalysisResponse = {
    success: true,
    processing_time_ms: 0,
    pillars: data.pillars as SajuAnalysisResponse['pillars'],
    day_master: data.day_master as SajuAnalysisResponse['day_master'],
    geju: data.geju as SajuAnalysisResponse['geju'],
    yongshen: data.yongshen as SajuAnalysisResponse['yongshen'],
    wuxing_balance: data.wuxing_balance as SajuAnalysisResponse['wuxing_balance'],
    synthesis: (data.synthesis as string) || '',
    easy_explanation: (data.easy_explanation as string) || '',
    classical_references: (data.classical_references as SajuAnalysisResponse['classical_references']) || [],
  };

  const pillars = createPillarsFromResult(result);
  return { result, pillars };
}

// 분석 결과를 DB에 저장 (기기 ID 기반, 회원인 경우 user_id도 저장)
async function saveAnalysisToDb(deviceId: string, userId: string | null, profile: Profile, result: SajuAnalysisResponse): Promise<boolean> {
  try {
    // 기존 결과가 있는지 확인 (기기 ID로)
    const { data: existingByDevice } = await supabase
      .from('saju_results')
      .select('id')
      .eq('device_id', deviceId)
      .eq('name', profile.name)
      .eq('birth_date', profile.birthDate)
      .limit(1)
      .single();

    // 회원인 경우 user_id로도 확인
    let existingByUser = null;
    if (userId) {
      const { data } = await supabase
        .from('saju_results')
        .select('id')
        .eq('user_id', userId)
        .eq('name', profile.name)
        .eq('birth_date', profile.birthDate)
        .limit(1)
        .single();
      existingByUser = data;
    }

    const existing = existingByDevice || existingByUser;

    if (existing) {
      // 기존 결과 업데이트
      const updateData: Record<string, unknown> = {
        device_id: deviceId,
        pillars: result.pillars,
        day_master: result.day_master,
        geju: result.geju,
        yongshen: result.yongshen,
        wuxing_balance: result.wuxing_balance,
        synthesis: result.synthesis,
        easy_explanation: result.easy_explanation,
        classical_references: result.classical_references,
        updated_at: new Date().toISOString(),
      };
      
      // 회원인 경우 user_id도 업데이트
      if (userId) {
        updateData.user_id = userId;
      }

      const { error } = await supabase
        .from('saju_results')
        .update(updateData)
        .eq('id', existing.id);

      if (error) throw error;
      console.log('[DB] 분석 결과 업데이트 완료');
    } else {
      // 새 결과 삽입
      const insertData: Record<string, unknown> = {
        device_id: deviceId,
        name: profile.name,
        birth_date: profile.birthDate,
        birth_time: profile.birthTime || null,
        is_lunar: profile.isLunar || false,
        gender: profile.gender,
        pillars: result.pillars,
        day_master: result.day_master,
        geju: result.geju,
        yongshen: result.yongshen,
        wuxing_balance: result.wuxing_balance,
        synthesis: result.synthesis,
        easy_explanation: result.easy_explanation,
        classical_references: result.classical_references,
      };

      // 회원인 경우 user_id도 저장
      if (userId) {
        insertData.user_id = userId;
      }

      const { error } = await supabase
        .from('saju_results')
        .insert(insertData);

      if (error) throw error;
      console.log('[DB] 분석 결과 저장 완료 (device_id:', deviceId, ')');
    }
    return true;
  } catch (e) {
    console.error('[DB] 분석 결과 저장 오류:', e);
    return false;
  }
}

export function ResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const profileId = searchParams.get('id');
  const { selectedProfile, loadProfileById, setSelectedProfile } = useProfile();
  const { isAuthenticated, isPremiumUser, user } = useAuth();
  const { mode, modeInfo, isExpertMode, isAdvancedOrAbove } = useAnalysisMode();
  
  const [activeTab, setActiveTab] = useState<'interpretation' | 'questions'>('interpretation');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [analysisResult, setAnalysisResult] = useState<SajuAnalysisResponse | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'classics' | 'fortune'>('overview');
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [pillars, setPillars] = useState<PillarDisplay[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // PDF 다운로드 핸들러
  const handleDownloadPDF = async () => {
    if (!currentProfile || !analysisResult) return;
    
    setIsDownloadingPDF(true);
    try {
      await generateSajuPDF({
        name: currentProfile.name,
        birthDate: `${currentProfile.birth_year}-${currentProfile.birth_month}-${currentProfile.birth_day}`,
        gender: currentProfile.gender,
        pillars: analysisResult.pillars ? {
          year: { heavenly_stem: analysisResult.pillars.year?.gan || '', earthly_branch: analysisResult.pillars.year?.zhi || '' },
          month: { heavenly_stem: analysisResult.pillars.month?.gan || '', earthly_branch: analysisResult.pillars.month?.zhi || '' },
          day: { heavenly_stem: analysisResult.pillars.day?.gan || '', earthly_branch: analysisResult.pillars.day?.zhi || '' },
          hour: { heavenly_stem: analysisResult.pillars.hour?.gan || '', earthly_branch: analysisResult.pillars.hour?.zhi || '' },
        } : undefined,
        analysis: {
          daily_master_analysis: analysisResult.daily_master_analysis,
          geuk_analysis: analysisResult.geuk_analysis,
          synthesis: analysisResult.synthesis,
          easy_explanation: analysisResult.easy_explanation,
        },
        classical_references: analysisResult.classical_references?.map(ref => ({
          source: ref.source,
          content: ref.content,
        })),
      });
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // 공유 핸들러
  const handleShare = () => {
    setShowShareModal(true);
  };

  // 카카오톡 공유
  const handleKakaoShare = () => {
    if (typeof window !== 'undefined' && (window as any).Kakao) {
      const kakao = (window as any).Kakao;
      if (!kakao.isInitialized()) {
        alert('카카오톡 공유 기능을 사용하려면 카카오 앱키가 필요합니다.');
        return;
      }
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `${currentProfile?.name}님의 AI 사주 분석 결과`,
          description: analysisResult?.easy_explanation?.slice(0, 100) + '...' || '사주 분석 결과를 확인해보세요!',
          imageUrl: 'https://aisaju.com/og-image.png',
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href,
          },
        },
        buttons: [
          {
            title: '분석 결과 보기',
            link: {
              mobileWebUrl: window.location.href,
              webUrl: window.location.href,
            },
          },
        ],
      });
    } else {
      alert('카카오톡 공유 기능을 로드하는 중입니다.');
    }
    setShowShareModal(false);
  };

  // 링크 복사
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('링크가 클립보드에 복사되었습니다.');
    } catch {
      alert('링크 복사에 실패했습니다.');
    }
    setShowShareModal(false);
  };

  // 초기 로딩: 프로필 및 분석 수행
  useEffect(() => {
    // 이미 실행 중인지 체크하기 위한 플래그
    let isCancelled = false;
    
    const initializeAndAnalyze = async () => {
      console.log('[Effect] useEffect 실행, profileId:', profileId);
      
      // profileId가 없으면 프로필 선택 페이지로 리다이렉트
      if (!profileId) {
        setIsInitialLoading(false);
        setCurrentProfile(null);
        return;
      }

      // 세션 스토리지에서 캐시된 결과 확인 (동기적으로 먼저 체크)
      const cached = getCachedAnalysis(profileId);
      if (cached) {
        console.log('[Effect] 캐시 사용 - API 호출 스킵');
        setCurrentProfile(cached.profile);
        setAnalysisResult(cached.result);
        setPillars(cached.pillars);
        setApiAvailable(true);
        setIsInitialLoading(false);
        return; // 여기서 종료!
      }

      console.log('[Effect] 캐시 없음 - 프로필 로드 시작');
      setIsInitialLoading(true);
      setAnalysisResult(null);
      setPillars([]);
      setLoadedFromDb(false);
      setIsSaved(false);

      // 기기 ID 가져오기
      const deviceId = getDeviceId();
      console.log('[Effect] 기기 ID:', deviceId);

      // profileId로 프로필 가져오기 (반드시 URL 파라미터 사용)
      const profile = await loadProfileById(profileId);
      if (isCancelled) return;

      if (!profile) {
        console.error('프로필을 찾을 수 없습니다:', profileId);
        setIsInitialLoading(false);
        return;
      }

      setCurrentProfile(profile);

      // DB에서 저장된 결과 먼저 확인 (기기 ID 또는 회원 ID로)
      const savedData = await loadSavedAnalysis(deviceId, user?.id || null, profile);
      if (isCancelled) return;
      
      if (savedData) {
        console.log('[Effect] DB에서 저장된 결과 사용');
        setAnalysisResult(savedData.result);
        setPillars(savedData.pillars);
        setApiAvailable(true);
        setIsSaved(true);
        setLoadedFromDb(true);
        setIsInitialLoading(false);
        // 캐시에도 저장
        setCachedAnalysis(profileId, profile, savedData.result, savedData.pillars);
        return;
      }
      
      // API 상태 확인
      const isApiAvailable = await checkApiHealth();
      if (isCancelled) return;
      
      setApiAvailable(isApiAvailable);
      
      if (!isApiAvailable) {
        setIsInitialLoading(false);
        return;
      }

      // 자동 분석 수행
      try {
        const request = {
          ...profileToSajuRequest(profile),
          analysis_level: getModeApiParam(mode),
        };
        console.log('[Effect] 분석 요청:', profile.name, '모드:', mode);
        const result = await analyzeSajuDMode(request);
        if (isCancelled) return;
        
        setAnalysisResult(result);
        
        if (result.success) {
          const newPillars = createPillarsFromResult(result);
          setPillars(newPillars);
          // 캐시에 저장
          setCachedAnalysis(profileId, profile, result, newPillars);
          
          // 자동으로 DB에 저장 (기기 ID 기반, 회원이면 user_id도 함께)
          setIsSaving(true);
          const saved = await saveAnalysisToDb(deviceId, user?.id || null, profile, result);
          if (!isCancelled) {
            setIsSaved(saved);
            setIsSaving(false);
          }
        }
      } catch (error) {
        console.error('초기 분석 오류:', error);
      } finally {
        if (!isCancelled) {
          setIsInitialLoading(false);
        }
      }
    };

    initializeAndAnalyze();
    
    // 클린업 함수
    return () => {
      isCancelled = true;
    };
  }, [profileId, user?.id]);

  const handleDetailAnalysis = async () => {
    if (!currentProfile || !profileId) {
      alert('분석할 프로필이 없습니다.');
      return;
    }
    
    setIsAnalyzing(true);
    setShowDetailModal(true);
    
    try {
      const request = profileToSajuRequest(currentProfile);
      const result = await analyzeSajuDMode(request);
      setAnalysisResult(result);
      
      if (result.success) {
        const newPillars = createPillarsFromResult(result);
        setPillars(newPillars);
        // 캐시 업데이트
        setCachedAnalysis(profileId, currentProfile, result, newPillars);
      }
    } catch (error) {
      console.error('D모드 분석 중 오류:', error);
      setAnalysisResult({
        success: false,
        processing_time_ms: 0,
        pillars: { year: { gan: '', zhi: '' }, month: { gan: '', zhi: '' }, day: { gan: '', zhi: '' }, hour: { gan: '', zhi: '' } },
        day_master: { gan: '', element: '' },
        geju: { name: '' },
        yongshen: { primary: '', secondary: '', reason: '' },
        wuxing_balance: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
        synthesis: '',
        easy_explanation: '',
        classical_references: [],
        error: error instanceof Error ? error.message : '분석 오류',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // 초기 로딩 화면
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <Loader2 className="w-16 h-16 animate-spin text-amber-400 mx-auto" />
            <Database className="w-6 h-6 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-white mt-6 font-medium">사주 원국 계산 중...</p>
          <p className="text-sm text-slate-400 mt-2">만세력 기반 동적 계산</p>
        </div>
      </div>
    );
  }

  // 프로필이 없는 경우 (profileId 미지정 또는 잘못된 ID)
  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">분석할 프로필을 선택해주세요</h2>
          <p className="text-slate-400 mb-6">보관소에서 프로필을 선택하면 사주 분석이 시작됩니다.</p>
          <button
            onClick={() => navigate('/storage')}
            className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium"
          >
            보관소로 이동
          </button>
        </div>
      </div>
    );
  }

  // API 연결 실패
  if (!apiAvailable) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">API 서버에 연결할 수 없습니다</h2>
          <p className="text-slate-400 mb-6">백엔드 서버(포트 8000)가 실행 중인지 확인해주세요.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 일간 정보 (분석 결과에서)
  const dayMaster = analysisResult?.day_master;
  const dayMasterDisplay = dayMaster ? `${dayMaster.gan}${dayMaster.element ? `(${dayMaster.element})` : ''}` : '';
  
  // 오행 분포 (분석 결과에서)
  const wuxingBalance = analysisResult?.wuxing_balance || { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

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
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isDownloadingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">공유</span>
            </button>
          </div>
        </div>

        {/* Title with Profile Name and Mode Badge */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-white">
              {currentProfile.name}님의 AI 사주풀이
            </h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              mode === 'beginner' ? 'bg-white text-amber-600 border border-amber-400' :
              mode === 'advanced' ? 'bg-slate-400 text-white border border-slate-500' :
              'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            }`}>
              {modeInfo.name}
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            {currentProfile.birth_year}년 {currentProfile.birth_month}월 {currentProfile.birth_day}일 · 
            {currentProfile.calendar_type === 'solar' ? '양력' : '음력'}
          </p>
        </div>

        {/* Four Pillars - Dynamic */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 mb-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">사주 원국</h2>
            {dayMasterDisplay && (
              <span className="text-xs text-slate-400">{dayMasterDisplay} 일간</span>
            )}
          </div>
          {pillars.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              {pillars.map((pillar, index) => (
                <div key={index} className="text-center">
                  <div className="text-xs text-amber-400 mb-2 font-medium">{pillar.time}</div>
                  <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-600">
                    <div className={`text-2xl font-bold mb-1 ${pillar.topColor}`}>
                      {pillar.top}
                    </div>
                    <div className="text-xs text-slate-400 mb-2">{pillar.topLabel}({pillar.topWuxing})</div>
                    <div className="border-t border-slate-600 my-2"></div>
                    <div className={`text-2xl font-bold mb-1 ${pillar.bottomColor}`}>
                      {pillar.bottom}
                    </div>
                    <div className="text-xs text-slate-400">{pillar.bottomLabel}({pillar.bottomWuxing})</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">원국 계산 중...</p>
            </div>
          )}
        </div>

        {/* Quick Stats - Dynamic from API */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          <div className={`bg-green-500/20 rounded-xl p-2 text-center ${wuxingBalance.목 === 0 || wuxingBalance.목 >= 3 ? 'border-4 border-white' : 'border border-green-500/30'}`}>
            <div className="text-lg font-bold text-green-400">{wuxingBalance.목}</div>
            <div className="text-xs text-green-300">목</div>
          </div>
          <div className={`bg-red-500/20 rounded-xl p-2 text-center ${wuxingBalance.화 === 0 || wuxingBalance.화 >= 3 ? 'border-4 border-white' : 'border border-red-500/30'}`}>
            <div className="text-lg font-bold text-red-400">{wuxingBalance.화}</div>
            <div className="text-xs text-red-300">화</div>
          </div>
          <div className={`bg-yellow-500/20 rounded-xl p-2 text-center ${wuxingBalance.토 === 0 || wuxingBalance.토 >= 3 ? 'border-4 border-white' : 'border border-yellow-500/30'}`}>
            <div className="text-lg font-bold text-yellow-400">{wuxingBalance.토}</div>
            <div className="text-xs text-yellow-300">토</div>
          </div>
          <div className={`bg-gray-500/20 rounded-xl p-2 text-center ${wuxingBalance.금 === 0 || wuxingBalance.금 >= 3 ? 'border-4 border-white' : 'border border-gray-500/30'}`}>
            <div className="text-lg font-bold text-gray-400">{wuxingBalance.금}</div>
            <div className="text-xs text-gray-300">금</div>
          </div>
          <div className={`bg-blue-500/20 rounded-xl p-2 text-center ${wuxingBalance.수 === 0 || wuxingBalance.수 >= 3 ? 'border-4 border-white' : 'border border-blue-500/30'}`}>
            <div className="text-lg font-bold text-blue-400">{wuxingBalance.수}</div>
            <div className="text-xs text-blue-300">수</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('interpretation')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'interpretation' 
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            AI 풀이해설
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'questions' 
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            AI 질문/답변
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'interpretation' ? (
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 border border-slate-700 space-y-6">
            {analysisResult?.success ? (
              <>
                {/* 일간 특성 - Dynamic */}
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-semibold text-white">
                      일간 특성: {dayMasterDisplay || '분석 중'}
                    </h3>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    {analysisResult.easy_explanation ? (
                      <div 
                        className="leading-relaxed space-y-3"
                        dangerouslySetInnerHTML={{
                          __html: analysisResult.easy_explanation
                            .replace(/\*\*([^*]+)\*\*/g, '<h5 class="text-amber-400 font-semibold mt-4 mb-2">$1</h5>')
                            .replace(/- ([^\n]+)/g, '<p class="pl-3 border-l-2 border-slate-600 my-1">• $1</p>')
                            .replace(/\n\n/g, '<br/>')
                        }}
                      />
                    ) : (
                      <p>일간에 대한 분석 결과입니다.</p>
                    )}
                  </div>
                </div>

                {/* 격국 판단 - Dynamic */}
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">
                      격국: {analysisResult.geju?.name || '분석 중'}
                    </h3>
                  </div>
                  {analysisResult.geju?.name && (
                    <p className="text-sm text-slate-300">
                      {analysisResult.geju.description || getGejuDescription(analysisResult.geju.name)}
                    </p>
                  )}
                </div>

                {/* 고전문헌 기반 사주풀이 */}
                {analysisResult.success && (
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="w-5 h-5 text-amber-400" />
                      <h3 className="text-lg font-semibold text-white">고전문헌 기반 사주풀이</h3>
                    </div>

                    {/* 종합 해석 (LLM 해석 결과) */}
                    {analysisResult.synthesis ? (
                      <div className="mb-5">
                        <h4 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          AI 전문가 해석
                        </h4>
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                          <div 
                            className="text-sm text-slate-300 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: analysisResult.synthesis
                                .replace(/\*\*\[([^\]]+)\]\*\*/g, '<h5 class="text-amber-400 font-semibold mt-6 mb-3 pt-4 border-t border-slate-700 first:border-t-0 first:pt-0 first:mt-0">[$1]</h5>')
                                .replace(/\[([^\]]+)\]/g, '<h5 class="text-amber-400 font-semibold mt-6 mb-3 pt-4 border-t border-slate-700">[$1]</h5>')
                                .replace(/### (\d+)\. ([^\n]+)/g, '<h5 class="text-amber-400 font-semibold mt-6 mb-3 pt-4 border-t border-slate-700">$1. $2</h5>')
                                .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>')
                                .replace(/- ([^\n]+)/g, '<p class="pl-3 border-l-2 border-slate-600 my-2">• $1</p>')
                                .replace(/\n\n/g, '<div class="my-3"></div>')
                                .replace(/\n/g, '<br/>')
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 bg-slate-800/50 rounded-lg p-4 text-center">
                        <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">
                          분석 결과를 불러오는 중입니다...
                        </p>
                      </div>
                    )}

                    {/* 참조된 고전문헌 요약 */}
                    {analysisResult.classical_references && analysisResult.classical_references.length > 0 && (
                      <div className="bg-slate-800/30 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-2">
                          <Database className="w-3.5 h-3.5" />
                          참조된 고전문헌 출처
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {[...new Set(analysisResult.classical_references.map(ref => ref.book_title))].map((bookTitle, idx) => {
                            const count = analysisResult.classical_references.filter(r => r.book_title === bookTitle).length;
                            return (
                              <span 
                                key={idx}
                                className="text-xs bg-amber-500/10 text-amber-400/80 px-2 py-1 rounded-full border border-amber-500/20"
                              >
                                {bookTitle} ({count}건)
                              </span>
                            );
                          })}
                        </div>
                        <p className="text-xs text-slate-600 mt-2">
                          위 해석은 {analysisResult.classical_references.length}개의 고전 원문을 AI가 분석하여 작성했습니다
                        </p>
                      </div>
                    )}

                    {/* 분석 기반 안내 */}
                    <div className="mt-4 pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-500 text-center">
                        삼명통회 · 적천수천미 · 신봉통고 · 궁통보감 등 9종 고전 3,238개 청크 기반
                      </p>
                    </div>
                  </div>
                )}

                {/* 2026년 운세 - Dynamic */}
                {(analysisResult.sewoon_summary || analysisResult.daewoon_summary) && (
                  <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-xl p-4 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase className="w-5 h-5 text-red-400" />
                      <h3 className="text-lg font-semibold text-white">{new Date().getFullYear()}년 운세</h3>
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      {analysisResult.sewoon_summary && <p>{analysisResult.sewoon_summary}</p>}
                      {analysisResult.daewoon_summary && <p>{analysisResult.daewoon_summary}</p>}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-3" />
                <p className="text-slate-400">분석 결과 로딩 중...</p>
              </div>
            )}

            {/* 유료 프리미엄 섹션 */}
            {currentProfile && analysisResult?.success && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <PremiumAnalysisSection
                  profileData={{
                    name: currentProfile.name,
                    gender: currentProfile.gender,
                    year: currentProfile.birth_year,
                    month: currentProfile.birth_month,
                    day: currentProfile.birth_day,
                    hour: currentProfile.birth_hour && currentProfile.birth_hour !== 'unknown'
                      ? parseInt(currentProfile.birth_hour.split(':')[0]) || 12
                      : 12,
                    minute: currentProfile.birth_hour && currentProfile.birth_hour !== 'unknown'
                      ? parseInt(currentProfile.birth_hour.split(':')[1]) || 0
                      : 0,
                    is_lunar: currentProfile.calendar_type !== 'solar',
                    is_leap_month: currentProfile.calendar_type === 'lunar_leap',
                  }}
                  yongshen={analysisResult.yongshen?.primary}
                  onUpgradeClick={() => {
                    if (isAuthenticated) {
                      alert('프리미엄 결제 기능은 추후 구현 예정입니다.');
                    } else {
                      navigate('/login', { state: { from: `/result?id=${profileId}` } });
                    }
                  }}
                />
              </div>
            )}

            {/* 회원 전용 기능 배너 */}
            {!isAuthenticated && (
              <div className="mt-6 space-y-4">
                {/* 저장 상태 표시 (비회원도 기기 ID로 저장됨) */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  isSaving ? 'bg-blue-500/10 border border-blue-500/30' :
                  isSaved ? 'bg-green-500/10 border border-green-500/30' :
                  'bg-slate-800/50 border border-slate-700'
                }`}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      <span className="text-xs text-blue-400">분석 결과 저장 중...</span>
                    </>
                  ) : isSaved ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-400">
                        {loadedFromDb ? '저장된 분석 결과를 불러왔습니다' : '분석 결과가 이 기기에 저장되었습니다'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-500">분석 완료 후 자동 저장됩니다</span>
                    </>
                  )}
                </div>

                {/* 분석 이력 보기 버튼 */}
                <button
                  onClick={() => navigate('/history')}
                  className="w-full bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-3 text-left transition-colors flex items-center gap-3"
                >
                  <History className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="font-medium text-white text-sm">분석 이력</h4>
                    <p className="text-xs text-slate-400">이 기기에서 분석한 결과 보기</p>
                  </div>
                </button>

                {/* 회원가입 안내 */}
                <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-xl p-4 border border-purple-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Crown className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white text-sm">회원가입 하면</h4>
                      <p className="text-xs text-slate-400">다른 기기에서도 분석 결과 확인 가능</p>
                    </div>
                    <button
                      onClick={() => {
                        navigate('/login', { state: { from: `/result?id=${profileId}` } });
                      }}
                      className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <LogIn className="w-4 h-4" />
                      회원가입
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 회원용 저장 상태 및 빠른 액션 */}
            {isAuthenticated && (
              <div className="mt-6 space-y-4">
                {/* 저장 상태 표시 */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  isSaving ? 'bg-blue-500/10 border border-blue-500/30' :
                  isSaved ? 'bg-green-500/10 border border-green-500/30' :
                  'bg-slate-800/50 border border-slate-700'
                }`}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      <span className="text-xs text-blue-400">분석 결과 저장 중...</span>
                    </>
                  ) : isSaved ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-400">
                        {loadedFromDb ? '저장된 분석 결과를 불러왔습니다' : '분석 결과가 자동 저장되었습니다'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-500">분석 완료 후 자동 저장됩니다</span>
                    </>
                  )}
                </div>

                {/* 사주가 모드 전용 기능 */}
                {isExpertMode && (
                  <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl p-4 border border-purple-500/30">
                    <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                      <Crown className="w-4 h-4" />
                      사주가 전용 기능
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => navigate('/expert/classics')}
                        className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg p-2 text-center transition-colors"
                      >
                        <BookOpen className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                        <span className="text-xs text-purple-300">원문 검색</span>
                      </button>
                      <button
                        onClick={() => navigate('/expert/qna')}
                        className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg p-2 text-center transition-colors"
                      >
                        <Brain className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                        <span className="text-xs text-purple-300">AI Q&A</span>
                      </button>
                      <button
                        onClick={() => navigate('/expert/clients')}
                        className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg p-2 text-center transition-colors"
                      >
                        <Users className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                        <span className="text-xs text-purple-300">고객 관리</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 빠른 액션 버튼 */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('/history')}
                    className="bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-4 text-left transition-colors"
                  >
                    <History className="w-5 h-5 text-amber-400 mb-2" />
                    <h4 className="font-medium text-white text-sm">분석 이력</h4>
                    <p className="text-xs text-slate-400">저장된 분석 결과 보기</p>
                  </button>
                  {!isExpertMode && (
                    <button
                      onClick={() => navigate('/expert/subscription')}
                      className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 border border-purple-500/30 rounded-xl p-4 text-left transition-colors"
                    >
                      <Crown className="w-5 h-5 text-purple-400 mb-2" />
                      <h4 className="font-medium text-white text-sm">사주가 모드</h4>
                      <p className="text-xs text-slate-400">고전 9종 심층 분석</p>
                    </button>
                  )}
                  {isExpertMode && (
                    <button
                      onClick={() => navigate('/expert')}
                      className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 border border-purple-500/30 rounded-xl p-4 text-left transition-colors"
                    >
                      <Crown className="w-5 h-5 text-purple-400 mb-2" />
                      <h4 className="font-medium text-white text-sm">사주가 대시보드</h4>
                      <p className="text-xs text-slate-400">전체 기능 보기</p>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 border border-slate-700 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-400" />
                질문하기
              </h3>
              <textarea 
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[120px]"
                placeholder="사주에 대해 궁금한 점을 물어보세요... 예) 올해 재물운은 어떤가요?"
              />
            </div>

            <button className="w-full px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-medium shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all flex items-center justify-center gap-2">
              <Brain className="w-5 h-5" />
              AI 답변 요청
            </button>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">AI 답변</h3>
              <div className="bg-slate-900/50 rounded-xl p-4 min-h-[200px] border border-slate-600">
                <p className="text-sm text-slate-400 italic">질문을 입력하고 답변을 요청하세요...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 상세 분석 모달 - 다크 테마 */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] border border-slate-700 flex flex-col overflow-hidden">
            {/* 모달 헤더 - 고정 */}
            <div className="flex-shrink-0 bg-slate-900 rounded-t-2xl border-b border-slate-700 px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 -ml-2 hover:bg-slate-800 rounded-full text-white"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-white">고전문헌 기반 상세 분석</h2>
                  <p className="text-xs text-slate-400">D모드 벡터 검색 + LLM 종합 해석</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 탭 - 고정 */}
            <div className="flex-shrink-0 flex border-b border-slate-700">
              {[
                { id: 'overview', label: '종합 분석', icon: Brain },
                { id: 'classics', label: '고전 근거', icon: BookOpen },
                { id: 'fortune', label: '운세 상세', icon: TrendingUp },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDetailTab(tab.id as typeof activeDetailTab)}
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    activeDetailTab === tab.id
                      ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800/50'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 모달 컨텐츠 - 스크롤 가능 */}
            <div className="flex-1 overflow-y-auto p-6">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 animate-spin text-amber-400" />
                    <Database className="w-6 h-6 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-white mt-6 font-medium">고전문헌 벡터 검색 중...</p>
                  <p className="text-sm text-slate-400 mt-2">9종 3,238개 청크에서 관련 문헌 탐색</p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-sm">
                    {['삼명통회', '적천수천미', '신봉통고', '자평진전', '궁통보감'].map((book) => (
                      <span key={book} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full animate-pulse">
                        {book}
                      </span>
                    ))}
                  </div>
                </div>
              ) : analysisResult ? (
                analysisResult.success ? (
                  <div className="space-y-6">
                    {/* 처리 시간 배지 */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-slate-400">
                          {analysisResult.classical_references.length}개 문헌 참조
                        </span>
                      </div>
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
                        분석 {(analysisResult.processing_time_ms / 1000).toFixed(1)}초
                      </span>
                    </div>

                    {activeDetailTab === 'overview' && (
                      <>
                        {/* 사주 원국 - 메인 페이지와 동일한 스타일 */}
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium text-white">사주 원국</h3>
                            <span className="text-xs text-slate-400">
                              {analysisResult.day_master.gan}({analysisResult.day_master.element}) 일간
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            {[
                              { time: '시주', gan: analysisResult.pillars.hour.gan, zhi: analysisResult.pillars.hour.zhi },
                              { time: '일주', gan: analysisResult.pillars.day.gan, zhi: analysisResult.pillars.day.zhi },
                              { time: '월주', gan: analysisResult.pillars.month.gan, zhi: analysisResult.pillars.month.zhi },
                              { time: '연주', gan: analysisResult.pillars.year.gan, zhi: analysisResult.pillars.year.zhi },
                            ].map((pillar) => {
                              const ganWx = ganWuxing[pillar.gan] || '?';
                              const zhiWx = zhiWuxing[pillar.zhi] || '?';
                              const ganColor = wuxingColorMap[ganWx] || 'text-white';
                              const zhiColor = wuxingColorMap[zhiWx] || 'text-white';
                              return (
                                <div key={pillar.time} className="text-center">
                                  <div className="text-xs text-amber-400 mb-2 font-medium">{pillar.time}</div>
                                  <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-600">
                                    <div className={`text-2xl font-bold mb-1 ${ganColor}`}>
                                      {ganHanja[pillar.gan] || pillar.gan}
                                    </div>
                                    <div className="text-xs text-slate-400 mb-2">{pillar.gan}({ganWx})</div>
                                    <div className="border-t border-slate-600 my-2"></div>
                                    <div className={`text-2xl font-bold mb-1 ${zhiColor}`}>
                                      {zhiHanja[pillar.zhi] || pillar.zhi}
                                    </div>
                                    <div className="text-xs text-slate-400">{pillar.zhi}({zhiWx})</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 일주 특성 (일간 + 일지 + 일주 조합) */}
                        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-xl p-4 border border-red-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-5 h-5 text-red-400" />
                            <h3 className="font-medium text-white">일주 특성</h3>
                            <span className="text-sm font-bold text-amber-400">
                              {analysisResult.pillars.day.gan}{analysisResult.pillars.day.zhi}
                              ({ganHanja[analysisResult.pillars.day.gan]}{zhiHanja[analysisResult.pillars.day.zhi]})
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div className="bg-slate-900/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-red-400">일간</span>
                                <span className="text-sm font-bold text-white">
                                  {analysisResult.pillars.day.gan} ({ganWuxing[analysisResult.pillars.day.gan] || '?'})
                                </span>
                              </div>
                              <p className="text-xs text-slate-300">
                                {getGanDescription(analysisResult.pillars.day.gan)}
                              </p>
                            </div>
                            <div className="bg-slate-900/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-orange-400">일지</span>
                                <span className="text-sm font-bold text-white">
                                  {analysisResult.pillars.day.zhi} ({zhiWuxing[analysisResult.pillars.day.zhi] || '?'})
                                </span>
                              </div>
                              <p className="text-xs text-slate-300">
                                {getZhiDescription(analysisResult.pillars.day.zhi)}
                              </p>
                            </div>
                            {/* 일주 조합 특성 */}
                            <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-amber-400">일주</span>
                                <span className="text-sm font-bold text-white">
                                  {analysisResult.pillars.day.gan}{analysisResult.pillars.day.zhi} 일주
                                </span>
                              </div>
                              <p className="text-xs text-slate-300">
                                {getIljuDescription(analysisResult.pillars.day.gan, analysisResult.pillars.day.zhi)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 월주 특성 (월간 + 월지) */}
                        <div className="bg-gradient-to-r from-green-500/10 to-teal-500/10 rounded-xl p-4 border border-green-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-5 h-5 text-green-400" />
                            <h3 className="font-medium text-white">월주 특성</h3>
                          </div>
                          <div className="space-y-3">
                            <div className="bg-slate-900/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-green-400">월간</span>
                                <span className="text-sm font-bold text-white">
                                  {analysisResult.pillars.month.gan} ({ganWuxing[analysisResult.pillars.month.gan] || '?'})
                                </span>
                              </div>
                              <p className="text-xs text-slate-300">
                                {getGanDescription(analysisResult.pillars.month.gan)}
                              </p>
                            </div>
                            <div className="bg-slate-900/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-teal-400">월지</span>
                                <span className="text-sm font-bold text-white">
                                  {analysisResult.pillars.month.zhi} ({zhiWuxing[analysisResult.pillars.month.zhi] || '?'})
                                </span>
                              </div>
                              <p className="text-xs text-slate-300">
                                {getZhiDescription(analysisResult.pillars.month.zhi)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* AI 종합 해석 */}
                        {analysisResult.easy_explanation && (
                          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Brain className="w-5 h-5 text-blue-400" />
                              <h3 className="font-medium text-white">AI 종합 해석</h3>
                            </div>
                            <div 
                              className="text-sm text-slate-300 leading-relaxed space-y-3"
                              dangerouslySetInnerHTML={{
                                __html: analysisResult.easy_explanation
                                  .replace(/\*\*([^*]+)\*\*/g, '<h5 class="text-blue-400 font-semibold mt-3 mb-1">$1</h5>')
                                  .replace(/- ([^\n]+)/g, '<p class="my-1">• $1</p>')
                                  .replace(/\n\n/g, '<br/>')
                              }}
                            />
                          </div>
                        )}

                        {/* 격국 & 용신 */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="w-4 h-4 text-purple-400" />
                              <h3 className="font-medium text-white text-sm">격국</h3>
                            </div>
                            <p className="text-lg font-bold text-purple-400">{analysisResult.geju.name || '분석 중'}</p>
                          </div>
                          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-amber-400" />
                              <h3 className="font-medium text-white text-sm">용신</h3>
                            </div>
                            <p className="text-lg font-bold text-amber-400">{analysisResult.yongshen.primary}</p>
                            {analysisResult.yongshen.secondary && (
                              <p className="text-xs text-slate-400 mt-1">희신: {analysisResult.yongshen.secondary}</p>
                            )}
                          </div>
                        </div>

                        {/* 오행 분포 */}
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                          <h3 className="font-medium mb-3 text-white">오행 분포</h3>
                          <div className="space-y-3">
                            {[
                              { name: '목', value: analysisResult.wuxing_balance.목, color: 'bg-green-500', textColor: 'text-green-400' },
                              { name: '화', value: analysisResult.wuxing_balance.화, color: 'bg-red-500', textColor: 'text-red-400' },
                              { name: '토', value: analysisResult.wuxing_balance.토, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
                              { name: '금', value: analysisResult.wuxing_balance.금, color: 'bg-gray-400', textColor: 'text-gray-400' },
                              { name: '수', value: analysisResult.wuxing_balance.수, color: 'bg-blue-500', textColor: 'text-blue-400' },
                            ].map((item) => (
                              <div key={item.name} className="flex items-center gap-3">
                                <span className={`w-8 text-sm font-medium ${item.textColor}`}>{item.name}</span>
                                <div className="flex-1 bg-slate-700 rounded-full h-3">
                                  <div 
                                    className={`${item.color} h-3 rounded-full transition-all`}
                                    style={{ width: `${(item.value / 8) * 100}%` }}
                                  />
                                </div>
                                <span className="w-6 text-sm text-right text-slate-400">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* LLM 종합 해석 */}
                        {analysisResult.synthesis && (
                          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                            <button
                              onClick={() => toggleSection(0)}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50"
                            >
                              <div className="flex items-center gap-2">
                                <Brain className="w-5 h-5 text-amber-400" />
                                <span className="font-medium text-white">AI 종합 해석</span>
                              </div>
                              {expandedSections.has(0) ? (
                                <ChevronUp className="w-5 h-5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            {expandedSections.has(0) && (
                              <div className="px-4 py-3 text-sm text-slate-300 whitespace-pre-wrap border-t border-slate-700">
                                {analysisResult.synthesis}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {activeDetailTab === 'classics' && (
                      <>
                        <div className="flex items-center gap-2 mb-4">
                          <BookOpen className="w-5 h-5 text-amber-400" />
                          <h3 className="font-medium text-white">참조 고전 문헌</h3>
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                            {analysisResult.classical_references.length}건
                          </span>
                        </div>
                        {analysisResult.classical_references.length > 0 ? (
                          <div className="space-y-4">
                            {analysisResult.classical_references.map((ref, index) => (
                              <div key={index} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-amber-400" />
                                    <span className="font-medium text-amber-400">{ref.book_title}</span>
                                  </div>
                                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                    유사도 {(ref.score * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-white mb-2">{ref.title}</p>
                                <p className="text-sm text-slate-400">{ref.content}</p>
                                {ref.matched_patterns.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1">
                                    {ref.matched_patterns.map((pattern, i) => (
                                      <span key={i} className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                                        {pattern}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 text-center py-10">검색된 고전 문헌이 없습니다.</p>
                        )}
                      </>
                    )}

                    {activeDetailTab === 'fortune' && (
                      <>
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp className="w-5 h-5 text-amber-400" />
                          <h3 className="font-medium text-white">2026년 상세 운세</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-gradient-to-br from-pink-500/10 to-red-500/10 rounded-xl p-4 border border-pink-500/20">
                            <Heart className="w-6 h-6 text-pink-400 mb-2" />
                            <h4 className="font-medium text-white mb-1">연애운</h4>
                            <p className="text-sm text-slate-400">화기가 강해 정열적인 만남 기대</p>
                          </div>
                          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20">
                            <Briefcase className="w-6 h-6 text-green-400 mb-2" />
                            <h4 className="font-medium text-white mb-1">재물운</h4>
                            <p className="text-sm text-slate-400">인성 생조로 문서운 양호</p>
                          </div>
                        </div>

                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                          <h4 className="font-medium text-white mb-3">월별 운세 흐름</h4>
                          <div className="space-y-2">
                            {['1-2월', '3-4월', '5-6월', '7-8월', '9-10월', '11-12월'].map((month, i) => (
                              <div key={month} className="flex items-center gap-3">
                                <span className="w-16 text-xs text-slate-400">{month}</span>
                                <div className="flex-1 bg-slate-700 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full"
                                    style={{ width: `${60 + Math.sin(i) * 30}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 용신 설명 */}
                        {analysisResult.yongshen.reason && (
                          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                            <h4 className="font-medium text-amber-400 mb-2">용신 활용 조언</h4>
                            <p className="text-sm text-slate-300">{analysisResult.yongshen.reason}</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* 면책 조항 - 클릭 가능 */}
                    <button 
                      onClick={() => {
                        setShowDetailModal(false);
                        navigate('/classics-info');
                      }}
                      className="w-full text-xs text-slate-500 hover:text-amber-400 text-center pt-4 border-t border-slate-700 transition-colors"
                    >
                      <Database className="w-4 h-4 inline mr-1" />
                      본 분석은 9종 고전문헌 3,238개 청크 벡터DB와 DeepSeek LLM 기반입니다
                      <br />
                      <span className="underline underline-offset-2">삼명통회 · 적천수천미 · 신봉통고 · 자평진전 · 궁통보감 · 명리탐원 등 →</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-white">분석 중 오류가 발생했습니다.</p>
                    <p className="text-sm text-red-400 mt-2">{analysisResult.error}</p>
                    <p className="text-xs text-slate-500 mt-4">
                      API 서버(포트 8000)가 실행 중인지 확인해주세요.
                    </p>
                  </div>
                )
              ) : (
                <div className="text-center py-10 text-slate-500">
                  분석을 시작하려면 버튼을 클릭하세요.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-sm p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">결과 공유하기</h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleKakaoShare}
                className="w-full flex items-center gap-3 p-4 bg-[#FEE500] hover:bg-[#FDD800] text-[#000000] rounded-xl transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.643 1.756 4.965 4.4 6.286-.139.533-.501 1.93-.573 2.229-.09.372.136.367.287.267.118-.078 1.879-1.277 2.639-1.796.407.058.825.088 1.247.088 5.523 0 10-3.463 10-7.691C20 6.463 17.523 3 12 3z"/>
                </svg>
                <span className="font-medium">카카오톡으로 공유</span>
              </button>
              
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="font-medium">링크 복사</span>
              </button>
              
              {navigator.share && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.share({
                        title: `${currentProfile?.name}님의 AI 사주 분석`,
                        text: '사주 분석 결과를 확인해보세요!',
                        url: window.location.href,
                      });
                    } catch {
                      // 사용자 취소
                    }
                    setShowShareModal(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                >
                  <Share2 className="w-6 h-6" />
                  <span className="font-medium">다른 앱으로 공유</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
