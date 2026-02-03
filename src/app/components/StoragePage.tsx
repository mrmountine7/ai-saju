import { useNavigate } from 'react-router-dom';
import { Menu, Search, Plus } from 'lucide-react';
import { useState } from 'react';
import { Sidebar } from './Sidebar';

export function StoragePage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const favorites = [
    { name: '오연미', label: '옹띠 아이콘' },
    { name: '고종욱', label: '옹띠 아이콘' },
  ];

  const savedList = [
    { name: '오연미', birth: '1976/01/03 04:40(음)', location: '부산', label: '옹띠 아이콘' },
    { name: '고종욱', birth: '1969/06/07 01:00(음)', location: '경남', label: '닭띠 아이콘' },
    { name: '홍길동', birth: '1969/06/07 01:00(음)', location: '경남', label: '닭띠 아이콘' },
    { name: '김놀부', birth: '1969/06/07 01:00(음)', location: '경남', label: '닭띠 아이콘' },
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-lg mx-auto">
          <div className="mb-4">
            <p className="text-sm">• 2번 사주보관소</p>
          </div>

          <div className="bg-gray-200 rounded-3xl p-6 min-h-[800px]">
            {/* Header */}
            <div className="flex justify-end mb-6">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2"
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-8">
              <div className="flex items-center gap-2 text-gray-700 mb-2">
                <span>나의 프로필(전문가)</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder=""
                  className="w-full px-4 py-3 pr-12 rounded-lg border-2 border-gray-300 bg-white"
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
              </div>
            </div>

            {/* My Profile Card */}
            <div className="bg-white rounded-lg p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center">
                  <div className="text-xs text-center">
                    <div className="text-yellow-600">감아지</div>
                    <div className="text-yellow-600">아이콘</div>
                  </div>
                </div>
                <div>
                  <div className="font-medium">김은우</div>
                  <div className="text-sm text-gray-500">1970/01/14 03:15(음) 인천</div>
                </div>
              </div>
            </div>

            {/* Favorites */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-700 mb-4">즐겨찾기</h2>
              <div className="bg-white rounded-lg p-6">
                <div className="flex items-center gap-8">
                  {favorites.map((item, index) => (
                    <div key={index} className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center">
                        <div className="text-xs text-center">
                          <div className="text-yellow-600">{item.label.split(' ')[0]}</div>
                          <div className="text-yellow-600">{item.label.split(' ')[1]}</div>
                        </div>
                      </div>
                      <div className="text-sm">{item.name}</div>
                    </div>
                  ))}
                  <button className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50">
                    <Plus className="w-6 h-6 text-gray-600" />
                  </button>
                  <button className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50">
                    <Plus className="w-6 h-6 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Saved List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-700">저장목록</h2>
                <button 
                  onClick={() => navigate('/add')}
                  className="text-sm text-gray-600 hover:underline"
                >
                  추가하기 &gt;
                </button>
              </div>
              <div className="bg-white rounded-lg p-4 space-y-4">
                {savedList.map((item, index) => (
                  <div 
                    key={index}
                    onClick={() => navigate('/result')}
                    className="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                  >
                    <div className="w-12 h-12 rounded-full bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center flex-shrink-0">
                      <div className="text-xs text-center">
                        <div className="text-yellow-600">{item.label.split(' ')[0]}</div>
                        <div className="text-yellow-600">{item.label.split(' ')[1]}</div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.birth} {item.location}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
