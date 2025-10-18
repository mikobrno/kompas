import { useState, useEffect, useCallback } from 'react';
import { X, Users, User as UserIcon, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ShareLinkModalProps {
  isOpen: boolean;
  linkId: string;
  linkName: string;
  onClose: () => void;
  onSaved: () => void;
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

export const ShareLinkModal = ({ isOpen, linkId, linkName, onClose, onSaved }: ShareLinkModalProps) => {
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
      .from('link_shares')
      .select('*')
      .eq('link_id', linkId);

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
  }, [linkId, userId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleToggleUser = (userId: string) => {
    const next = new Set(selectedUsers);
    const nextPermissions = new Map(permissions);
    if (next.has(userId)) {
      next.delete(userId);
      nextPermissions.delete(`user-${userId}`);
    } else {
      next.add(userId);
      nextPermissions.set(`user-${userId}`, 'viewer');
    }
    setSelectedUsers(next);
    setPermissions(nextPermissions);
  };

  const handleToggleGroup = (groupId: string) => {
    const next = new Set(selectedGroups);
    const nextPermissions = new Map(permissions);
    if (next.has(groupId)) {
      next.delete(groupId);
      nextPermissions.delete(`group-${groupId}`);
    } else {
      next.add(groupId);
      nextPermissions.set(`group-${groupId}`, 'viewer');
    }
    setSelectedGroups(next);
    setPermissions(nextPermissions);
  };

  const handlePermissionChange = (key: string, permission: 'viewer' | 'editor') => {
    const next = new Map(permissions);
    next.set(key, permission);
    setPermissions(next);
  };

  const handleSave = async () => {
    try {
      await supabase
        .from('link_shares')
        .delete()
        .eq('link_id', linkId);

      const inserts: {
        link_id: string;
        shared_with_user_id: string | null;
        shared_with_group_id: string | null;
        permission_level: 'viewer' | 'editor';
      }[] = [];

      selectedUsers.forEach((userId) => {
        inserts.push({
          link_id: linkId,
          shared_with_user_id: userId,
          shared_with_group_id: null,
          permission_level: permissions.get(`user-${userId}`) || 'viewer',
        });
      });

      selectedGroups.forEach((groupId) => {
        inserts.push({
          link_id: linkId,
          shared_with_user_id: null,
          shared_with_group_id: groupId,
          permission_level: permissions.get(`group-${groupId}`) || 'viewer',
        });
      });

      if (inserts.length > 0) {
        await supabase.from('link_shares').insert(inserts);
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Chyba při ukládání sdílení odkazu:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <LinkIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Sdílet odkaz</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{linkName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            title="Zavřít"
            aria-label="Zavřít dialog"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {users.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <UserIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <h4 className="font-medium text-slate-900 dark:text-white">Uživatelé</h4>
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Hledat uživatele..."
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
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
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                      >
                        <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleToggleUser(u.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
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
                            className="ml-4 px-3 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
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
                <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <h4 className="font-medium text-slate-900 dark:text-white">Skupiny</h4>
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Hledat skupiny..."
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
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
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                      >
                        <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleToggleGroup(g.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <p className="font-medium text-slate-900 dark:text-white">{g.name}</p>
                        </label>
                        {selected && (
                          <select
                            value={permission}
                            onChange={(e) => handlePermissionChange(`group-${g.id}`, e.target.value as 'viewer' | 'editor')}
                            className="ml-4 px-3 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
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

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
};
