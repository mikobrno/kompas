import { useState, useEffect } from 'react';
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

interface Share {
  id: string;
  shared_with_user_id: string | null;
  shared_with_group_id: string | null;
  permission_level: 'viewer' | 'editor';
}

export const ShareCategoryModal = ({ isOpen, categoryId, onClose }: ShareCategoryModalProps) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<Map<string, 'viewer' | 'editor'>>(new Map());

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
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
    setShares(sharesData || []);

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
  };

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
    await supabase
      .from('category_shares')
      .delete()
      .eq('category_id', categoryId);

    const sharesToInsert = [];

    for (const userId of selectedUsers) {
      sharesToInsert.push({
        category_id: categoryId,
        shared_with_user_id: userId,
        shared_with_group_id: null,
        permission_level: permissions.get(`user-${userId}`) || 'viewer',
      });
    }

    for (const groupId of selectedGroups) {
      sharesToInsert.push({
        category_id: categoryId,
        shared_with_user_id: null,
        shared_with_group_id: groupId,
        permission_level: permissions.get(`group-${groupId}`) || 'viewer',
      });
    }

    if (sharesToInsert.length > 0) {
      await supabase
        .from('category_shares')
        .insert(sharesToInsert);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Sdílet kategorii
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {users.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <h4 className="font-medium text-slate-900 dark:text-white">Uživatelé</h4>
              </div>
              <div className="space-y-2">
                {users.map(userOption => {
                  const isSelected = selectedUsers.has(userOption.id);
                  const permission = permissions.get(`user-${userOption.id}`) || 'viewer';

                  return (
                    <div
                      key={userOption.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                    >
                      <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleUser(userOption.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
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
                          className="ml-4 px-3 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
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
              <div className="space-y-2">
                {groups.map(group => {
                  const isSelected = selectedGroups.has(group.id);
                  const permission = permissions.get(`group-${group.id}`) || 'viewer';

                  return (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                    >
                      <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleGroup(group.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <p className="font-medium text-slate-900 dark:text-white">
                          {group.name}
                        </p>
                      </label>

                      {isSelected && (
                        <select
                          value={permission}
                          onChange={(e) => handlePermissionChange(`group-${group.id}`, e.target.value as 'viewer' | 'editor')}
                          className="ml-4 px-3 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
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
