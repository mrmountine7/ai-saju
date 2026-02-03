import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

export function ResultPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'interpretation' | 'questions'>('interpretation');

  const pillars = [
    { time: '시주', top: '己', topColor: 'text-yellow-600', bottom: '卯', bottomColor: 'text-green-600', 
      topLabel: '기', bottomLabel: '묘' },
    { time: '일주', top: '庚', topColor: 'text-gray-500', bottom: '午', bottomColor: 'text-red-600', 
      topLabel: '경', bottomLabel: '오' },
    { time: '월주', top: '戊', topColor: 'text-yellow-600', bottom: '黄', bottomColor: 'text-yellow-600', 
      topLabel: '무', bottomLabel: '황' },
    { time: '연주', top: '庚', topColor: 'text-gray-500', bottom: '戌', bottomColor: 'text-yellow-600', 
      topLabel: '경', bottomLabel: '술' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-4">
          <p className="text-sm">• 4번 사주풀이 결과(탭)</p>
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
            <h1 className="text-xl font-medium text-center">인공지능 사주풀이</h1>

            {/* Four Pillars */}
            <div>
              <h2 className="text-lg font-medium text-gray-700 mb-3">사주 원국</h2>
              <div className="bg-white rounded-lg p-6">
                <div className="grid grid-cols-4 gap-4">
                  {pillars.map((pillar, index) => (
                    <div key={index} className="text-center">
                      <div className="text-xs text-purple-500 mb-1">{pillar.time}</div>
                      <div className="flex flex-col">
                        <div className={`text-2xl font-medium ${pillar.topColor} border-b-2 border-black pb-2`}>
                          {pillar.top}
                          <div className="text-xs">{pillar.topLabel}</div>
                        </div>
                        <div className={`text-2xl font-medium ${pillar.bottomColor} pt-2`}>
                          {pillar.bottom}
                          <div className="text-xs">{pillar.bottomLabel}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('interpretation')}
                className={`flex-1 py-3 rounded-t-lg ${
                  activeTab === 'interpretation' 
                    ? 'bg-white font-medium' 
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                풀이해설
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`flex-1 py-3 rounded-t-lg ${
                  activeTab === 'questions' 
                    ? 'bg-white font-medium' 
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                실시간 질문/답변
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'interpretation' ? (
              <div className="bg-white rounded-b-lg rounded-tr-lg p-6 space-y-8">
                <div>
                  <h3 className="text-lg font-medium mb-3">사주 특성 해설</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>• 일간에 대한 특성 간단히 설명 (30자 이상)</p>
                    <p>• 일지에 대한 간략한 특성 설명 (30자 이상)</p>
                    <p>• 월령에 대한 간략한 특성 설명 (30자 이상)</p>
                    <p>• ...</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">대운 해설</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>• 대운의 기간 및 현재 정유되는 대운의 내용과 특성 설명 (40자 이내)</p>
                    <p>• ...</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">세운 해설</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>• 현재 적용되는 세운의 내용과 특성 설명 (40자 이내)</p>
                    <p>• ...</p>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <button className="px-12 py-3 bg-orange-200 rounded-lg hover:bg-orange-300">
                    사주풀이 상세 (결재)
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-b-lg rounded-tr-lg p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">질문</h3>
                  <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
                    <p className="text-sm text-gray-700">• ...</p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button className="px-12 py-3 bg-orange-200 rounded-lg hover:bg-orange-300">
                    답변 요청
                  </button>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">답변</h3>
                  <div className="bg-gray-50 rounded-lg p-4 min-h-[200px]">
                    <p className="text-sm text-gray-700">• ...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
