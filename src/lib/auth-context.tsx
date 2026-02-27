import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getDeviceIdIfExists } from './device-id';

// 관리자 이메일 목록 (여기에 관리자 이메일 추가)
const ADMIN_EMAILS = [
  'eunwookim@gmail.com',     // 김은우님 이메일 (실제 이메일로 변경 필요)
  'admin@ai-saju.com',       // 관리자 이메일 예시
];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  isAuthenticated: boolean;
  isPremiumUser: boolean;
  isExpertUser: boolean;
  isAdmin: boolean;  // 관리자 여부
  subscription: SubscriptionInfo | null;
}

interface SubscriptionInfo {
  planId: string;
  status: 'active' | 'expired' | 'cancelled';
  expiresAt: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadSubscription(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadSubscription(session.user.id);
          // 로그인 후 기기 ID로 저장된 데이터를 회원에 연결
          linkDeviceDataToUser(session.user.id);
          // 로그인 후 pending 분석 결과가 있으면 DB에 저장
          savePendingResult(session.user.id);
        } else {
          setSubscription(null);
        }
        setLoading(false);
      }
    );

    return () => authSubscription.unsubscribe();
  }, []);

  // 로그인 후 기기 ID로 저장된 데이터를 회원에 연결
  const linkDeviceDataToUser = async (userId: string) => {
    try {
      const deviceId = getDeviceIdIfExists();
      if (!deviceId) {
        console.log('[Auth] 기기 ID 없음 - 연결 스킵');
        return;
      }

      console.log('[Auth] 기기 ID 데이터를 회원에 연결 시도:', deviceId);

      // 1. 해당 기기 ID로 저장된 모든 분석 결과(saju_results)를 회원에 연결
      const { data: sajuData, error: sajuError } = await supabase
        .from('saju_results')
        .update({ user_id: userId })
        .eq('device_id', deviceId)
        .is('user_id', null);  // 아직 회원 연결 안 된 데이터만

      if (sajuError) {
        if (sajuError.code === '42P01') {
          console.warn('[Auth] saju_results 테이블이 아직 생성되지 않았습니다.');
        } else {
          console.error('[Auth] saju_results 연결 오류:', sajuError);
        }
      } else {
        console.log('[Auth] saju_results 데이터가 회원에 연결되었습니다:', sajuData);
      }

      // 2. 해당 기기 ID로 저장된 모든 프로필(profiles)도 회원에 연결
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update({ user_id: userId })
        .eq('device_id', deviceId)
        .is('user_id', null);  // 아직 회원 연결 안 된 데이터만

      if (profileError) {
        if (profileError.code === '42P01') {
          console.warn('[Auth] profiles 테이블이 아직 생성되지 않았습니다.');
        } else {
          console.error('[Auth] profiles 연결 오류:', profileError);
        }
      } else {
        console.log('[Auth] profiles 데이터가 회원에 연결되었습니다:', profileData);
      }
    } catch (err) {
      console.error('[Auth] 기기 데이터 연결 실패:', err);
    }
  };

  // 로그인 후 로컬 스토리지에 저장된 분석 결과를 DB에 저장
  const savePendingResult = async (userId: string) => {
    try {
      const pendingData = localStorage.getItem('pending_saju_result');
      if (!pendingData) return;

      const { profile, analysis, savedAt } = JSON.parse(pendingData);
      
      // saju_results 테이블에 저장 시도
      const { error } = await supabase
        .from('saju_results')
        .insert({
          user_id: userId,
          name: profile.name,
          birth_date: profile.birthDate,
          birth_time: profile.birthTime || null,
          is_lunar: profile.isLunar || false,
          gender: profile.gender,
          pillars: analysis.pillars,
          day_master: analysis.day_master,
          geju: analysis.geju,
          yongshen: analysis.yongshen,
          wuxing_balance: analysis.wuxing_balance,
          synthesis: analysis.synthesis,
          easy_explanation: analysis.easy_explanation,
          classical_references: analysis.classical_references,
          created_at: savedAt,
        });

      if (error) {
        // 테이블이 없는 경우 등 에러 발생 시 로컬에 보관
        if (error.code === '42P01') {
          console.warn('saju_results 테이블이 아직 생성되지 않았습니다.');
        } else {
          console.error('분석 결과 저장 오류:', error);
        }
        // 에러 시에도 로컬 스토리지 유지 (나중에 다시 시도 가능)
      } else {
        // 저장 성공 시 로컬 스토리지에서 삭제
        localStorage.removeItem('pending_saju_result');
        console.log('분석 결과가 회원 계정에 저장되었습니다.');
      }
    } catch (err) {
      console.error('Pending 결과 저장 실패:', err);
    }
  };

  const loadSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('구독 정보 로드 오류:', error);
        }
        setSubscription(null);
        return;
      }

      if (data) {
        setSubscription({
          planId: data.plan_id,
          status: data.status as 'active' | 'expired' | 'cancelled',
          expiresAt: data.expires_at,
        });
      }
    } catch (err) {
      console.error('구독 정보 로드 실패:', err);
      setSubscription(null);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setSubscription(null);
    }
    return { error };
  };

  const isAuthenticated = !!user;
  const isPremiumUser = isAuthenticated;
  const isExpertUser = isAuthenticated && subscription?.planId === 'expert_yearly' && subscription?.status === 'active';
  
  // 관리자 여부 확인 (이메일 기반)
  const isAdmin = isAuthenticated && !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const value: AuthContextType = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
    isAuthenticated,
    isPremiumUser,
    isExpertUser,
    isAdmin,
    subscription,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
