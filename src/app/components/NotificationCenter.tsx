import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, CheckCheck, Settings, Trash2, Crown, Calendar, Gift, AlertCircle } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications,
    loading 
  } = useNotifications();
  const [showSettings, setShowSettings] = useState(false);

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'subscription_expiry':
        return <Crown className="w-5 h-5 text-amber-400" />;
      case 'daily_fortune':
        return <Calendar className="w-5 h-5 text-blue-400" />;
      case 'promotion':
        return <Gift className="w-5 h-5 text-pink-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    await markAsRead(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">알림</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="모두 읽음 표시"
              >
                <CheckCheck className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="알림 설정"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <NotificationSettings onClose={() => setShowSettings(false)} />
        )}

        {/* Notification List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="animate-spin w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-2" />
              로딩 중...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>알림이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full flex items-start gap-3 p-4 text-left hover:bg-slate-700/50 transition-colors ${
                    !notification.read ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium truncate ${notification.read ? 'text-slate-300' : 'text-white'}`}>
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-slate-700">
            <button
              onClick={clearNotifications}
              className="w-full flex items-center justify-center gap-2 py-2 text-slate-400 hover:text-red-400 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              모든 알림 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationSettings({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, requestPushPermission } = useNotifications();

  const handlePushToggle = async () => {
    if (!settings.push_enabled) {
      const granted = await requestPushPermission();
      if (!granted) return;
    } else {
      await updateSettings({ push_enabled: false });
    }
  };

  return (
    <div className="p-4 border-b border-slate-700 bg-slate-900/50">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-white">알림 설정</h4>
        <button onClick={onClose} className="text-xs text-amber-400 hover:underline">
          닫기
        </button>
      </div>
      
      <div className="space-y-3">
        <label className="flex items-center justify-between">
          <span className="text-sm text-slate-300">일진 알림 (매일 아침)</span>
          <input
            type="checkbox"
            checked={settings.daily_fortune}
            onChange={(e) => updateSettings({ daily_fortune: e.target.checked })}
            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-amber-500"
          />
        </label>
        
        <label className="flex items-center justify-between">
          <span className="text-sm text-slate-300">구독 만료 알림</span>
          <input
            type="checkbox"
            checked={settings.subscription_alerts}
            onChange={(e) => updateSettings({ subscription_alerts: e.target.checked })}
            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-amber-500"
          />
        </label>
        
        <label className="flex items-center justify-between">
          <span className="text-sm text-slate-300">프로모션/이벤트</span>
          <input
            type="checkbox"
            checked={settings.promotions}
            onChange={(e) => updateSettings({ promotions: e.target.checked })}
            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-amber-500"
          />
        </label>
        
        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm text-slate-300">푸시 알림</span>
            <p className="text-xs text-slate-500">브라우저 알림 허용 필요</p>
          </div>
          <input
            type="checkbox"
            checked={settings.push_enabled}
            onChange={handlePushToggle}
            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-amber-500"
          />
        </label>
      </div>
    </div>
  );
}

// 알림 벨 버튼 컴포넌트
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 text-slate-400 hover:text-white transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default NotificationCenter;
