import { useState, useEffect } from 'react';
import { ArrowLeft, Search, BookOpen, Star, StarOff, Filter, ChevronDown, ChevronUp, Copy, Check, Bookmark, BookmarkCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useAnalysisMode } from '@/contexts/AnalysisModeContext';
import { MODE_THEMES } from '@/contexts/ThemeContext';

interface ClassicSearchResult {
  id: string;
  book_title: string;
  title: string;
  content: string;
  content_hanja?: string;
  score: number;
  matched_patterns: string[];
  chunk_id?: string;
}

interface SavedClassic {
  id: string;
  user_id: string;
  chunk_id: string;
  book_title: string;
  title: string;
  content: string;
  content_hanja?: string;
  note?: string;
  created_at: string;
}

const CLASSIC_BOOKS = [
  { id: 'all', name: '전체 문헌' },
  { id: '적천수', name: '적천수' },
  { id: '자평진전', name: '자평진전' },
  { id: '궁통보감', name: '궁통보감' },
  { id: '연해자평', name: '연해자평' },
  { id: '삼명통회', name: '삼명통회' },
  { id: '명리약언', name: '명리약언' },
  { id: '명리정종', name: '명리정종' },
  { id: '난강망', name: '난강망' },
  { id: '적천수천미', name: '적천수천미' },
];

export function ExpertClassicsSearch() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { mode } = useAnalysisMode();
  const theme = MODE_THEMES[mode];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState('all');
  const [searchResults, setSearchResults] = useState<ClassicSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedClassics, setSavedClassics] = useState<SavedClassic[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  useEffect(() => {
    if (user?.id) {
      loadSavedClassics();
    }
  }, [user?.id]);

  const loadSavedClassics = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('expert_saved_classics')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setSavedClassics(data);
      }
    } catch (e) {
      console.error('저장된 원문 로드 오류:', e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://ai-saju-production.up.railway.app'}/api/classics/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          book_filter: selectedBook === 'all' ? null : selectedBook,
          top_k: 20,
          include_hanja: true,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error('원문 검색 오류:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('복사 오류:', e);
    }
  };

  const isSaved = (chunkId: string) => {
    return savedClassics.some(c => c.chunk_id === chunkId);
  };

  const handleSaveToggle = async (result: ClassicSearchResult) => {
    if (!user?.id || !result.chunk_id) return;
    
    setSavingId(result.chunk_id);
    
    try {
      if (isSaved(result.chunk_id)) {
        await supabase
          .from('expert_saved_classics')
          .delete()
          .eq('user_id', user.id)
          .eq('chunk_id', result.chunk_id);
        
        setSavedClassics(prev => prev.filter(c => c.chunk_id !== result.chunk_id));
      } else {
        const { data, error } = await supabase
          .from('expert_saved_classics')
          .insert({
            user_id: user.id,
            chunk_id: result.chunk_id,
            book_title: result.book_title,
            title: result.title,
            content: result.content,
            content_hanja: result.content_hanja,
          })
          .select()
          .single();
        
        if (!error && data) {
          setSavedClassics(prev => [data, ...prev]);
        }
      }
    } catch (e) {
      console.error('저장/삭제 오류:', e);
    } finally {
      setSavingId(null);
    }
  };

  const displayResults = showSavedOnly 
    ? savedClassics.map(c => ({
        id: c.id,
        book_title: c.book_title,
        title: c.title,
        content: c.content,
        content_hanja: c.content_hanja,
        score: 1,
        matched_patterns: [],
        chunk_id: c.chunk_id,
      }))
    : searchResults;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bgGradient }}>
        <div className="text-center px-4">
          <BookOpen className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">로그인이 필요합니다</h2>
          <p className="text-slate-400 mb-6">원문 검색 기능은 전문가 회원만 이용할 수 있습니다.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium"
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: theme.bgGradient }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">고전 원문 검색</h1>
          <div className="w-10" />
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="검색어 입력 (예: 갑목, 정관격, 용신)"
                className="w-full pl-12 pr-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white rounded-xl font-medium transition-colors"
            >
              {isSearching ? '검색 중...' : '검색'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-slate-400 text-sm mb-3"
          >
            <Filter className="w-4 h-4" />
            필터 옵션
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showFilters && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="mb-3">
                <label className="text-sm text-slate-400 mb-2 block">문헌 선택</label>
                <div className="flex flex-wrap gap-2">
                  {CLASSIC_BOOKS.map(book => (
                    <button
                      key={book.id}
                      onClick={() => setSelectedBook(book.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedBook === book.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {book.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toggle: Search Results vs Saved */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setShowSavedOnly(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              !showSavedOnly 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Search className="w-4 h-4" />
            검색 결과 ({searchResults.length})
          </button>
          <button
            onClick={() => setShowSavedOnly(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showSavedOnly 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            저장된 원문 ({savedClassics.length})
          </button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {displayResults.length === 0 ? (
            <div className="text-center py-12">
              {showSavedOnly ? (
                <>
                  <Bookmark className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">저장된 원문이 없습니다</p>
                  <p className="text-slate-500 text-sm mt-1">검색 후 즐겨찾기에 추가해보세요</p>
                </>
              ) : (
                <>
                  <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">검색어를 입력하세요</p>
                  <p className="text-slate-500 text-sm mt-1">9종 고전 문헌에서 검색합니다</p>
                </>
              )}
            </div>
          ) : (
            displayResults.map((result, idx) => (
              <div 
                key={result.id || idx}
                className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
              >
                {/* Result Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-slate-800/80 transition-colors"
                  onClick={() => toggleExpand(result.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded">
                          {result.book_title}
                        </span>
                        {!showSavedOnly && result.score && (
                          <span className="text-xs text-slate-500">
                            유사도 {(result.score * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-medium">{result.title}</h3>
                      <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                        {result.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.chunk_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveToggle(result);
                          }}
                          disabled={savingId === result.chunk_id}
                          className={`p-2 rounded-lg transition-colors ${
                            isSaved(result.chunk_id)
                              ? 'text-amber-400 hover:bg-amber-500/20'
                              : 'text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {isSaved(result.chunk_id) 
                            ? <BookmarkCheck className="w-5 h-5" />
                            : <Bookmark className="w-5 h-5" />
                          }
                        </button>
                      )}
                      {expandedResults.has(result.id) 
                        ? <ChevronUp className="w-5 h-5 text-slate-400" />
                        : <ChevronDown className="w-5 h-5 text-slate-400" />
                      }
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedResults.has(result.id) && (
                  <div className="px-4 pb-4 border-t border-slate-700">
                    {/* 원문 (한문) */}
                    {result.content_hanja && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-purple-400 font-medium">원문 (漢文)</span>
                          <button
                            onClick={() => copyToClipboard(result.content_hanja!, `hanja-${result.id}`)}
                            className="text-slate-400 hover:text-white transition-colors"
                          >
                            {copiedId === `hanja-${result.id}` 
                              ? <Check className="w-4 h-4 text-green-400" />
                              : <Copy className="w-4 h-4" />
                            }
                          </button>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 text-slate-300 font-serif leading-relaxed">
                          {result.content_hanja}
                        </div>
                      </div>
                    )}

                    {/* 해석 (한글) */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-purple-400 font-medium">해석 (韓文)</span>
                        <button
                          onClick={() => copyToClipboard(result.content, `content-${result.id}`)}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          {copiedId === `content-${result.id}` 
                            ? <Check className="w-4 h-4 text-green-400" />
                            : <Copy className="w-4 h-4" />
                          }
                        </button>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3 text-slate-300 leading-relaxed">
                        {result.content}
                      </div>
                    </div>

                    {/* 매칭 패턴 */}
                    {result.matched_patterns && result.matched_patterns.length > 0 && (
                      <div className="mt-4">
                        <span className="text-xs text-slate-500 block mb-2">매칭 키워드</span>
                        <div className="flex flex-wrap gap-2">
                          {result.matched_patterns.map((pattern, i) => (
                            <span 
                              key={i}
                              className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded"
                            >
                              {pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
