import { X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const menuItems = [
    '사용법',
    '사주명리 기본해설',
    '모드 전환(일반/전문)',
    '태어난 국가 설정',
    '이전 사주풀이 결과 보기',
    '결재현황 보기',
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed top-0 right-0 h-full w-80 bg-yellow-50 shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-8">
            <div className="text-gray-400">
              <div className="flex gap-1">
                <div className="w-6 h-1 bg-gray-400"></div>
                <div className="w-6 h-1 bg-blue-500"></div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          <div className="space-y-6">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className="w-full text-left py-3 px-4 rounded-lg hover:bg-yellow-100 transition-colors"
                onClick={onClose}
              >
                • {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
