import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Bookmark, BookmarkCheck, Trash2, Loader2, MessageSquare, Sparkles, History, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface QnAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    pillars?: string;
    client_name?: string;
    references?: string[];
  };
}

interface SavedConversation {
  id: string;
  user_id: string;
  title: string;
  messages: QnAMessage[];
  is_favorite: boolean;
  client_name?: string;
  created_at: string;
  updated_at: string;
}

export function ExpertAiQnA() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [messages, setMessages] = useState<QnAMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [clientContext, setClientContext] = useState<{ name: string; pillars: string } | null>(null);
  const [showContextInput, setShowContextInput] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSavedConversations();
    }
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSavedConversations = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('expert_ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (!error && data) {
        setSavedConversations(data);
      }
    } catch (e) {
      console.error('대화 목록 로드 오류:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage: QnAMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      context: clientContext ? { pillars: clientContext.pillars, client_name: clientContext.name } : undefined,
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    
    try {
      const response = await fetch('http://localhost:8000/api/expert/qna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: inputMessage,
          context: clientContext || {},
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        const assistantMessage: QnAMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.answer || '응답을 생성할 수 없습니다.',
          timestamp: new Date(),
          context: {
            references: data.references || [],
          },
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('API 오류');
      }
    } catch (e) {
      console.error('AI 응답 오류:', e);
      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCurrentConversation = async () => {
    if (!user?.id || messages.length === 0) return;
    
    try {
      const title = messages[0].content.slice(0, 50) + (messages[0].content.length > 50 ? '...' : '');
      
      if (currentConversationId) {
        await supabase
          .from('expert_ai_conversations')
          .update({
            messages,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentConversationId);
      } else {
        const { data, error } = await supabase
          .from('expert_ai_conversations')
          .insert({
            user_id: user.id,
            title,
            messages,
            client_name: clientContext?.name,
            is_favorite: false,
          })
          .select()
          .single();
        
        if (!error && data) {
          setCurrentConversationId(data.id);
          setSavedConversations(prev => [data, ...prev]);
        }
      }
    } catch (e) {
      console.error('대화 저장 오류:', e);
    }
  };

  const loadConversation = (conv: SavedConversation) => {
    setMessages(conv.messages);
    setCurrentConversationId(conv.id);
    if (conv.client_name) {
      setClientContext({ name: conv.client_name, pillars: '' });
    }
    setShowHistory(false);
  };

  const toggleFavorite = async (convId: string, currentFavorite: boolean) => {
    try {
      await supabase
        .from('expert_ai_conversations')
        .update({ is_favorite: !currentFavorite })
        .eq('id', convId);
      
      setSavedConversations(prev =>
        prev.map(c => c.id === convId ? { ...c, is_favorite: !currentFavorite } : c)
      );
    } catch (e) {
      console.error('즐겨찾기 토글 오류:', e);
    }
  };

  const deleteConversation = async (convId: string) => {
    if (!confirm('이 대화를 삭제하시겠습니까?')) return;
    
    try {
      await supabase
        .from('expert_ai_conversations')
        .delete()
        .eq('id', convId);
      
      setSavedConversations(prev => prev.filter(c => c.id !== convId));
      
      if (currentConversationId === convId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('대화 삭제 오류:', e);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setClientContext(null);
    setShowHistory(false);
  };

  const filteredConversations = showFavoritesOnly 
    ? savedConversations.filter(c => c.is_favorite)
    : savedConversations;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <MessageSquare className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">로그인이 필요합니다</h2>
          <p className="text-slate-400 mb-6">AI 질의응답 기능은 전문가 회원만 이용할 수 있습니다.</p>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  AI 명리 상담
                </h1>
                {clientContext && (
                  <p className="text-xs text-slate-400">
                    상담 대상: {clientContext.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-lg transition-colors ${
                  showHistory ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                <History className="w-5 h-5" />
              </button>
              <button
                onClick={startNewConversation}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                새 대화
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* History Sidebar */}
        {showHistory && (
          <div className="w-80 bg-slate-800/50 border-r border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium text-white">대화 기록</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFavoritesOnly(false)}
                  className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
                    !showFavoritesOnly 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setShowFavoritesOnly(true)}
                  className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
                    showFavoritesOnly 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  즐겨찾기
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  {showFavoritesOnly ? '즐겨찾기한 대화가 없습니다' : '저장된 대화가 없습니다'}
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <div 
                    key={conv.id}
                    className={`p-3 border-b border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      currentConversationId === conv.id ? 'bg-slate-800/80' : ''
                    }`}
                    onClick={() => loadConversation(conv)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{conv.title}</p>
                        {conv.client_name && (
                          <p className="text-xs text-slate-500 mt-0.5">{conv.client_name}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(conv.updated_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(conv.id, conv.is_favorite);
                          }}
                          className={`p-1 rounded ${
                            conv.is_favorite ? 'text-amber-400' : 'text-slate-500 hover:text-slate-400'
                          }`}
                        >
                          {conv.is_favorite 
                            ? <BookmarkCheck className="w-4 h-4" />
                            : <Bookmark className="w-4 h-4" />
                          }
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          className="p-1 text-slate-500 hover:text-red-400 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Context Input */}
          <div className="px-4 py-2 border-b border-slate-700">
            <button
              onClick={() => setShowContextInput(!showContextInput)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              상담 대상 설정
              {showContextInput ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showContextInput && (
              <div className="mt-3 flex gap-3">
                <input
                  type="text"
                  placeholder="고객 이름"
                  value={clientContext?.name || ''}
                  onChange={(e) => setClientContext(prev => ({ ...prev, name: e.target.value, pillars: prev?.pillars || '' }))}
                  className="flex-1 px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 text-sm focus:border-purple-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="사주 정보 (예: 갑자년 을축월 병인일 정묘시)"
                  value={clientContext?.pillars || ''}
                  onChange={(e) => setClientContext(prev => ({ ...prev, pillars: e.target.value, name: prev?.name || '' }))}
                  className="flex-[2] px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles className="w-16 h-16 text-purple-400/50 mb-4" />
                <h3 className="text-white font-medium mb-2">AI 명리 상담</h3>
                <p className="text-slate-400 text-sm max-w-md">
                  사주명리에 관한 질문을 해보세요.<br />
                  고전 문헌을 기반으로 상세한 답변을 드립니다.
                </p>
                <div className="mt-6 space-y-2">
                  <p className="text-xs text-slate-500">예시 질문:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['정관격의 특징은?', '갑목 일간의 용신은?', '대운 분석 방법'].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInputMessage(q)}
                        className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-full text-sm hover:bg-slate-700 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl p-4 ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}>
                    {msg.context?.client_name && msg.role === 'user' && (
                      <div className="text-xs text-purple-200 mb-2">
                        [{msg.context.client_name}님 관련 질문]
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.context?.references && msg.context.references.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-400 mb-2">참고 문헌:</p>
                        <div className="space-y-1">
                          {msg.context.references.map((ref, i) => (
                            <p key={i} className="text-xs text-slate-500">{ref}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className={`text-xs mt-2 ${
                      msg.role === 'user' ? 'text-purple-200' : 'text-slate-500'
                    }`}>
                      {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-200 rounded-2xl p-4 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">답변 생성 중...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-700 bg-slate-900/50">
            <div className="max-w-4xl mx-auto flex gap-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="명리학에 관해 질문하세요..."
                className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-600 focus:border-purple-500 focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white rounded-xl transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={saveCurrentConversation}
                  className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                  title="대화 저장"
                >
                  <Bookmark className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
