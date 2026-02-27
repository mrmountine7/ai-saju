import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  User, 
  Calendar, 
  FileText, 
  MoreVertical,
  Edit2,
  Trash2,
  ChevronRight,
  Filter,
  Download,
  Tag,
  FolderOpen,
  X,
  Check
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface ClientGroup {
  id: string;
  name: string;
  color: string;
}

interface Client {
  id: string;
  name: string;
  birthDate: string;
  gender: 'male' | 'female';
  phone?: string;
  email?: string;
  memo?: string;
  analysisCount: number;
  lastAnalysisDate?: string;
  createdAt: string;
  groupIds?: string[];
}

const DEFAULT_GROUPS: ClientGroup[] = [
  { id: 'vip', name: 'VIP', color: 'bg-amber-500' },
  { id: 'regular', name: '정기 상담', color: 'bg-blue-500' },
  { id: 'new', name: '신규', color: 'bg-green-500' },
  { id: 'followup', name: '후속 상담 필요', color: 'bg-red-500' },
];

export function ClientManagementPage() {
  const navigate = useNavigate();
  const { isExpertUser } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [groups, setGroups] = useState<ClientGroup[]>(DEFAULT_GROUPS);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState<string | null>(null);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    setClients([
      {
        id: '1',
        name: '김철수',
        birthDate: '1985-03-15',
        gender: 'male',
        phone: '010-1234-5678',
        memo: '재물운 상담',
        analysisCount: 5,
        lastAnalysisDate: '2026-01-15',
        createdAt: '2025-10-01',
        groupIds: ['vip', 'regular'],
      },
      {
        id: '2',
        name: '이영희',
        birthDate: '1990-07-22',
        gender: 'female',
        phone: '010-9876-5432',
        email: 'younghee@email.com',
        memo: '결혼운 관련 상담',
        analysisCount: 3,
        lastAnalysisDate: '2026-01-10',
        createdAt: '2025-11-15',
        groupIds: ['new'],
      },
      {
        id: '3',
        name: '박지민',
        birthDate: '1988-11-08',
        gender: 'female',
        memo: '직장운 상담 진행 중',
        analysisCount: 8,
        lastAnalysisDate: '2026-01-20',
        createdAt: '2025-09-20',
        groupIds: ['regular', 'followup'],
      },
    ]);
  }, []);

  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone?.includes(searchQuery) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGroup = !selectedGroupFilter || client.groupIds?.includes(selectedGroupFilter);
    
    return matchesSearch && matchesGroup;
  });

  const handleToggleGroup = (clientId: string, groupId: string) => {
    setClients(clients.map(client => {
      if (client.id !== clientId) return client;
      
      const currentGroups = client.groupIds || [];
      const newGroups = currentGroups.includes(groupId)
        ? currentGroups.filter(g => g !== groupId)
        : [...currentGroups, groupId];
      
      return { ...client, groupIds: newGroups };
    }));
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    
    const colors = ['bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-orange-500'];
    const newGroup: ClientGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      color: colors[groups.length % colors.length],
    };
    
    setGroups([...groups, newGroup]);
    setNewGroupName('');
    setShowAddGroupModal(false);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!confirm('이 그룹을 삭제하시겠습니까?')) return;
    
    setGroups(groups.filter(g => g.id !== groupId));
    setClients(clients.map(c => ({
      ...c,
      groupIds: c.groupIds?.filter(gid => gid !== groupId),
    })));
    
    if (selectedGroupFilter === groupId) {
      setSelectedGroupFilter(null);
    }
  };

  const handleAddClient = (clientData: Partial<Client>) => {
    const newClient: Client = {
      id: Date.now().toString(),
      name: clientData.name || '',
      birthDate: clientData.birthDate || '',
      gender: clientData.gender || 'male',
      phone: clientData.phone,
      email: clientData.email,
      memo: clientData.memo,
      analysisCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setClients([newClient, ...clients]);
    setShowAddModal(false);
  };

  const handleEditClient = (clientData: Partial<Client>) => {
    if (!editingClient) return;
    setClients(clients.map(c => 
      c.id === editingClient.id ? { ...c, ...clientData } : c
    ));
    setEditingClient(null);
  };

  const handleDeleteClient = (clientId: string) => {
    if (window.confirm('이 고객을 삭제하시겠습니까?')) {
      setClients(clients.filter(c => c.id !== clientId));
    }
    setShowMenu(null);
  };

  const handleClientClick = (client: Client) => {
    alert(`${client.name} 고객의 상세 정보 및 분석 이력 페이지로 이동합니다. (구현 예정)`);
  };

  const handleNewAnalysis = (client: Client) => {
    alert(`${client.name} 고객의 새 분석을 시작합니다. (구현 예정)`);
  };

  if (!isExpertUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <User className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">전문가 전용 기능</h2>
          <p className="text-slate-400 mb-6">고객 관리 기능은 전문가 모드 구독자만 이용 가능합니다.</p>
          <button
            onClick={() => navigate('/expert/subscription')}
            className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium"
          >
            전문가 모드 구독하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/expert')}
              className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-white">고객 관리</h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white p-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="이름, 전화번호, 이메일 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button 
            onClick={() => setShowAddGroupModal(true)}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-slate-400 hover:text-white transition-colors"
            title="그룹 추가"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
        </div>

        {/* Group Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedGroupFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !selectedGroupFilter 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            전체
          </button>
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupFilter(group.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedGroupFilter === group.id 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${group.color}`} />
              {group.name}
              <span className="text-xs opacity-60">
                ({clients.filter(c => c.groupIds?.includes(group.id)).length})
              </span>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-white">{clients.length}</p>
            <p className="text-xs text-slate-400">총 고객</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-purple-400">
              {clients.reduce((sum, c) => sum + c.analysisCount, 0)}
            </p>
            <p className="text-xs text-slate-400">총 분석</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-green-400">
              {clients.filter(c => c.lastAnalysisDate && new Date(c.lastAnalysisDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
            </p>
            <p className="text-xs text-slate-400">최근 7일</p>
          </div>
        </div>

        {/* Client List */}
        <div className="space-y-3">
          {filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">등록된 고객이 없습니다</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                첫 번째 고객 등록하기
              </button>
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                className="bg-slate-800/50 rounded-xl border border-slate-700 hover:border-purple-500/50 transition-colors"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div 
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => handleClientClick(client)}
                    >
                      <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{client.name}</h3>
                        <p className="text-sm text-slate-400">
                          {client.birthDate} · {client.gender === 'male' ? '남' : '여'}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowMenu(showMenu === client.id ? null : client.id)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-slate-400" />
                      </button>
                      {showMenu === client.id && (
                        <div className="absolute right-0 top-10 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden min-w-[140px]">
                          <button
                            onClick={() => {
                              setEditingClient(client);
                              setShowMenu(null);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            편집
                          </button>
                          <button
                            onClick={() => handleNewAnalysis(client)}
                            className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            새 분석
                          </button>
                          <button
                            onClick={() => alert('Excel 내보내기 (구현 예정)')}
                            className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            내보내기
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Client Groups */}
                  {client.groupIds && client.groupIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {client.groupIds.map(gid => {
                        const group = groups.find(g => g.id === gid);
                        if (!group) return null;
                        return (
                          <span
                            key={gid}
                            className={`text-xs px-2 py-0.5 rounded-full text-white ${group.color}`}
                          >
                            {group.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {client.memo && (
                    <p className="text-sm text-slate-400 mb-3 line-clamp-1">{client.memo}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {client.analysisCount}회 분석
                      </span>
                      {client.lastAnalysisDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {client.lastAnalysisDate}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowGroupModal(client.id)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                        title="그룹 설정"
                      >
                        <Tag className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleClientClick(client)}
                        className="text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Group Selection Popup */}
                {showGroupModal === client.id && (
                  <div className="px-4 pb-4 border-t border-slate-700 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">그룹 설정</span>
                      <button
                        onClick={() => setShowGroupModal(null)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {groups.map(group => (
                        <button
                          key={group.id}
                          onClick={() => handleToggleGroup(client.id, group.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            client.groupIds?.includes(group.id)
                              ? `${group.color} text-white`
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${
                            client.groupIds?.includes(group.id) ? 'bg-white' : group.color
                          }`} />
                          {group.name}
                          {client.groupIds?.includes(group.id) && (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingClient) && (
        <ClientFormModal
          client={editingClient}
          onSubmit={editingClient ? handleEditClient : handleAddClient}
          onClose={() => {
            setShowAddModal(false);
            setEditingClient(null);
          }}
        />
      )}

      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-sm border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">그룹 관리</h2>
              <button onClick={() => setShowAddGroupModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Existing Groups */}
              <div className="mb-4">
                <h3 className="text-sm text-slate-400 mb-2">기존 그룹</h3>
                <div className="space-y-2">
                  {groups.map(group => (
                    <div key={group.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${group.color}`} />
                        <span className="text-white text-sm">{group.name}</span>
                        <span className="text-xs text-slate-500">
                          ({clients.filter(c => c.groupIds?.includes(group.id)).length})
                        </span>
                      </div>
                      {!['vip', 'regular', 'new', 'followup'].includes(group.id) && (
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Group */}
              <div>
                <h3 className="text-sm text-slate-400 mb-2">새 그룹 추가</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="그룹 이름"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleAddGroup}
                    disabled={!newGroupName.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white rounded-lg text-sm transition-colors"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientFormModalProps {
  client: Client | null;
  onSubmit: (data: Partial<Client>) => void;
  onClose: () => void;
}

function ClientFormModal({ client, onSubmit, onClose }: ClientFormModalProps) {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    birthDate: client?.birthDate || '',
    gender: client?.gender || 'male' as 'male' | 'female',
    phone: client?.phone || '',
    email: client?.email || '',
    memo: client?.memo || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.birthDate) {
      alert('이름과 생년월일은 필수 항목입니다.');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-md border border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">
            {client ? '고객 정보 수정' : '새 고객 등록'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="고객 이름"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">생년월일 *</label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">성별 *</label>
            <div className="flex gap-3">
              {['male', 'female'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: g as 'male' | 'female' })}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    formData.gender === g
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {g === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">연락처</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="010-0000-0000"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">이메일</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">메모</label>
            <textarea
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px]"
              placeholder="상담 내용, 특이사항 등"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-medium hover:bg-slate-700 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
            >
              {client ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ClientManagementPage;
