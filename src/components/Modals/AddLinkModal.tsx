import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AddLinkModalProps {
  isOpen: boolean;
  categoryId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const getFaviconUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
  } catch {
    return '';
  }
};

export const AddLinkModal = ({ isOpen, categoryId, onClose, onSuccess }: AddLinkModalProps) => {
  const [displayName, setDisplayName] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Ověření duplicity URL v rámci kategorie
    const urlTrimmed = url.trim();
    const { data: duplicate } = await supabase
      .from('links')
      .select('id')
      .eq('category_id', categoryId)
      .eq('url', urlTrimmed)
      .limit(1);

    if (duplicate && duplicate.length > 0) {
      alert('Odkaz s touto URL již v této kategorii existuje.');
      setLoading(false);
      return;
    }

    const { data: links } = await supabase
      .from('links')
      .select('display_order')
      .eq('category_id', categoryId)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = links && links.length > 0 ? links[0].display_order + 1 : 0;

    const faviconUrl = getFaviconUrl(urlTrimmed);

    const { data: newLink, error: linkError } = await supabase
      .from('links')
      .insert({
        category_id: categoryId,
        display_name: displayName,
        url: urlTrimmed,
        favicon_url: faviconUrl,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (linkError) {
      console.error('Error creating link:', linkError);
      setLoading(false);
      return;
    }

    if (tags.trim() && newLink) {
      const tagNames = tags.split(',').map(t => t.trim()).filter(t => t);

      for (const tagName of tagNames) {
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .maybeSingle();

        let tagId: string;

        if (existingTag) {
          tagId = existingTag.id;
        } else {
          const { data: newTag, error: tagError } = await supabase
            .from('tags')
            .insert({ name: tagName })
            .select('id')
            .single();

          if (tagError || !newTag) continue;
          tagId = newTag.id;
        }

        await supabase
          .from('link_tags')
          .insert({
            link_id: newLink.id,
            tag_id: tagId,
          });
      }
    }

    setLoading(false);
    setDisplayName('');
    setUrl('');
    setTags('');
    onClose();
    onSuccess();
  };

  return (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#f05a28]/30 bg-white/95 dark:bg-slate-900/95 shadow-2xl shadow-[#f05a28]/10">
        <div className="flex items-center justify-between p-6 border-b border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-white/30 dark:bg-slate-900/40 rounded-t-2xl">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Nový odkaz
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
              Název odkazu
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition"
              placeholder="např. Google Docs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Štítky (oddělené čárkou)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition"
              placeholder="projekt1, klient-a, důležité"
            />
          </div>

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
              {loading ? 'Přidávání...' : 'Přidat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
