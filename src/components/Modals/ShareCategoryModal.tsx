import { useState, useEffect, useCallback } from 'react';
import { X, Users, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ShareCategoryModalProps {
  isOpen: boolean;
  categoryId: string;
  onClose: () => void;
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


export const ShareCategoryModal = ({ isOpen, categoryId, onClose }: ShareCategoryModalProps) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [initialSelectedUsers, setInitialSelectedUsers] = useState<Set<string>>(new Set());
  const [initialSelectedGroups, setInitialSelectedGroups] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<Map<string, 'viewer' | 'editor'>>(new Map());
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  const loadData = useCallback(async () => {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, email')
      .neq('id', user?.id);

    const { data: groupsData } = await supabase
      .from('groups')
      .select('id, name');

    const { data: sharesData } = await supabase
      .from('category_shares')
      .select('*')
      .eq('category_id', categoryId);

    setUsers(usersData || []);
    setGroups(groupsData || []);

    const newSelectedUsers = new Set<string>();
    const newSelectedGroups = new Set<string>();
    const newPermissions = new Map<string, 'viewer' | 'editor'>();

    (sharesData || []).forEach(share => {
      if (share.shared_with_user_id) {
        newSelectedUsers.add(share.shared_with_user_id);
        newPermissions.set(`user-${share.shared_with_user_id}`, share.permission_level);
      }
      if (share.shared_with_group_id) {
        newSelectedGroups.add(share.shared_with_group_id);
        newPermissions.set(`group-${share.shared_with_group_id}`, share.permission_level);
      }
    });

    setSelectedUsers(newSelectedUsers);
    setSelectedGroups(newSelectedGroups);
    setPermissions(newPermissions);
    setInitialSelectedUsers(new Set(newSelectedUsers));
    setInitialSelectedGroups(new Set(newSelectedGroups));
  }, [categoryId, user?.id]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
      const newPerms = new Map(permissions);
      newPerms.delete(`user-${userId}`);
      setPermissions(newPerms);
    } else {
      newSelected.add(userId);
      const newPerms = new Map(permissions);
      newPerms.set(`user-${userId}`, 'viewer');
      setPermissions(newPerms);
    }
    setSelectedUsers(newSelected);
  };

  const handleToggleGroup = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
      const newPerms = new Map(permissions);
      newPerms.delete(`group-${groupId}`);
      setPermissions(newPerms);
    } else {
      newSelected.add(groupId);
      const newPerms = new Map(permissions);
      newPerms.set(`group-${groupId}`, 'viewer');
      setPermissions(newPerms);
    }
    setSelectedGroups(newSelected);
  };

  const handlePermissionChange = (key: string, permission: 'viewer' | 'editor') => {
    const newPerms = new Map(permissions);
    newPerms.set(key, permission);
    setPermissions(newPerms);
  };

  const handleSave = async () => {
    try {
      await supabase
        .from('category_shares')
        .delete()
        .eq('category_id', categoryId);

      const sharesToInsert: {
        category_id: string;
        shared_with_user_id: string | null;
        shared_with_group_id: string | null;
        permission_level: 'viewer' | 'editor';
      }[] = [];

      selectedUsers.forEach((userId) => {
        sharesToInsert.push({
          category_id: categoryId,
          shared_with_user_id: userId,
          shared_with_group_id: null,
          permission_level: permissions.get(`user-${userId}`) || 'viewer',
        });
      });

      selectedGroups.forEach((groupId) => {
        sharesToInsert.push({
          category_id: categoryId,
          shared_with_user_id: null,
          shared_with_group_id: groupId,
          permission_level: permissions.get(`group-${groupId}`) || 'viewer',
        });
      });

      if (sharesToInsert.length > 0) {
        await supabase.from('category_shares').insert(sharesToInsert);
      }

      const { data: linksData, error: linksError } = await supabase
        .from('links')
        .select('id')
        .eq('category_id', categoryId);

      if (linksError) {
        throw linksError;
      }

      const linkIds = (linksData || []).map((link) => link.id);

      if (linkIds.length > 0) {
        const relevantUserIds = new Set<string>([
          ...initialSelectedUsers,
          ...selectedUsers,
        ]);
        const relevantGroupIds = new Set<string>([
          ...initialSelectedGroups,
          ...selectedGroups,
        ]);

        const { data: existingShares, error: existingError } = await supabase
          .from('link_shares')
          .select('id, link_id, shared_with_user_id, shared_with_group_id, permission_level')
          .in('link_id', linkIds);

        if (existingError) {
          throw existingError;
        }

        const existingMap = new Map<
          string,
          {
            id: string;
            link_id: string;
            shared_with_user_id: string | null;
            shared_with_group_id: string | null;
            permission_level: 'viewer' | 'editor';
          }
        >();

        (existingShares || []).forEach((share) => {
          const key = share.shared_with_user_id
            ? `user-${share.shared_with_user_id}`
            : share.shared_with_group_id
            ? `group-${share.shared_with_group_id}`
            : null;
          if (!key) return;
          existingMap.set(`${share.link_id}|${key}`, share);
        });

        const desiredEntries: Array<{
          key: string;
          permission: 'viewer' | 'editor';
          kind: 'user' | 'group';
          id: string;
        }> = [];

        selectedUsers.forEach((userId) => {
          desiredEntries.push({
            key: `user-${userId}`,
            permission: permissions.get(`user-${userId}`) || 'viewer',
            kind: 'user',
            id: userId,
          });
        });

        selectedGroups.forEach((groupId) => {
          desiredEntries.push({
            key: `group-${groupId}`,
            permission: permissions.get(`group-${groupId}`) || 'viewer',
            kind: 'group',
            id: groupId,
          });
        });

        const linkShareInserts: {
          link_id: string;
          shared_with_user_id: string | null;
          shared_with_group_id: string | null;
          permission_level: 'viewer' | 'editor';
        }[] = [];
        const linkShareUpdates: {
          id: string;
          permission_level: 'viewer' | 'editor';
        }[] = [];

        linkIds.forEach((linkId) => {
          desiredEntries.forEach((entry) => {
            const mapKey = `${linkId}|${entry.key}`;
            const existing = existingMap.get(mapKey);
            if (!existing) {
              linkShareInserts.push({
                link_id: linkId,
                shared_with_user_id: entry.kind === 'user' ? entry.id : null,
                shared_with_group_id: entry.kind === 'group' ? entry.id : null,
                permission_level: entry.permission,
              });
            } else {
              if (existing.permission_level !== entry.permission) {
                linkShareUpdates.push({
                  id: existing.id,
                  permission_level: entry.permission,
                });
              }
              existingMap.delete(mapKey);
            }
          });
        });

        const linkShareDeletes: string[] = [];
        existingMap.forEach((share) => {
          if (
            (share.shared_with_user_id && relevantUserIds.has(share.shared_with_user_id)) ||
            (share.shared_with_group_id && relevantGroupIds.has(share.shared_with_group_id))
          ) {
            linkShareDeletes.push(share.id);
          }
        });

        if (linkShareDeletes.length > 0) {
          await supabase.from('link_shares').delete().in('id', linkShareDeletes);
        }

        if (linkShareUpdates.length > 0) {
          await Promise.all(
            linkShareUpdates.map((update) =>
              supabase
                .from('link_shares')
                .update({ permission_level: update.permission_level })
                .eq('id', update.id)
            )
          );
        }

        if (linkShareInserts.length > 0) {
          await supabase.from('link_shares').insert(linkShareInserts);
        }
      }

      onClose();
    } catch (err) {
      console.error('Chyba při ukládání sdílení kategorie:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-[#f05a28]/30 shadow-2xl shadow-[#f05a28]/10 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-white/30 dark:bg-slate-900/40 rounded-t-2xl">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Sdílet kategorii
          </h3>
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
                <User className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
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
                  .filter(u =>
                    userSearch.trim()
                      ? (u.full_name + ' ' + u.email).toLowerCase().includes(userSearch.toLowerCase())
                      : true
                  )
                  .map(userOption => {
                  const isSelected = selectedUsers.has(userOption.id);
                  const permission = permissions.get(`user-${userOption.id}`) || 'viewer';

                  return (
                    <div
                      key={userOption.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-[#f05a28]/10 dark:bg-[#f05a28]/15"
                    >
                      <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleUser(userOption.id)}
                          className="w-4 h-4 rounded border-[#f05a28]/40 text-[#f05a28] focus:ring-[#f05a28]/40"
                        />
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {userOption.full_name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {userOption.email}
                          </p>
                        </div>
                      </label>

                      {isSelected && (
                        <select
                          value={permission}
                          onChange={(e) => handlePermissionChange(`user-${userOption.id}`, e.target.value as 'viewer' | 'editor')}
                          className="ml-4 px-3 py-1.5 rounded-lg border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                          aria-label={`Oprávnění pro uživatele ${userOption.full_name}`}
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
                  .filter(g =>
                    groupSearch.trim()
                      ? g.name.toLowerCase().includes(groupSearch.toLowerCase())
                      : true
                  )
                  .map(group => {
                  const isSelected = selectedGroups.has(group.id);
                  const permission = permissions.get(`group-${group.id}`) || 'viewer';

                  return (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-[#f05a28]/10 dark:bg-[#f05a28]/15"
                    >
                      <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleGroup(group.id)}
                          className="w-4 h-4 rounded border-[#f05a28]/40 text-[#f05a28] focus:ring-[#f05a28]/40"
                        />
                        <p className="font-medium text-slate-900 dark:text-white">
                          {group.name}
                        </p>
                      </label>

                      {isSelected && (
                        <select
                          value={permission}
                          onChange={(e) => handlePermissionChange(`group-${group.id}`, e.target.value as 'viewer' | 'editor')}
                          className="ml-4 px-3 py-1.5 rounded-lg border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                          aria-label={`Oprávnění pro skupinu ${group.name}`}
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
