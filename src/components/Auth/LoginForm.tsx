import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BrandLogo } from '../Brand/BrandLogo';

interface LoginFormProps {
  onToggleForm: () => void;
}

export const LoginForm = ({ onToggleForm }: LoginFormProps) => {
  const isDev = import.meta.env.DEV;
  // Dev-only autofill admin credentials to allow one-click login
  const [email, setEmail] = useState(isDev ? 'kost@adminreal.cz' : '');
  const [password, setPassword] = useState(isDev ? 'milan123' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) setError(error.message);

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center justify-center mb-6">
          <BrandLogo size={56} />
          <h2 className="mt-4 text-3xl font-bold text-center text-slate-900 dark:text-white">
            Kompas
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 text-sm">
            Přihlaste se do firemního znalostního kompasu
          </p>
        </div>

        <p className="text-center text-slate-500 dark:text-slate-400 mb-8 text-sm">
          Přístup na jedno místo pro všechny důležité odkazy a zdroje
        </p>
        {isDev && (
          <div className="mb-4 text-xs text-center text-slate-500 dark:text-slate-400">
            Dev mód: pole jsou předvyplněna pro admina (kost@adminreal.cz / milan123)
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/70 focus:border-transparent transition"
              placeholder="vas.email@firma.cz"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Heslo
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/70 focus:border-transparent transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f05a28] hover:bg-[#ff7846] text-white font-medium py-3 px-4 rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Přihlašování...' : 'Přihlásit se'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onToggleForm}
            className="text-sm text-[#f05a28] dark:text-[#ff8b5c] hover:underline"
          >
            Nemáte účet? Zaregistrujte se
          </button>
        </div>
      </div>
    </div>
  );
};
