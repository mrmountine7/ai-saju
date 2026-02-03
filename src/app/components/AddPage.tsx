import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Check } from 'lucide-react';

export function AddPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-4">
          <p className="text-sm">• 3번 명식추가</p>
        </div>

        <div className="bg-gray-200 rounded-3xl p-6 min-h-[800px]">
          {/* Header */}
          <div className="mb-8">
            <button 
              onClick={() => navigate('/storage')}
              className="p-2 -ml-2"
            >
              <ArrowLeft className="w-6 h-6 text-gray-800" />
            </button>
          </div>

          <div className="space-y-6">
            <h1 className="text-xl font-medium">명식(생년월일시)</h1>

            {/* Form Fields */}
            <div className="space-y-5">
              {/* Name */}
              <div className="flex items-center gap-4">
                <label className="w-20 text-gray-700">성 명:</label>
                <input
                  type="text"
                  value="김은우"
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 bg-white"
                />
              </div>

              {/* Nationality */}
              <div className="flex items-center gap-4">
                <label className="w-20 text-gray-700">국 적:</label>
                <div className="relative">
                  <select className="appearance-none bg-white rounded-lg border-2 border-gray-300 px-4 py-2 pr-10">
                    <option>내국인</option>
                    <option>외국인</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Gender */}
              <div className="flex items-center gap-4">
                <label className="w-20 text-gray-700">성 별:</label>
                <div className="relative">
                  <select className="appearance-none bg-white rounded-lg border-2 border-gray-300 px-4 py-2 pr-10">
                    <option>남자</option>
                    <option>여자</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Birth Date */}
              <div className="flex items-center gap-4">
                <label className="w-20 text-gray-700">생 년:</label>
                <div className="flex gap-2">
                  <div className="relative">
                    <select className="appearance-none bg-white rounded-lg border-2 border-gray-300 px-4 py-2 pr-10 w-24">
                      <option>1999</option>
                      <option>2000</option>
                      <option>2001</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select className="appearance-none bg-white rounded-lg border-2 border-gray-300 px-4 py-2 pr-10 w-20">
                      <option>12</option>
                      <option>01</option>
                      <option>02</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select className="appearance-none bg-white rounded-lg border-2 border-gray-300 px-4 py-2 pr-10 w-20">
                      <option>31</option>
                      <option>01</option>
                      <option>02</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Calendar Type */}
              <div className="flex items-center gap-4">
                <label className="w-20 text-gray-700">양 / 음:</label>
                <div className="relative">
                  <select className="appearance-none bg-white rounded-lg border-2 border-gray-300 px-4 py-2 pr-10">
                    <option>양력</option>
                    <option>음력</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-4">
                <label className="w-20 text-gray-700">시 간:</label>
                <div className="relative flex-1">
                  <select className="appearance-none bg-white rounded-lg border-2 border-gray-300 px-4 py-2 pr-10 w-full">
                    <option>00:00</option>
                    <option>01:00</option>
                    <option>02:00</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Country */}
              <div className="flex items-center gap-4">
                <label className="w-20 text-gray-700">국 가:</label>
                <input
                  type="text"
                  value="한국"
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 bg-white"
                />
              </div>

              {/* City */}
              <div className="flex items-center gap-4">
                <label className="w-20 text-gray-700">도 시:</label>
                <input
                  type="text"
                  value="인천"
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 bg-white"
                />
              </div>

              {/* Profile Checkbox */}
              <div className="flex items-center gap-4">
                <label className="w-20 text-gray-700">프로필:</label>
                <div className="w-10 h-10 rounded-lg border-2 border-gray-300 bg-white flex items-center justify-center">
                  <Check className="w-5 h-5 text-gray-800" />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center pt-4">
              <button className="px-8 py-3 bg-yellow-200 rounded-lg hover:bg-yellow-300">
                저장
              </button>
              <button className="px-8 py-3 bg-yellow-200 rounded-lg hover:bg-yellow-300">
                삭제
              </button>
            </div>

            {/* Bottom Buttons */}
            <div className="flex gap-4 pt-2">
              <button 
                onClick={() => navigate('/result')}
                className="flex-1 px-6 py-3 bg-orange-200 rounded-lg hover:bg-orange-300"
              >
                사주풀이
              </button>
              <button 
                onClick={() => navigate('/compatibility')}
                className="flex-1 px-6 py-3 bg-orange-200 rounded-lg hover:bg-orange-300"
              >
                나랑궁합보기
              </button>
              <button className="flex-1 px-6 py-3 bg-orange-200 rounded-lg hover:bg-orange-300">
                재혼기능성
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
