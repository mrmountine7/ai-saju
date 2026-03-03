import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface SubscriptionState {
  isLoading: boolean;
  hasSubscription: boolean;
  plan: 'premium_monthly' | 'premium_yearly' | null;
  expiresAt: string | null;
  autoRenew: boolean;
}

interface PurchaseState {
  [productId: string]: {
    hasPurchase: boolean;
    purchaseId?: string;
    usedAt?: string;
  };
}

interface SubscriptionContextValue {
  subscription: SubscriptionState;
  purchases: PurchaseState;
  isPremium: boolean;
  checkAccess: (feature: string) => Promise<boolean>;
  refreshSubscription: () => Promise<void>;
  refreshPurchases: () => Promise<void>;
  usePurchase: (purchaseId: string) => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://ai-saju-production.up.railway.app';

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    isLoading: true,
    hasSubscription: false,
    plan: null,
    expiresAt: null,
    autoRenew: false,
  });
  const [purchases, setPurchases] = useState<PurchaseState>({});

  // 현재 사용자 확인
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    
    checkUser();
    
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });
    
    return () => authSub.unsubscribe();
  }, []);

  // 구독 상태 새로고침
  const refreshSubscription = useCallback(async () => {
    if (!userId) {
      setSubscription({
        isLoading: false,
        hasSubscription: false,
        plan: null,
        expiresAt: null,
        autoRenew: false,
      });
      return;
    }

    setSubscription(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`${API_BASE}/api/payment/subscription/${userId}`);
      const data = await response.json();

      if (data.has_subscription) {
        setSubscription({
          isLoading: false,
          hasSubscription: true,
          plan: data.plan,
          expiresAt: data.expires_at,
          autoRenew: data.auto_renew,
        });
      } else {
        setSubscription({
          isLoading: false,
          hasSubscription: false,
          plan: null,
          expiresAt: null,
          autoRenew: false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      setSubscription(prev => ({ ...prev, isLoading: false }));
    }
  }, [userId]);

  // 구매 이력 새로고침
  const refreshPurchases = useCallback(async () => {
    if (!userId) {
      setPurchases({});
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/payment/purchases/${userId}`);
      const data = await response.json();

      const purchaseMap: PurchaseState = {};
      for (const purchase of data.purchases || []) {
        const productId = purchase.product_id;
        if (!purchaseMap[productId] || !purchase.used_at) {
          purchaseMap[productId] = {
            hasPurchase: true,
            purchaseId: purchase.id,
            usedAt: purchase.used_at,
          };
        }
      }
      setPurchases(purchaseMap);
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
    }
  }, [userId]);

  // 사용자 변경 시 데이터 새로고침
  useEffect(() => {
    refreshSubscription();
    refreshPurchases();
  }, [userId, refreshSubscription, refreshPurchases]);

  // 특정 기능 접근 권한 확인
  const checkAccess = useCallback(async (feature: string): Promise<boolean> => {
    // 프리미엄 구독자는 모든 기능 접근 가능
    if (subscription.hasSubscription) {
      return true;
    }

    // 비로그인 사용자
    if (!userId) {
      return false;
    }

    // 단건 구매 확인
    const purchase = purchases[feature];
    if (purchase?.hasPurchase && !purchase.usedAt) {
      return true;
    }

    // 서버에서 재확인
    try {
      const response = await fetch(`${API_BASE}/api/payment/check-access/${userId}/${feature}`);
      const data = await response.json();
      return data.has_access;
    } catch {
      return false;
    }
  }, [subscription.hasSubscription, userId, purchases]);

  // 단건 구매 사용 처리
  const usePurchase = useCallback(async (purchaseId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/payment/use-purchase/${purchaseId}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        await refreshPurchases();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [refreshPurchases]);

  const isPremium = subscription.hasSubscription;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        purchases,
        isPremium,
        checkAccess,
        refreshSubscription,
        refreshPurchases,
        usePurchase,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

export function usePremiumFeature(feature: string) {
  const { subscription, purchases, checkAccess } = useSubscription();
  const [hasAccess, setHasAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      setIsChecking(true);
      const access = await checkAccess(feature);
      setHasAccess(access);
      setIsChecking(false);
    };
    check();
  }, [feature, subscription, purchases, checkAccess]);

  return {
    hasAccess,
    isChecking,
    isPremium: subscription.hasSubscription,
    hasPurchase: purchases[feature]?.hasPurchase || false,
  };
}
