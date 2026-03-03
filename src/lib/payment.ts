/**
 * 토스페이먼츠 결제 시스템
 * - 결제위젯 SDK v2 사용
 * - 간편결제 (토스페이, 카카오페이, 네이버페이 등) 지원
 * - 테스트 모드: VITE_TEST_MODE=true 설정 시 결제 우회
 */

import { loadTossPayments, TossPaymentsInstance } from '@tosspayments/tosspayments-sdk';

// 토스페이먼츠 키 (테스트 키 - 실서비스 시 환경변수로 관리)
const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';

// API Base URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://ai-saju-production.up.railway.app';

// 테스트 모드 (결제 우회)
export const IS_TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true' || import.meta.env.DEV;

// 결제 상품 타입
export interface PaymentProduct {
  id: string;
  name: string;
  price: number;
  description?: string;
  type: 'subscription' | 'one_time';
}

// 사전 정의된 상품 목록
export const PRODUCTS: Record<string, PaymentProduct> = {
  // 구독 상품
  premium_monthly: {
    id: 'premium_monthly',
    name: '프리미엄 월정액',
    price: 9900,
    description: '모든 프리미엄 기능 무제한 이용',
    type: 'subscription',
  },
  premium_yearly: {
    id: 'premium_yearly',
    name: '프리미엄 연정액',
    price: 79000,
    description: '연간 결제 시 33% 할인',
    type: 'subscription',
  },
  
  // 단건 상품
  detailed_analysis: {
    id: 'detailed_analysis',
    name: '상세 사주풀이',
    price: 3000,
    description: '고전문헌 기반 심층 분석 1회',
    type: 'one_time',
  },
  compatibility: {
    id: 'compatibility',
    name: '궁합 분석',
    price: 5000,
    description: 'AI 궁합 심층 분석 1회',
    type: 'one_time',
  },
  yearly_fortune: {
    id: 'yearly_fortune',
    name: '신년운세 리포트',
    price: 9900,
    description: '2026년 상세 운세 PDF 리포트',
    type: 'one_time',
  },
};

// 토스페이먼츠 인스턴스
let tossPayments: TossPaymentsInstance | null = null;

/**
 * 토스페이먼츠 SDK 초기화
 */
export async function initTossPayments(): Promise<TossPaymentsInstance> {
  if (tossPayments) return tossPayments;
  
  tossPayments = await loadTossPayments(CLIENT_KEY);
  return tossPayments;
}

/**
 * 고유 주문번호 생성
 */
export function generateOrderId(productId: string, userId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const userPart = userId ? userId.substring(0, 8) : 'guest';
  return `${productId}_${userPart}_${timestamp}_${random}`;
}

/**
 * 결제 요청 옵션
 */
export interface PaymentRequestOptions {
  product: PaymentProduct;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  successUrl?: string;
  failUrl?: string;
}

/**
 * 결제 요청 (카드/간편결제)
 * - 테스트 모드(IS_TEST_MODE)일 경우 결제 없이 바로 성공 페이지로 이동
 */
export async function requestPayment(options: PaymentRequestOptions): Promise<void> {
  const { product, userId, userName, userEmail, userPhone, successUrl, failUrl } = options;
  
  // 테스트 모드: 결제 없이 성공 처리
  if (IS_TEST_MODE) {
    console.log('[TEST MODE] 결제 우회 - 상품:', product.name, '금액:', product.price);
    const orderId = generateOrderId(product.id, userId);
    const baseUrl = window.location.origin;
    const testSuccessUrl = successUrl || `${baseUrl}/payment/success`;
    // 테스트용 결제 키 생성
    const testPaymentKey = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    // 성공 페이지로 리다이렉트 (테스트 파라미터 포함)
    window.location.href = `${testSuccessUrl}?paymentKey=${testPaymentKey}&orderId=${orderId}&amount=${product.price}&testMode=true`;
    return;
  }
  
  const tp = await initTossPayments();
  const payment = tp.payment({ customerKey: userId || 'ANONYMOUS' });
  
  const orderId = generateOrderId(product.id, userId);
  const baseUrl = window.location.origin;
  
  await payment.requestPayment({
    method: 'CARD',
    amount: {
      currency: 'KRW',
      value: product.price,
    },
    orderId,
    orderName: product.name,
    customerName: userName || '고객',
    customerEmail: userEmail,
    customerMobilePhone: userPhone,
    successUrl: successUrl || `${baseUrl}/payment/success`,
    failUrl: failUrl || `${baseUrl}/payment/fail`,
  });
}

/**
 * 간편결제 요청 (토스페이/카카오페이/네이버페이)
 * - 테스트 모드(IS_TEST_MODE)일 경우 결제 없이 바로 성공 페이지로 이동
 */
export async function requestEasyPayment(
  options: PaymentRequestOptions,
  easyPayProvider: '토스페이' | '카카오페이' | '네이버페이' | 'PAYCO' | '삼성페이'
): Promise<void> {
  const { product, userId, userName, userEmail, successUrl, failUrl } = options;
  
  // 테스트 모드: 결제 없이 성공 처리
  if (IS_TEST_MODE) {
    console.log('[TEST MODE] 간편결제 우회 - 상품:', product.name, '결제수단:', easyPayProvider);
    const orderId = generateOrderId(product.id, userId);
    const baseUrl = window.location.origin;
    const testSuccessUrl = successUrl || `${baseUrl}/payment/success`;
    const testPaymentKey = `test_easy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    window.location.href = `${testSuccessUrl}?paymentKey=${testPaymentKey}&orderId=${orderId}&amount=${product.price}&testMode=true`;
    return;
  }
  
  const tp = await initTossPayments();
  const payment = tp.payment({ customerKey: userId || 'ANONYMOUS' });
  
  const orderId = generateOrderId(product.id, userId);
  const baseUrl = window.location.origin;
  
  await payment.requestPayment({
    method: 'CARD',
    amount: {
      currency: 'KRW',
      value: product.price,
    },
    orderId,
    orderName: product.name,
    customerName: userName || '고객',
    customerEmail: userEmail,
    successUrl: successUrl || `${baseUrl}/payment/success`,
    failUrl: failUrl || `${baseUrl}/payment/fail`,
    card: {
      flowMode: 'DIRECT',
      easyPay: easyPayProvider,
    },
  });
}

/**
 * 결제 승인 요청 (서버에서 호출)
 * - 프론트에서는 successUrl로 리다이렉트 후 paymentKey, orderId, amount를 서버로 전송
 */
export async function confirmPayment(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/payment/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message };
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '결제 승인 실패' };
  }
}

/**
 * 결제 취소 요청 (서버에서 호출)
 */
export async function cancelPayment(
  paymentKey: string,
  cancelReason: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/payment/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, cancelReason }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message };
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '결제 취소 실패' };
  }
}

/**
 * 구독 상태 확인
 */
export async function checkSubscription(userId: string): Promise<{
  hasSubscription: boolean;
  plan?: string;
  expiresAt?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/payment/subscription/${userId}`);
    return await response.json();
  } catch {
    return { hasSubscription: false };
  }
}

/**
 * 특정 기능 접근 권한 확인
 */
export async function checkFeatureAccess(userId: string, feature: string): Promise<{
  hasAccess: boolean;
  accessType?: 'subscription' | 'one_time';
  purchaseId?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/payment/check-access/${userId}/${feature}`);
    return await response.json();
  } catch {
    return { hasAccess: false };
  }
}
