import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCategoryModal = ({ isOpen, onClose, onSuccess }: AddCategoryModalProps) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { data: categories, error: orderErr } = await supabase
        .from('categories')
        .select('display_order')
        .eq('owner_id', user.id)
        .order('display_order', { ascending: false })
        .limit(1);

      const nextOrder = !orderErr && categories && categories.length > 0 ? categories[0].display_order + 1 : 0;

      const { error } = await supabase
        .from('categories')
        .insert({
          name,
          owner_id: user.id,
          display_order: nextOrder,
        });

      if (error) {
        console.error('Create category failed:', error);
        alert(`Nepodařilo se vytvořit kategorii: ${error.message || 'neznámá chyba'}`);
        return;
      }

      setName('');
      onClose();
      onSuccess();
    } catch (err) {
      console.error('Create category unexpected error:', err);
      alert('Nepodařilo se vytvořit kategorii (neočekávaná chyba). Viz konzole.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Nová kategorie
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            title="Zavřít"
            aria-label="Zavřít dialog"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Název kategorie
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="např. Produktivita, Marketing..."
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Vytváření...' : 'Vytvořit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
