import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Notification {
  id: string;
  type: 'subscription_expiry' | 'daily_fortune' | 'promotion' | 'system';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}

interface NotificationSettings {
  daily_fortune: boolean;
  subscription_alerts: boolean;
  promotions: boolean;
  push_enabled: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  clearNotifications: () => Promise<void>;
  requestPushPermission: () => Promise<boolean>;
  addLocalNotification: (notification: Omit<Notification, 'id' | 'read' | 'created_at'>) => void;
}

const defaultSettings: NotificationSettings = {
  daily_fortune: true,
  subscription_alerts: true,
  promotions: false,
  push_enabled: false,
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data);
      }
    } catch (e) {
      console.error('알림 조회 오류:', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const fetchSettings = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setSettings({
          daily_fortune: data.daily_fortune ?? true,
          subscription_alerts: data.subscription_alerts ?? true,
          promotions: data.promotions ?? false,
          push_enabled: data.push_enabled ?? false,
        });
      }
    } catch {
      // 설정이 없으면 기본값 사용
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchSettings();
    }
  }, [isAuthenticated, fetchNotifications, fetchSettings]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    
    if (isAuthenticated && user?.id) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    if (isAuthenticated && user?.id) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
    }
  };

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    if (isAuthenticated && user?.id) {
      await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          ...updatedSettings,
          updated_at: new Date().toISOString(),
        });
    }
    
    localStorage.setItem('notification_settings', JSON.stringify(updatedSettings));
  };

  const clearNotifications = async () => {
    setNotifications([]);
    
    if (isAuthenticated && user?.id) {
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
    }
  };

  const requestPushPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      alert('이 브라우저는 알림을 지원하지 않습니다.');
      return false;
    }

    if (Notification.permission === 'granted') {
      await updateSettings({ push_enabled: true });
      return true;
    }

    if (Notification.permission === 'denied') {
      alert('알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await updateSettings({ push_enabled: true });
      return true;
    }
    
    return false;
  };

  const addLocalNotification = (notification: Omit<Notification, 'id' | 'read' | 'created_at'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `local_${Date.now()}`,
      read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications(prev => [newNotification, ...prev]);

    if (settings.push_enabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/ai-saju-logo.png',
      });
    }
  };

  useEffect(() => {
    const savedSettings = localStorage.getItem('notification_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch {
        // 파싱 오류 무시
      }
    }
  }, []);

  useEffect(() => {
    if (!settings.daily_fortune) return;

    const checkDailyNotification = () => {
      const lastNotified = localStorage.getItem('last_daily_notification');
      const today = new Date().toDateString();
      
      if (lastNotified !== today) {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 9) {
          addLocalNotification({
            type: 'daily_fortune',
            title: '오늘의 운세',
            message: '오늘의 일진을 확인해보세요!',
            action_url: '/daily',
          });
          localStorage.setItem('last_daily_notification', today);
        }
      }
    };

    checkDailyNotification();
    const interval = setInterval(checkDailyNotification, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [settings.daily_fortune]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      settings,
      loading,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      updateSettings,
      clearNotifications,
      requestPushPermission,
      addLocalNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
