import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Settings, Moon, Sun, Users } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSettings: () => void;
  onOpenAdmin?: () => void;
}

export const Header = ({ searchQuery, onSearchChange, onOpenSettings, onOpenAdmin }: HeaderProps) => {
  const { profile, impersonatedUserId, clearImpersonation, signOut, updateProfile } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [searchValue, setSearchValue] = useState(searchQuery);

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const id = setTimeout(() => onSearchChange(searchValue), 250);
    return () => clearTimeout(id);
  }, [searchValue, onSearchChange]);

  const toggleTheme = async () => {
    const newTheme = profile?.theme === 'light' ? 'dark' : 'light';
    await updateProfile({ theme: newTheme });
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {impersonatedUserId && (
          <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-sm flex items-center justify-between">
            <span>Náhled jako uživatel (ID: {impersonatedUserId}). Data mohou být omezená dle sdílení.</span>
            <button onClick={clearImpersonation} className="underline font-medium">Ukončit náhled</button>
          </div>
        )}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Stopař
            </h1>
          </div>

          <div className="flex-1 max-w-2xl mx-8">
            <input
              type="text"
              placeholder="Hledat odkazy, kategorie nebo štítky..."
              aria-label="Hledat"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title={profile?.theme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
              aria-label={profile?.theme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
            >
              {profile?.theme === 'light' ? (
                <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              ) : (
                <Sun className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              )}
            </button>

            {profile?.role === 'admin' && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                title="Administrace"
                aria-label="Otevřít administraci"
              >
                <Users className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title="Nastavení"
              aria-label="Otevřít nastavení"
            >
              <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                aria-haspopup="menu"
                aria-expanded={showMenu ? 'true' : 'false'}
                aria-label="Otevřít uživatelské menu"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {profile?.full_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-20">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {profile?.full_name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {profile?.email}
                      </p>
                      {profile?.role === 'admin' && (
                        <span className="inline-block mt-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded">
                          Administrátor
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        signOut();
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-red-600 dark:text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Odhlásit se</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
