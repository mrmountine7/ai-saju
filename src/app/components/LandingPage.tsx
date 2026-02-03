import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="mb-4">
          <p className="text-sm">• 1번 랜딩페이지</p>
        </div>
        
        <div className="bg-gray-200 rounded-3xl p-12 min-h-[800px] flex flex-col justify-between">
          <div className="flex-1 flex items-center justify-center">
            <h1 className="text-6xl font-bold text-gray-800">AI사주</h1>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => navigate('/storage')}
                className="px-8 py-3 bg-white rounded-lg border-2 border-gray-300 hover:bg-gray-50"
              >
                일반인 모드
              </button>
              <button 
                onClick={() => navigate('/storage')}
                className="px-8 py-3 bg-white rounded-lg border-2 border-gray-300 hover:bg-gray-50"
              >
                전문가 모드
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <span className="text-gray-700">언어설정:</span>
              <div className="relative">
                <select className="appearance-none bg-white rounded-lg border-2 border-gray-300 px-6 py-2 pr-10 cursor-pointer">
                  <option>한국</option>
                  <option>English</option>
                  <option>中文</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
