import { useEffect, useMemo, useState } from 'react';
import { X, Users, Trash2, Undo2, Save, Link as LinkIcon, Merge, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
}

interface Group {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

interface ArchivedCategory {
  id: string;
  name: string;
  owner_id: string;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanel = ({ isOpen, onClose }: AdminPanelProps) => {
  useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'groups' | 'tags' | 'archive'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [archived, setArchived] = useState<ArchivedCategory[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});
  const [addingMemberUserId, setAddingMemberUserId] = useState<string>('');
  const [renameTagIds, setRenameTagIds] = useState<Record<string, string>>({});
  const [mergeSourceId, setMergeSourceId] = useState<string>('');
  const [mergeTargetName, setMergeTargetName] = useState<string>('');
  const [promoteCandidateId, setPromoteCandidateId] = useState('');
  // Odstraněny akce pro seed uživatelů
  // Demo akce odstraněny – panel pracuje jen s reálnými daty

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: groupsData } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: tagsData } = await supabase
      .from('tags')
      .select('*')
      .order('name');

    const { data: archivedData } = await supabase
      .from('categories')
      .select('id, name, owner_id')
      .eq('is_archived', true)
      .order('name');

    setUsers(usersData || []);
    setPromoteCandidateId('');
    setGroups(groupsData || []);
    setTags(tagsData || []);
    setArchived(archivedData || []);
  };

  // seedNamedUsers odstraněn

  const adminUsers = useMemo(() => users.filter(user => user.role === 'admin'), [users]);
  const regularUsers = useMemo(() => users.filter(user => user.role === 'user'), [users]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('groups')
      .insert({ name: newGroupName });

    if (!error) {
      setNewGroupName('');
      setShowAddGroup(false);
      loadData();
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Opravdu chcete smazat tuto skupinu?')) return;

    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (!error) {
      loadData();
    }
  };

  const loadGroupMembers = async (groupId: string) => {
    const { data } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);
  setGroupMembers((prev: Record<string, string[]>) => ({ ...prev, [groupId]: (data || []).map((m: { user_id: string }) => m.user_id) }));
  };

  const handleAddMember = async (groupId: string) => {
    if (!addingMemberUserId) return;
    await supabase.from('group_members').insert({ group_id: groupId, user_id: addingMemberUserId });
    setAddingMemberUserId('');
    await loadGroupMembers(groupId);
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    await loadGroupMembers(groupId);
  };

  const handleRestoreCategory = async (categoryId: string) => {
    await supabase.from('categories').update({ is_archived: false }).eq('id', categoryId);
    await loadData();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Trvale smazat kategorii? Tuto akci nelze vrátit.')) return;
    await supabase.from('categories').delete().eq('id', categoryId);
    await loadData();
  };

  const handleRenameTag = async (tagId: string) => {
    const newName = renameTagIds[tagId];
    if (!newName || !newName.trim()) return;
    await supabase.from('tags').update({ name: newName.trim() }).eq('id', tagId);
    setRenameTagIds((prev) => ({ ...prev, [tagId]: '' }));
    await loadData();
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Smazat štítek? Odkazy tento štítek ztratí.')) return;
    await supabase.from('tags').delete().eq('id', tagId);
    await loadData();
  };

  const handleMergeTags = async () => {
    if (!mergeSourceId || !mergeTargetName.trim()) return;
    // Ensure target exists (by name)
    const targetName = mergeTargetName.trim();
    const { data: existing } = await supabase.from('tags').select('id').eq('name', targetName).maybeSingle();
    let targetId = existing?.id as string | undefined;
    if (!targetId) {
      const { data: created } = await supabase.from('tags').insert({ name: targetName }).select('id').single();
      targetId = created?.id;
    }
    if (!targetId) return;
    // Repoint link_tags
    await supabase.from('link_tags').update({ tag_id: targetId }).eq('tag_id', mergeSourceId);
    // Delete old tag
    await supabase.from('tags').delete().eq('id', mergeSourceId);
    setMergeSourceId('');
    setMergeTargetName('');
    await loadData();
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (currentRole === 'admin') {
      const adminCount = users.filter(user => user.role === 'admin').length;
      if (adminCount <= 1) {
        alert('Nelze odebrat roli poslednímu administrátorovi.');
        return;
      }
    }

    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    const { error } = await supabase.rpc('set_user_role', { target_user: userId, new_role: newRole });

    if (!error) {
      loadData();
    }
  };

  const handlePromoteToAdmin = async () => {
    if (!promoteCandidateId) return;
    await handleToggleRole(promoteCandidateId, 'user');
    setPromoteCandidateId('');
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Administrace
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            title="Zavřít administraci"
            aria-label="Zavřít administraci"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'users'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Uživatelé
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'roles'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Role
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'groups'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Skupiny
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'tags'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Štítky
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'archive'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Archiv
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Hint odstraněn – žádné seedování uživatelů z UI */}
              {/* Demo sdílení odstraněno */}
              {users.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {user.full_name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        localStorage.setItem('impersonateUserId', user.id);
                        window.location.reload();
                      }}
                      className="px-3 py-1 rounded text-sm font-medium border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600"
                      title="Náhled jako tento uživatel"
                    >
                      Náhled
                    </button>
                    <button
                      onClick={() => handleToggleRole(user.id, user.role)}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        user.role === 'admin'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {user.role === 'admin' ? 'Admin' : 'Uživatel'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-100 dark:bg-slate-700/40 rounded-lg flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">Správa rolí</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Přidávejte a odebírejte administrátory. Běžní uživatelé nemají přístup k nastavení ani správě ostatních.
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-slate-600 dark:text-slate-300">
                  <p><strong>{adminUsers.length}</strong> administrátor{adminUsers.length === 1 ? '' : adminUsers.length >= 2 && adminUsers.length <= 4 ? 'i' : 'ů'}</p>
                  <p><strong>{regularUsers.length}</strong> běžných uživatelů</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <section className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h5 className="text-lg font-medium text-slate-900 dark:text-white">Administrátoři</h5>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Mají plný přístup do administrace, k uživatelům, skupinám i archivovaným kategoriím.
                  </p>

                  <div className="mt-4 space-y-2">
                    {adminUsers.length === 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Zatím nejsou nastaveni žádní administrátoři.</p>
                    )}

                    {adminUsers.map(admin => (
                      <div
                        key={admin.id}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{admin.full_name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{admin.email}</p>
                        </div>
                        <button
                          onClick={() => handleToggleRole(admin.id, 'admin')}
                          disabled={adminUsers.length <= 1}
                          className={`px-3 py-1 rounded text-sm font-medium border transition ${
                            adminUsers.length <= 1
                              ? 'border-slate-300 dark:border-slate-600 text-slate-400 cursor-not-allowed'
                              : 'border-red-300 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10'
                          }`}
                          title={adminUsers.length <= 1 ? 'Musí zůstat alespoň jeden administrátor' : 'Odebrat uživatele z role administrátor'}
                        >
                          Odebrat roli
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h6 className="font-medium text-slate-900 dark:text-white">Přidat administrátora</h6>
                    {regularUsers.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Všichni uživatelé již mají roli administrátor.</p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                          Vyberte existujícího uživatele, který získá přístup do administrace.
                        </p>
                        <div className="mt-3 flex flex-col sm:flex-row gap-3">
                          <select
                            value={promoteCandidateId}
                            onChange={(e) => setPromoteCandidateId(e.target.value)}
                            className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                            aria-label="Vyberte uživatele, kterému chcete udělit roli administrátora"
                          >
                            <option value="">Vyberte uživatele</option>
                            {regularUsers.map(user => (
                              <option key={user.id} value={user.id}>
                                {user.full_name} ({user.email})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handlePromoteToAdmin}
                            disabled={!promoteCandidateId}
                            className={`px-4 py-2 rounded text-sm font-medium transition ${
                              promoteCandidateId
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            Přidat
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <section className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h5 className="text-lg font-medium text-slate-900 dark:text-white">Běžní uživatelé</h5>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Vidí pouze své vlastní nebo s nimi sdílené kategorie a nemohou vstoupit do administrace.
                  </p>

                  <div className="mt-4 space-y-2">
                    {regularUsers.length === 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Žádní běžní uživatelé.</p>
                    )}
                    {regularUsers.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{user.full_name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                        <button
                          onClick={() => handleToggleRole(user.id, 'user')}
                          className="px-3 py-1 rounded text-sm font-medium border border-blue-300 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition"
                        >
                          Udělit roli Admin
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="space-y-4">
              <button
                onClick={() => setShowAddGroup(true)}
                className="w-full flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Users className="w-5 h-5" />
                <span>Vytvořit novou skupinu</span>
              </button>

              {showAddGroup && (
                <form onSubmit={handleCreateGroup} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Název skupiny"
                    required
                    autoFocus
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white mb-3"
                  />
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddGroup(false);
                        setNewGroupName('');
                      }}
                      className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      Zrušit
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                    >
                      Vytvořit
                    </button>
                  </div>
                </form>
              )}

              {groups.map(group => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <p className="font-medium text-slate-900 dark:text-white">
                      {group.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const newExpanded = expandedGroupId === group.id ? null : group.id;
                        setExpandedGroupId(newExpanded);
                        if (newExpanded) await loadGroupMembers(group.id);
                      }}
                      className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm"
                    >
                      Členové
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition text-red-600 dark:text-red-400"
                      title="Smazat skupinu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {expandedGroupId && (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-medium text-slate-900 dark:text-white mb-3">Správa členů</h4>
                  <div className="space-y-2 mb-4">
                    {(groupMembers[expandedGroupId] || []).map((uid) => {
                      const u = users.find(us => us.id === uid);
                      if (!u) return null;
                      return (
                        <div key={uid} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-700/50">
                          <span className="text-sm text-slate-800 dark:text-slate-200">{u.full_name} ({u.email})</span>
                          <button
                            onClick={() => handleRemoveMember(expandedGroupId, uid)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                            title="Odebrat člena"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={addingMemberUserId}
                      onChange={(e) => setAddingMemberUserId(e.target.value)}
                      className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                      aria-label="Vyberte uživatele pro přidání do skupiny"
                    >
                      <option value="">Vyberte uživatele</option>
                      {users
                        .filter(u => !(groupMembers[expandedGroupId] || []).includes(u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                        ))}
                    </select>
                    <button
                      onClick={() => handleAddMember(expandedGroupId)}
                      className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    >
                      Přidat
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Merge className="w-4 h-4" /> Sloučit štítky
                </h4>
                <div className="flex items-center gap-2">
                  <select
                    value={mergeSourceId}
                    onChange={(e) => setMergeSourceId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                    aria-label="Zdrojový štítek pro sloučení"
                  >
                    <option value="">Zdrojový štítek</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={mergeTargetName}
                    onChange={(e) => setMergeTargetName(e.target.value)}
                    placeholder="Cílový štítek (existující nebo nový)"
                    className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                  />
                  <button
                    onClick={handleMergeTags}
                    className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                  >
                    Sloučit
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        defaultValue={tag.name}
                        onChange={(e) => setRenameTagIds(prev => ({ ...prev, [tag.id]: e.target.value }))}
                        className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRenameTag(tag.id)}
                        className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-600"
                        title="Přejmenovat"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                        title="Smazat štítek"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'archive' && (
            <div className="space-y-2">
              {archived.length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-400">Archiv je prázdný.</p>
              )}
              {archived.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{cat.name}</span>
                    <span className="text-xs text-slate-500">({cat.id.slice(0, 8)})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreCategory(cat.id)}
                      className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-600"
                      title="Obnovit"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                      title="Trvale smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
