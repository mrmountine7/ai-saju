import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Sparkles, Heart, Users, Database } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getDeviceId } from '@/lib/device-id';

// Profile 행 타입 정의
interface ProfileRow {
  id: string;
  user_id: string | null;
  device_id: string | null;
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
  created_at: string;
}

// 현재 날짜 정보
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const currentDay = now.getDate();

// 연도 옵션 생성 (1950 ~ 현재)
const years = Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i);
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

// 시진(時辰) 옵션 - 전통 사주명리학 12시진 체계
// 각 시진은 2시간 단위, 정각 기준 (정시법)
// 자시(子時)는 전날 23시~당일 01시로 날짜 경계에 걸침
const birthTimeOptions = [
  { value: 'unknown', label: '모름' },
  { value: '00:00', label: '자시(子時) 23:00~01:00', zhi: '子' },
  { value: '02:00', label: '축시(丑時) 01:00~03:00', zhi: '丑' },
  { value: '04:00', label: '인시(寅時) 03:00~05:00', zhi: '寅' },
  { value: '06:00', label: '묘시(卯時) 05:00~07:00', zhi: '卯' },
  { value: '08:00', label: '진시(辰時) 07:00~09:00', zhi: '辰' },
  { value: '10:00', label: '사시(巳時) 09:00~11:00', zhi: '巳' },
  { value: '12:00', label: '오시(午時) 11:00~13:00', zhi: '午' },
  { value: '14:00', label: '미시(未時) 13:00~15:00', zhi: '未' },
  { value: '16:00', label: '신시(申時) 15:00~17:00', zhi: '申' },
  { value: '18:00', label: '유시(酉時) 17:00~19:00', zhi: '酉' },
  { value: '20:00', label: '술시(戌時) 19:00~21:00', zhi: '戌' },
  { value: '22:00', label: '해시(亥時) 21:00~23:00', zhi: '亥' },
];

// OECD 20개국 및 주요 도시 (한국 기본값)
const countryCities: Record<string, string[]> = {
  '한국': ['서울', '부산', '인천', '대구', '대전', '광주', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra'],
  'Austria': ['Vienna', 'Salzburg', 'Innsbruck', 'Graz', 'Linz'],
  'Belgium': ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liège'],
  'Canada': ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton'],
  'Denmark': ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg'],
  'Finland': ['Helsinki', 'Espoo', 'Tampere', 'Turku', 'Oulu'],
  'France': ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Bordeaux'],
  'Germany': ['Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne', 'Stuttgart'],
  'Ireland': ['Dublin', 'Cork', 'Galway', 'Limerick'],
  'Italy': ['Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Venice'],
  'Japan': ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya', 'Fukuoka'],
  'Netherlands': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'],
  'New Zealand': ['Auckland', 'Wellington', 'Christchurch', 'Hamilton'],
  'Norway': ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'],
  'Spain': ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao'],
  'Sweden': ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala'],
  'Switzerland': ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Liverpool'],
  'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Francisco', 'Seattle', 'Boston'],
};

const countries = Object.keys(countryCities);

// 월별 일수 계산 함수
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function AddPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const profileId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // 폼 상태
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState<'domestic' | 'foreign'>('domestic');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [birthYear, setBirthYear] = useState(currentYear);
  const [birthMonth, setBirthMonth] = useState(currentMonth);
  const [birthDay, setBirthDay] = useState(currentDay);
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar' | 'lunar_leap'>('solar');

  // 선택된 연월에 따른 일수 계산
  const daysInMonth = getDaysInMonth(birthYear, birthMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));

  // 월 변경 시 일자 조정
  const handleMonthChange = (newMonth: number) => {
    setBirthMonth(newMonth);
    const maxDays = getDaysInMonth(birthYear, newMonth);
    if (birthDay > maxDays) {
      setBirthDay(maxDays);
    }
  };

  // 연도 변경 시 일자 조정 (윤년 처리)
  const handleYearChange = (newYear: number) => {
    setBirthYear(newYear);
    const maxDays = getDaysInMonth(newYear, birthMonth);
    if (birthDay > maxDays) {
      setBirthDay(maxDays);
    }
  };
  const [birthTime, setBirthTime] = useState('unknown');
  const [country, setCountry] = useState('한국');
  const [city, setCity] = useState('서울');
  const [isPrimary, setIsPrimary] = useState(true); // 기본값 true (프로필 없을 때)
  const [hasPrimaryProfile, setHasPrimaryProfile] = useState(false); // 기존 프로필 존재 여부

  // 기존 프로필 존재 여부 확인 및 수정 모드 시 데이터 불러오기
  useEffect(() => {
    const initializePage = async () => {
      try {
        // 기존 프라이머리 프로필 확인
        const { data: primaryData, error: primaryError } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_primary', true)
          .limit(1);

        if (primaryError) throw primaryError;

        const hasProfile = primaryData && primaryData.length > 0;
        setHasPrimaryProfile(hasProfile);

        // 수정 모드: URL에 id가 있으면 해당 프로필 불러오기
        if (profileId) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .single() as { data: ProfileRow | null; error: Error | null };

          if (profileError) throw profileError;

          if (profileData) {
            setIsEditMode(true);
            setName(profileData.name || '');
            setNationality(profileData.nationality || 'domestic');
            setGender(profileData.gender || 'male');
            setBirthYear(profileData.birth_year || currentYear);
            setBirthMonth(profileData.birth_month || currentMonth);
            setBirthDay(profileData.birth_day || currentDay);
            setCalendarType(profileData.calendar_type || 'solar');
            setBirthTime(profileData.birth_hour || 'unknown');
            setCountry(profileData.country || '한국');
            setCity(profileData.city || '서울');
            setIsPrimary(profileData.is_primary || false);
          }
        } else {
          // 새로 추가 모드: 기존 프로필이 있으면 isPrimary를 false로
          setIsPrimary(!hasProfile);
        }
      } catch (error) {
        console.error('프로필 불러오기 오류:', error);
      }
    };

    initializePage();
  }, [profileId]);

  // 국가 변경 시 도시 초기화
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    setCity(countryCities[newCountry][0]);
  };

  // 현재 국가의 도시 목록
  const cities = countryCities[country] || [];

  const handleSave = async () => {
    if (!name.trim()) {
      alert('성명을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const deviceId = getDeviceId();
      
      const profileData: Record<string, unknown> = {
        name: name.trim(),
        gender,
        nationality,
        birth_year: birthYear,
        birth_month: birthMonth,
        birth_day: birthDay,
        birth_hour: birthTime,
        calendar_type: calendarType,
        country,
        city,
        is_primary: isPrimary,
        device_id: deviceId,  // 기기 ID 추가
      };
      
      // 회원인 경우 user_id도 추가
      if (user?.id) {
        profileData.user_id = user.id;
      }

      if (isEditMode && profileId) {
        // 수정 모드: update (device_id, user_id는 수정하지 않음)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { device_id, user_id, ...updateData } = profileData;
        const { error } = await (supabase as unknown as { from: (table: string) => { update: (data: unknown) => { eq: (col: string, val: string) => Promise<{ error: Error | null }> } } })
          .from('profiles')
          .update(updateData)
          .eq('id', profileId);
        if (error) throw error;
      } else {
        // 새로 추가 모드: insert
        const insertData = {
          ...profileData,
          is_favorite: false,
        };
        const { error } = await (supabase as unknown as { from: (table: string) => { insert: (data: unknown) => Promise<{ error: Error | null }> } })
          .from('profiles')
          .insert(insertData);
        if (error) throw error;
      }
      
      navigate('/storage');
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 삭제 함수
  const handleDelete = async () => {
    if (!isEditMode || !profileId) {
      alert('삭제할 명식이 없습니다.');
      return;
    }

    if (!confirm(`"${name}" 명식을 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;
      
      // 삭제 후 랜딩페이지로 이동
      navigate('/');
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate('/storage')}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400">명식 {isEditMode ? '수정' : '등록'}</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            {isEditMode ? '명식 수정' : '새 명식 등록'}
          </h1>
          <p className="text-slate-400 text-sm">생년월일시 정보를 입력하세요</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-5 border border-slate-700 space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">성명</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Gender & Nationality */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">성별</label>
              <div className="relative">
                <select 
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                  className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="male">남자</option>
                  <option value="female">여자</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">국적</label>
              <div className="relative">
                <select 
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value as 'domestic' | 'foreign')}
                  className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="domestic">내국인</option>
                  <option value="foreign">외국인</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Birth Date */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">생년월일</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select 
                  value={birthYear}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-xl px-3 py-3 pr-8 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}년</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative w-20">
                <select 
                  value={String(birthMonth).padStart(2, '0')}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-xl px-3 py-3 pr-8 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {months.map(month => (
                    <option key={month} value={month}>{month}월</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative w-20">
                <select 
                  value={String(birthDay).padStart(2, '0')}
                  onChange={(e) => setBirthDay(Number(e.target.value))}
                  className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-xl px-3 py-3 pr-8 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {days.map(day => (
                    <option key={day} value={day}>{day}일</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Calendar Type & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">양/음력</label>
              <div className="relative">
                <select 
                  value={calendarType}
                  onChange={(e) => setCalendarType(e.target.value as 'solar' | 'lunar' | 'lunar_leap')}
                  className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="solar">양력</option>
                  <option value="lunar">음력(평달)</option>
                  <option value="lunar_leap">음력(윤달)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">출생시간</label>
              <div className="relative">
                <select 
                  value={birthTime}
                  onChange={(e) => setBirthTime(e.target.value)}
                  className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {birthTimeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Country & City */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">출생지</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {countries.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative flex-1">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full appearance-none bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {cities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Profile Checkbox */}
          <div className="flex items-center justify-between bg-slate-900/50 rounded-xl p-4 border border-slate-600">
            <div>
              <span className="text-white">나의 프로필로 설정</span>
              <p className="text-xs text-slate-400 mt-0.5">
                {hasPrimaryProfile ? '기존 프로필이 해제됩니다' : '메인 프로필로 사용됩니다'}
              </p>
            </div>
            <label className="relative cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-12 h-7 rounded-full transition-colors ${isPrimary ? 'bg-amber-500' : 'bg-slate-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${isPrimary ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-medium shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all disabled:opacity-50"
          >
            {loading ? '저장 중...' : (isEditMode ? '수정하기' : '저장하기')}
          </button>
          {isEditMode && (
            <button 
              onClick={handleDelete}
              disabled={loading}
              className="px-6 py-4 bg-red-500/20 text-red-400 rounded-xl font-medium border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              삭제
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button 
            onClick={() => profileId ? navigate(`/result?id=${profileId}`) : navigate('/result')}
            className="flex flex-col items-center gap-2 bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:bg-slate-700/50 transition-colors"
          >
            <Sparkles className="w-6 h-6 text-amber-400" />
            <span className="text-sm text-white">사주풀이</span>
          </button>
          <button 
            onClick={() => navigate('/compatibility')}
            className="flex flex-col items-center gap-2 bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:bg-slate-700/50 transition-colors"
          >
            <Heart className="w-6 h-6 text-pink-400" />
            <span className="text-sm text-white">궁합보기</span>
          </button>
          <button 
            className="flex flex-col items-center gap-2 bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:bg-slate-700/50 transition-colors"
          >
            <Users className="w-6 h-6 text-blue-400" />
            <span className="text-sm text-white">재혼운세</span>
          </button>
        </div>

        {/* DB Info Footer */}
        <div className="text-center mt-6 text-xs text-slate-500">
          <Database className="w-3 h-3 inline mr-1" />
          9종 고전문헌 · 3,238개 청크 기반 AI 분석
        </div>
      </div>
    </div>
  );
}
