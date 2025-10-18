import { useEffect, useState } from 'react';
import { X, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { profile, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFullName(profile?.full_name ?? '');
    setTheme(profile?.theme ?? 'light');
    setMessage(null);
  }, [isOpen, profile?.full_name, profile?.theme]);

  if (!isOpen) return null;

  const applyTheme = (selected: 'light' | 'dark') => {
    if (selected === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({ full_name: fullName.trim() || profile?.full_name || '', theme });
      applyTheme(theme);
      setMessage('Nastavení bylo uloženo.');
      setTimeout(() => onClose(), 800);
    } catch (err) {
      console.error('Uložení nastavení selhalo:', err);
      setMessage('Nepodařilo se uložit nastavení. Zkuste to znovu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[#f05a28]/30 bg-white/95 dark:bg-slate-900/95 shadow-2xl shadow-[#f05a28]/10">
        <div className="flex items-center justify-between p-6 border-b border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-white/30 dark:bg-slate-900/40 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#f05a28]/15 dark:bg-[#f05a28]/25">
              <SettingsIcon />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Nastavení účtu</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Upravte informace o profilu a vzhled aplikace.</p>
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

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <section>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Profil</h4>
            <div className="mt-3 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="settings-fullname">
                  Jméno a příjmení
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" />
                  <input
                    id="settings-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition"
                    placeholder="Vaše jméno"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Email účtu</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{profile?.email}</p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Vzhled</h4>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center space-x-3 rounded-xl px-4 py-3 transition border ${theme === 'light' ? 'border-[#f05a28] bg-[#f05a28]/15 dark:bg-[#f05a28]/25 text-[#f05a28] dark:text-[#ff8b5c]' : 'border-[#f05a28]/25 dark:border-[#f05a28]/20 hover:border-[#f05a28]/40 hover:bg-[#f05a28]/10'}`}
              >
                <Sun className="w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Světlý režim</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Vhodný pro dobře osvětlené prostředí.</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center space-x-3 rounded-xl px-4 py-3 transition border ${theme === 'dark' ? 'border-[#f05a28] bg-[#f05a28]/15 dark:bg-[#f05a28]/25 text-[#f05a28] dark:text-[#ff8b5c]' : 'border-[#f05a28]/25 dark:border-[#f05a28]/20 hover:border-[#f05a28]/40 hover:bg-[#f05a28]/10'}`}
              >
                <Moon className="w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Tmavý režim</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Šetří oči i baterii.</p>
                </div>
              </button>
            </div>
          </section>

          {message && (
            <div className="text-sm text-[#f05a28] dark:text-[#ff8b5c] bg-[#f05a28]/10 dark:bg-[#f05a28]/20 px-4 py-2 rounded-lg">
              {message}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl border border-[#f05a28]/30 bg-white/70 text-[#f05a28] dark:text-[#ff8b5c] hover:bg-[#f05a28]/15 hover:border-[#f05a28]/50 transition"
            >
              Zavřít
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-3 rounded-xl bg-[#f05a28] hover:bg-[#ff7846] text-white shadow-md transition disabled:opacity-50"
            >
              {saving ? 'Ukládám…' : 'Uložit změny'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SettingsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894a1.125 1.125 0 001.591.832l.764-.36a1.125 1.125 0 011.45.516l.547.95c.275.476.12 1.08-.331 1.4l-.764.55c-.718.516-.718 1.57 0 2.086l.764.55c.45.32.606.923.331 1.4l-.547.95a1.125 1.125 0 01-1.45.516l-.764-.36a1.125 1.125 0 00-1.591.832l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894a1.125 1.125 0 00-1.592-.832l-.763.36a1.125 1.125 0 01-1.45-.516l-.548-.95c-.275-.476-.12-1.08.331-1.4l.764-.55c.718-.516.718-1.57 0-2.086l-.764-.55c-.45-.32-.606-.923-.331-1.4l.548-.95a1.125 1.125 0 011.45-.516l.763.36a1.125 1.125 0 001.592-.832l.148-.894z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
