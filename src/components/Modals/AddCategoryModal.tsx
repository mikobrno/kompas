import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_CATEGORY_COLOR, normalizeHexColor } from '../../lib/colors';
import { CategoryColorPicker } from '../CategoryColorPicker';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCategoryModal = ({ isOpen, onClose, onSuccess }: AddCategoryModalProps) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR);

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
          color_hex: normalizeHexColor(color),
        });

      if (error) {
        console.error('Create category failed:', error);
        alert(`Nepodařilo se vytvořit kategorii: ${error.message || 'neznámá chyba'}`);
        return;
      }

      setName('');
      setColor(DEFAULT_CATEGORY_COLOR);
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
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#f05a28]/30 bg-white/95 dark:bg-slate-900/95 shadow-2xl shadow-[#f05a28]/10">
        <div className="flex items-center justify-between p-6 border-b border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-white/30 dark:bg-slate-900/40 rounded-t-2xl">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Nová kategorie
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
              className="w-full px-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition"
              placeholder="např. Produktivita, Marketing..."
            />
          </div>

          <CategoryColorPicker value={color} onChange={setColor} label="Barva karty" />

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-[#f05a28]/30 bg-white/70 text-[#f05a28] dark:text-[#ff8b5c] hover:bg-[#f05a28]/15 hover:border-[#f05a28]/50 transition"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-[#f05a28] hover:bg-[#ff7846] text-white shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Vytváření...' : 'Vytvořit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
