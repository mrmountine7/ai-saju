import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getDeviceId } from '@/lib/device-id';

export interface Profile {
  id: string;
  name: string;
  gender: 'male' | 'female';
  nationality: 'domestic' | 'foreign';
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: string;
  calendar_type: 'solar' | 'lunar' | 'lunar_leap';
  country: string;
  city: string;
  is_primary: boolean;
  is_favorite: boolean;
  created_at?: string;
}

interface ProfileContextType {
  selectedProfile: Profile | null;
  setSelectedProfile: (profile: Profile | null) => void;
  profiles: Profile[];
  loadProfiles: () => Promise<void>;
  loadProfileById: (id: string) => Promise<Profile | null>;
  loading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      
      let query = supabase
        .from('profiles')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });
      
      // 관리자는 모든 프로필 조회 가능
      if (isAdmin) {
        // 관리자: 필터 없이 모든 프로필 조회
        console.log('[Admin] 모든 프로필 조회');
      } else if (user) {
        // 일반 회원: user_id 또는 device_id로 조회
        query = query.or(`user_id.eq.${user.id},device_id.eq.${deviceId}`);
      } else {
        // 비회원: device_id로만 조회
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProfiles(data || []);
      
      // 자동으로 primary 프로필 선택
      if (!selectedProfile && data && data.length > 0) {
        const primary = data.find(p => p.is_primary) || data[0];
        setSelectedProfile(primary);
      }
    } catch (error) {
      console.error('프로필 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileById = async (id: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('프로필 로드 오류:', error);
      return null;
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [user, isAdmin]);

  return (
    <ProfileContext.Provider value={{
      selectedProfile,
      setSelectedProfile,
      profiles,
      loadProfiles,
      loadProfileById,
      loading,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
