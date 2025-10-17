import { useState, useEffect } from 'react';
import { X, UserPlus, Users, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanel = ({ isOpen, onClose }: AdminPanelProps) => {
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

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

    setUsers(usersData || []);
    setGroups(groupsData || []);
  };

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

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);

    if (!error) {
      loadData();
    }
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
            onClick={() => setActiveTab('groups')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'groups'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Skupiny
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
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
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
