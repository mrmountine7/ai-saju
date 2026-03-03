import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Home, 
  User, 
  Heart, 
  Sparkles, 
  Calendar, 
  BookOpen,
  Settings,
  CreditCard,
  HelpCircle,
  Globe,
  Users,
  TrendingUp,
  Star,
  Clock,
  Database,
  Crown,
  Zap,
  FileText,
  CheckCircle
} from 'lucide-react';
import { PRODUCTS } from '@/lib/payment';
import { useAnalysisMode } from '@/contexts/AnalysisModeContext';
import { MODE_THEMES } from '@/contexts/ThemeContext';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  path?: string;
  color: string;
  bgColor: string;
}

export function MenuPage() {
  const navigate = useNavigate();
  const { mode } = useAnalysisMode();
  const theme = MODE_THEMES[mode];

  const mainMenus: MenuItem[] = [
    { icon: Home, label: '홈', sublabel: '메인화면', path: '/', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
    { icon: User, label: '사주보관소', sublabel: '명식 관리', path: '/storage', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    { icon: Sparkles, label: '사주풀이', sublabel: 'AI 분석', path: '/result', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    { icon: Heart, label: '궁합보기', sublabel: '연인/친구', path: '/compatibility', color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
  ];

  const analysisMenus: MenuItem[] = [
    { icon: TrendingUp, label: '올해 운세', sublabel: '2026년', path: '/result', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    { icon: Calendar, label: '일진 캘린더', sublabel: '오늘의 운세', path: '/daily', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    { icon: Star, label: '대운 분석', sublabel: '10년 주기', path: '/result', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    { icon: Users, label: '궁합 분석', sublabel: '연인/친구', path: '/compatibility', color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
  ];

  const infoMenus: MenuItem[] = [
    { icon: BookOpen, label: '사주명리 기본', sublabel: '입문 해설', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
    { icon: Database, label: '고전문헌 DB', sublabel: '9종 3,238청크', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
    { icon: HelpCircle, label: '사용법', sublabel: '가이드', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  ];

  const settingsMenus: MenuItem[] = [
    { icon: Globe, label: '언어 설정', sublabel: '한국어', color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
    { icon: Settings, label: '모드 전환', sublabel: '일반/전문가', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    { icon: Clock, label: '이전 풀이', sublabel: '히스토리', path: '/history', color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  ];

  const paymentMenus: MenuItem[] = [
    { icon: CreditCard, label: '결제하기', sublabel: '상품 구매', path: '/payment', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
    { icon: FileText, label: '결제 내역', sublabel: '구독/구매', path: '/payment/history', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
    { icon: Crown, label: '구독 관리', sublabel: '프리미엄', path: '/payment/subscription', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    { icon: HelpCircle, label: '결제 안내', sublabel: '방식/환불', path: '/payment/guide', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  ];

  const MenuGrid = ({ items, title }: { items: MenuItem[]; title: string }) => (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-slate-400 mb-3 px-1">{title}</h2>
      <div className="grid grid-cols-4 gap-3">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => item.path && navigate(item.path)}
            className="flex flex-col items-center p-3 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 transition-all active:scale-95"
          >
            <div className={`w-12 h-12 ${item.bgColor} rounded-xl flex items-center justify-center mb-2`}>
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </div>
            <span className="text-white text-xs font-medium text-center">{item.label}</span>
            {item.sublabel && (
              <span className="text-slate-500 text-[10px] mt-0.5">{item.sublabel}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: theme.bgGradient }}>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-white">전체 메뉴</h1>
          <div className="w-10" />
        </div>

        {/* DB Info Banner */}
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-4 mb-6 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/30 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-white font-medium">天乙貴人 분석</p>
              <p className="text-amber-400 text-sm">9종 고전문헌 · 3,238개 청크</p>
            </div>
          </div>
        </div>

        {/* Menu Sections */}
        <MenuGrid items={mainMenus} title="메인 메뉴" />
        <MenuGrid items={analysisMenus} title="분석 메뉴" />
        <MenuGrid items={paymentMenus} title="결제" />
        <MenuGrid items={infoMenus} title="정보" />
        <MenuGrid items={settingsMenus} title="설정" />

        {/* 상품 가격표 */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-slate-400 mb-3 px-1">상품 가격표</h2>
          
          {/* 구독 상품 */}
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/30 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">프리미엄 구독</h3>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">추천</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                <div>
                  <p className="text-white font-medium">{PRODUCTS.premium_monthly.name}</p>
                  <p className="text-xs text-slate-400">{PRODUCTS.premium_monthly.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-amber-400">{PRODUCTS.premium_monthly.price.toLocaleString()}원</p>
                  <p className="text-xs text-slate-500">/월</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-white font-medium">{PRODUCTS.premium_yearly.name}</p>
                    <p className="text-xs text-slate-400">{PRODUCTS.premium_yearly.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-amber-400">{PRODUCTS.premium_yearly.price.toLocaleString()}원</p>
                  <p className="text-xs text-slate-500">/년</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400 mb-2">구독 혜택</p>
                <div className="grid grid-cols-2 gap-1">
                  {['상세 사주풀이 무제한', '궁합 분석 무제한', '일진 분석 무제한', '대운/세운 분석'].map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-slate-300">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 단건 상품 */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-white">단건 구매</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-white text-sm">{PRODUCTS.detailed_analysis.name}</p>
                    <p className="text-xs text-slate-500">{PRODUCTS.detailed_analysis.description}</p>
                  </div>
                </div>
                <p className="font-bold text-white">{PRODUCTS.detailed_analysis.price.toLocaleString()}원</p>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-400" />
                  <div>
                    <p className="text-white text-sm">{PRODUCTS.compatibility.name}</p>
                    <p className="text-xs text-slate-500">{PRODUCTS.compatibility.description}</p>
                  </div>
                </div>
                <p className="font-bold text-white">{PRODUCTS.compatibility.price.toLocaleString()}원</p>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <div>
                    <p className="text-white text-sm">{PRODUCTS.yearly_fortune.name}</p>
                    <p className="text-xs text-slate-500">{PRODUCTS.yearly_fortune.description}</p>
                  </div>
                </div>
                <p className="font-bold text-white">{PRODUCTS.yearly_fortune.price.toLocaleString()}원</p>
              </div>
            </div>
          </div>

          {/* 결제 페이지 이동 버튼 */}
          <button
            onClick={() => navigate('/payment')}
            className="w-full mt-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            결제하기
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-slate-500">
          <p>삼명통회 · 적천수천미 · 신봉통고 · 자평진전</p>
          <p className="mt-1">궁통보감 · 명리탐원 · 연해자평 · 적천수</p>
        </div>
      </div>
    </div>
  );
}
