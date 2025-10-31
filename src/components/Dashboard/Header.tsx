import { useEffect, useState, type RefObject } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Settings, Moon, Sun, Users, Search, Plus, ChevronsUpDown } from 'lucide-react';
import { BrandLogo } from '../Brand/BrandLogo';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSettings: () => void;
  onOpenAdmin?: () => void;
  onAddCategory?: () => void;
  searchInputRef?: RefObject<HTMLInputElement>;
  onToggleCollapseAll?: () => void;
  collapseState?: 'none' | 'collapsed' | 'expanded';
  searchResetToken?: number;
}

export const Header = ({ searchQuery, onSearchChange, onOpenSettings, onOpenAdmin, onAddCategory, searchInputRef, onToggleCollapseAll, collapseState = 'none', searchResetToken = 0 }: HeaderProps) => {
  const { profile, impersonatedUserId, clearImpersonation, signOut, updateProfile } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [searchValue, setSearchValue] = useState(searchQuery);

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery, searchResetToken]);

  useEffect(() => {
    const id = setTimeout(() => onSearchChange(searchValue), 250);
    return () => clearTimeout(id);
  }, [searchValue, onSearchChange]);

  const toggleTheme = async () => {
    const newTheme = profile?.theme === 'light' ? 'dark' : 'light';
    await updateProfile({ theme: newTheme });
    document.documentElement.classList.toggle('dark');
  };

  const collapseToggleTitle = collapseState === 'collapsed'
    ? 'Rozbalit všechny kategorie'
    : collapseState === 'expanded'
      ? 'Vrátit původní zobrazení'
      : 'Sbalit všechny kategorie';

  const collapseButtonStateClass = collapseState === 'collapsed'
    ? 'border-[#f05a28]/60 bg-[#f05a28]/15 text-[#f05a28] dark:border-[#ff8b5c]/60 dark:bg-[#ff8b5c]/20 dark:text-[#ff8b5c]'
    : collapseState === 'expanded'
      ? 'border-emerald-400/60 bg-emerald-100/60 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700 dark:border-emerald-400/60 dark:bg-emerald-500/25 dark:text-emerald-200 dark:hover:bg-emerald-500/20'
      : 'border-[#f05a28]/20 bg-white/70 text-slate-500 hover:bg-white/90 hover:text-[#f05a28] dark:border-slate-600/60 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-[#ff8b5c]';

  const collapseIconRotation = collapseState === 'collapsed'
    ? 'rotate-90'
    : collapseState === 'expanded'
      ? '-rotate-90'
      : '';


  return (
    <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 sticky top-0 z-50 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6">
        {impersonatedUserId && (
          <div className="-mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-2.5 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 text-amber-900 dark:text-amber-200 text-sm flex items-center justify-between rounded-b-xl backdrop-blur-sm">
            <span className="font-medium">Náhled jako uživatel (ID: {impersonatedUserId}). Data mohou být omezená dle sdílení.</span>
            <button onClick={clearImpersonation} className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-100 transition">Ukončit náhled</button>
          </div>
        )}
        <div className="flex items-center justify-between h-20 gap-4 py-3">
          <div className="flex items-center space-x-3.5">
            <BrandLogo size={42} />
            <div>
              <span className="block text-xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
                Kompas
              </span>
              <span className="block text-xs uppercase tracking-[0.22em] text-[#f05a28] dark:text-[#ff8b5c] font-semibold">
                Online rozcestník
              </span>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <label htmlFor="dashboard-search" className="sr-only">
              Hledat odkazy
            </label>
            <div className="relative w-full max-w-lg">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
              {onToggleCollapseAll && (
                <button
                  type="button"
                  onClick={onToggleCollapseAll}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#f05a28]/50 hover:scale-110 ${collapseButtonStateClass}`}
                  title={collapseToggleTitle}
                  aria-label={collapseToggleTitle}
                >
                  <ChevronsUpDown className={`w-4 h-4 transition-transform duration-300 ${collapseIconRotation}`} />
                </button>
              )}
              <input
                id="dashboard-search"
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Hledat v Kompasu"
                ref={searchInputRef}
                className="w-full rounded-2xl border border-[#f05a28]/30 bg-white/80 dark:bg-slate-800/90 backdrop-blur-md pl-11 pr-14 py-3 text-sm font-medium text-slate-900 placeholder-slate-500 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/60 dark:border-slate-600/40 dark:text-white dark:placeholder-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {onAddCategory && (
              <button
                onClick={onAddCategory}
                className="inline-flex items-center gap-2.5 rounded-2xl border-2 border-[#f05a28]/40 bg-gradient-to-br from-[#f05a28] to-[#d94b1f] backdrop-blur-sm px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#f05a28]/20 transition-all duration-200 hover:shadow-lg hover:shadow-[#f05a28]/30 hover:scale-105"
                aria-label="Přidat kategorii"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Nová kategorie</span>
              </button>
            )}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl border border-white/30 bg-white/20 backdrop-blur-md hover:bg-white/40 dark:border-slate-500/40 dark:bg-slate-700/60 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-sm hover:scale-105"
              title={profile?.theme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
              aria-label={profile?.theme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
            >
              {profile?.theme === 'light' ? (
                <Moon className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
              ) : (
                <Sun className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
              )}
            </button>

            {profile?.role === 'admin' && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="p-2.5 rounded-2xl border border-white/30 bg-white/20 backdrop-blur-md hover:bg-white/40 dark:border-slate-500/40 dark:bg-slate-700/60 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-sm hover:scale-105"
                title="Administrace"
                aria-label="Otevřít administraci"
              >
                <Users className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className="p-2.5 rounded-2xl border border-white/30 bg-white/20 backdrop-blur-md hover:bg-white/40 dark:border-slate-500/40 dark:bg-slate-700/60 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-sm hover:scale-105"
              title="Nastavení"
              aria-label="Otevřít nastavení"
            >
              <Settings className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center space-x-2.5 p-2.5 rounded-2xl border border-white/30 bg-white/20 backdrop-blur-md hover:bg-white/40 dark:border-slate-500/40 dark:bg-slate-700/60 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-sm hover:scale-105"
                aria-haspopup="menu"
                aria-label="Otevřít uživatelské menu"
              >
                <div className="w-9 h-9 rounded-2xl border-2 border-[#f05a28]/50 bg-gradient-to-br from-[#f05a28]/20 to-[#d94b1f]/10 text-[#f05a28] dark:text-[#ff8b5c] flex items-center justify-center shadow-sm">
                  <span className="font-bold text-sm">
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
                  <div className="absolute right-0 mt-3 w-72 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-600/80 z-20 overflow-hidden">
                    <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50">
                      <p className="font-bold text-slate-900 dark:text-white text-lg">
                        {profile?.full_name}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {profile?.email}
                      </p>
                      {profile?.role === 'admin' && (
                        <span className="inline-flex items-center mt-3 px-3 py-1.5 rounded-xl border-2 border-[#f05a28]/40 bg-gradient-to-br from-[#f05a28]/15 to-[#d94b1f]/10 text-[#f05a28] dark:border-[#f05a28]/50 dark:bg-[#f05a28]/20 dark:text-[#ff8b5c] text-xs font-bold shadow-sm">
                          Administrátor
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        signOut();
                      }}
                      className="w-full flex items-center space-x-3 px-5 py-4 text-left bg-white/60 hover:bg-red-50/80 dark:bg-slate-800/60 dark:hover:bg-red-900/20 transition-all duration-200 text-red-600 dark:text-red-400 font-semibold"
                    >
                      <LogOut className="w-5 h-5" />
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
