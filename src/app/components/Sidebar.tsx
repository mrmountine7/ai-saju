import { useNavigate } from 'react-router-dom';
import { X, Grid3X3, Home, User, Heart, Sparkles, Settings, HelpCircle, CreditCard, Database, ChevronRight, Crown, FileText, Info } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();

  const quickMenus = [
    { icon: Home, label: '홈', path: '/', color: 'text-amber-400' },
    { icon: User, label: '보관소', path: '/storage', color: 'text-blue-400' },
    { icon: Sparkles, label: '사주풀이', path: '/result', color: 'text-purple-400' },
    { icon: Heart, label: '궁합', path: '/compatibility', color: 'text-pink-400' },
  ];

  const menuItems = [
    { icon: HelpCircle, label: '사용법', desc: '앱 가이드', path: '/menu' },
    { icon: Database, label: '사주명리 기본해설', desc: '입문자용', path: '/classics-info' },
    { icon: Settings, label: '모드 전환', desc: '일반/전문가', path: '/menu' },
  ];

  const paymentMenus = [
    { icon: CreditCard, label: '결제하기', desc: '상품 구매', path: '/payment' },
    { icon: Crown, label: '구독 관리', desc: '프리미엄', path: '/payment/subscription' },
    { icon: FileText, label: '결제 내역', desc: '구매 이력', path: '/payment/history' },
    { icon: Info, label: '결제 방식 안내', desc: '방식/환불', path: '/payment/guide' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      <div 
        className={`fixed top-0 right-0 h-full w-80 bg-slate-900 shadow-xl z-50 transform transition-transform duration-300 border-l border-slate-700 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-5 h-full flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-white">사주로</span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Quick Menu Grid */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {quickMenus.map((menu) => (
              <button
                key={menu.label}
                onClick={() => handleNavigate(menu.path)}
                className="flex flex-col items-center p-3 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-700/50 transition-all"
              >
                <menu.icon className={`w-5 h-5 ${menu.color} mb-1`} />
                <span className="text-[10px] text-slate-300">{menu.label}</span>
              </button>
            ))}
          </div>

          {/* Full Menu Button */}
          <button
            onClick={() => handleNavigate('/menu')}
            className="w-full flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-700/50 transition-all mb-6"
          >
            <div className="flex items-center gap-3">
              <Grid3X3 className="w-5 h-5 text-amber-400" />
              <span className="text-white font-medium">전체 메뉴</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>

          {/* Menu Items */}
          <div className="space-y-2 mb-4">
            <div className="text-xs text-slate-500 px-1 mb-1">설정</div>
            {menuItems.map((item, index) => (
              <button
                key={index}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors"
                onClick={() => item.path && handleNavigate(item.path)}
              >
                <item.icon className="w-5 h-5 text-slate-400" />
                <div className="text-left">
                  <div className="text-sm text-white">{item.label}</div>
                  <div className="text-[10px] text-slate-500">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Payment Menu Items */}
          <div className="flex-1 space-y-2">
            <div className="text-xs text-slate-500 px-1 mb-1">결제</div>
            {paymentMenus.map((item, index) => (
              <button
                key={index}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors"
                onClick={() => handleNavigate(item.path)}
              >
                <item.icon className={`w-5 h-5 ${index === 0 ? 'text-amber-400' : index === 3 ? 'text-cyan-400' : 'text-slate-400'}`} />
                <div className="text-left">
                  <div className="text-sm text-white">{item.label}</div>
                  <div className="text-[10px] text-slate-500">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-700">
            <div className="text-center text-xs text-slate-500">
              전통 명리학 × AI 기술
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
