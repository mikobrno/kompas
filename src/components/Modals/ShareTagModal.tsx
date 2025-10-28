import { useState, useEffect, useCallback } from 'react';
import { X, Users, User as UserIcon, Tag as TagIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ShareTagModalProps {
  isOpen: boolean;
  tagId: string;
  tagName: string;
  onClose: () => void;
  onSaved?: () => void;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
}

interface GroupOption {
  id: string;
  name: string;
}

export const ShareTagModal = ({ isOpen, tagId, tagName, onClose, onSaved }: ShareTagModalProps) => {
  const { user } = useAuth();
  const userId = user?.id;
  const [users, setUsers] = useState<UserOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<Map<string, 'viewer' | 'editor'>>(new Map());
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!userId) return;

    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, email')
      .neq('id', userId);

    const { data: groupsData } = await supabase
      .from('groups')
      .select('id, name');

    const { data: sharesData } = await supabase
      .from('tag_shares')
      .select('*')
      .eq('tag_id', tagId)
      .eq('owner_id', userId);

    setUsers(usersData || []);
    setGroups(groupsData || []);

    const nextUsers = new Set<string>();
    const nextGroups = new Set<string>();
    const nextPermissions = new Map<string, 'viewer' | 'editor'>();

    (sharesData || []).forEach((share) => {
      if (share.shared_with_user_id) {
        nextUsers.add(share.shared_with_user_id);
        nextPermissions.set(`user-${share.shared_with_user_id}`, share.permission_level);
      }
      if (share.shared_with_group_id) {
        nextGroups.add(share.shared_with_group_id);
        nextPermissions.set(`group-${share.shared_with_group_id}`, share.permission_level);
      }
    });

    setSelectedUsers(nextUsers);
    setSelectedGroups(nextGroups);
    setPermissions(nextPermissions);
  }, [tagId, userId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleToggleUser = (uid: string) => {
    const next = new Set(selectedUsers);
    const perms = new Map(permissions);
    if (next.has(uid)) {
      next.delete(uid);
      perms.delete(`user-${uid}`);
    } else {
      next.add(uid);
      perms.set(`user-${uid}`, 'viewer');
    }
    setSelectedUsers(next);
    setPermissions(perms);
  };

  const handleToggleGroup = (gid: string) => {
    const next = new Set(selectedGroups);
    const perms = new Map(permissions);
    if (next.has(gid)) {
      next.delete(gid);
      perms.delete(`group-${gid}`);
    } else {
      next.add(gid);
      perms.set(`group-${gid}`, 'viewer');
    }
    setSelectedGroups(next);
    setPermissions(perms);
  };

  const handlePermissionChange = (key: string, permission: 'viewer' | 'editor') => {
    const next = new Map(permissions);
    next.set(key, permission);
    setPermissions(next);
  };

  const handleSave = async () => {
    if (!userId) return;
    try {
      await supabase
        .from('tag_shares')
        .delete()
        .eq('tag_id', tagId)
        .eq('owner_id', userId);

      const inserts: {
        tag_id: string;
        owner_id: string;
        shared_with_user_id: string | null;
        shared_with_group_id: string | null;
        permission_level: 'viewer' | 'editor';
      }[] = [];

      selectedUsers.forEach((uid) => {
        inserts.push({
          tag_id: tagId,
          owner_id: userId,
          shared_with_user_id: uid,
          shared_with_group_id: null,
          permission_level: permissions.get(`user-${uid}`) || 'viewer',
        });
      });

      selectedGroups.forEach((gid) => {
        inserts.push({
          tag_id: tagId,
          owner_id: userId,
          shared_with_user_id: null,
          shared_with_group_id: gid,
          permission_level: permissions.get(`group-${gid}`) || 'viewer',
        });
      });

      if (inserts.length) {
        await supabase.from('tag_shares').insert(inserts);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Chyba při ukládání sdílení štítku:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-[#f05a28]/30 shadow-2xl shadow-[#f05a28]/10 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-white/30 dark:bg-slate-900/40 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <TagIcon className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Sdílet štítek</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{tagName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-transparent hover:border-[#f05a28]/30 hover:bg-white/40 dark:hover:bg-slate-800/60 transition"
            title="Zavřít"
            aria-label="Zavřít dialog"
          >
            <X className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {users.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <UserIcon className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
                <h4 className="font-medium text-slate-900 dark:text-white">Uživatelé</h4>
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Hledat uživatele..."
                  className="w-full px-3 py-2.5 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/50"
                  aria-label="Hledat uživatele"
                />
              </div>
              <div className="space-y-2">
                {users
                  .filter((u) =>
                    userSearch.trim()
                      ? `${u.full_name} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
                      : true
                  )
                  .map((u) => {
                    const selected = selectedUsers.has(u.id);
                    const permission = permissions.get(`user-${u.id}`) || 'viewer';
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-[#f05a28]/10 dark:bg-[#f05a28]/15"
                      >
                        <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleToggleUser(u.id)}
                            className="w-4 h-4 rounded border-[#f05a28]/40 text-[#f05a28] focus:ring-[#f05a28]/40"
                          />
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{u.full_name}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{u.email}</p>
                          </div>
                        </label>
                        {selected && (
                          <select
                            value={permission}
                            onChange={(e) => handlePermissionChange(`user-${u.id}`, e.target.value as 'viewer' | 'editor')}
                            className="ml-4 px-3 py-1.5 rounded-lg border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                            aria-label={`Oprávnění pro uživatele ${u.full_name}`}
                          >
                            <option value="viewer">Čtenář</option>
                            <option value="editor">Editor</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {groups.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Users className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
                <h4 className="font-medium text-slate-900 dark:text-white">Skupiny</h4>
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Hledat skupiny..."
                  className="w-full px-3 py-2.5 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/50"
                  aria-label="Hledat skupiny"
                />
              </div>
              <div className="space-y-2">
                {groups
                  .filter((g) =>
                    groupSearch.trim()
                      ? g.name.toLowerCase().includes(groupSearch.toLowerCase())
                      : true
                  )
                  .map((g) => {
                    const selected = selectedGroups.has(g.id);
                    const permission = permissions.get(`group-${g.id}`) || 'viewer';
                    return (
                      <div
                        key={g.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-[#f05a28]/10 dark:bg-[#f05a28]/15"
                      >
                        <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleToggleGroup(g.id)}
                            className="w-4 h-4 rounded border-[#f05a28]/40 text-[#f05a28] focus:ring-[#f05a28]/40"
                          />
                          <p className="font-medium text-slate-900 dark:text-white">{g.name}</p>
                        </label>
                        {selected && (
                          <select
                            value={permission}
                            onChange={(e) => handlePermissionChange(`group-${g.id}`, e.target.value as 'viewer' | 'editor')}
                            className="ml-4 px-3 py-1.5 rounded-lg border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                            aria-label={`Oprávnění pro skupinu ${g.name}`}
                          >
                            <option value="viewer">Čtenář</option>
                            <option value="editor">Editor</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#f05a28]/20 dark:border-[#f05a28]/15 flex space-x-3 rounded-b-2xl bg-white/30 dark:bg-slate-900/40">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-[#f05a28]/30 bg-white/70 text-[#f05a28] dark:text-[#ff8b5c] hover:bg-[#f05a28]/15 hover:border-[#f05a28]/50 transition"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 rounded-xl bg-[#f05a28] hover:bg-[#ff7846] text-white shadow-md transition"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
};
