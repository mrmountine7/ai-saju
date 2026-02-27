export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'one_time' | 'subscription';
}

export const PRODUCTS: Record<string, Product> = {
  FORTUNE_DETAIL: {
    id: 'fortune_detail',
    name: '운세 상세 분석',
    description: '대운/세운/월운 상세 분석',
    price: 3000,
    type: 'one_time',
  },
  GAEWOON: {
    id: 'gaewoon',
    name: '개운법 분석',
    description: '용신 기반 맞춤 개운법',
    price: 2000,
    type: 'one_time',
  },
  PDF_DOWNLOAD: {
    id: 'pdf_download',
    name: 'PDF 다운로드',
    description: '분석 결과 PDF 문서',
    price: 1000,
    type: 'one_time',
  },
  FULL_PACKAGE: {
    id: 'full_package',
    name: '전체 패키지',
    description: '운세 상세 + 개운법 + PDF',
    price: 5000,
    type: 'one_time',
  },
};

export const EXPERT_SUBSCRIPTION: Product = {
  id: 'expert_yearly',
  name: '전문가 모드 연간 구독',
  description: '고전 9종 심층 분석, 고객 관리, 다양한 내보내기',
  price: 238800,
  type: 'subscription',
};

export const EXPERT_MONTHLY_PRICE = 19900;
export const EXPERT_YEARLY_PRICE = 238800;

export const EXPERT_FEATURES = [
  '고전 9종 심층 분석 무제한',
  '고전 원문 검색 무제한',
  '여러 사주 비교 분석',
  '메모/주석 기능',
  '고객 관리 기능',
  'PDF/Excel/텍스트 내보내기',
  '분석 이력 무제한 저장',
];

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ko-KR').format(price) + '원';
}
