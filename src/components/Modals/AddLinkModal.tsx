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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Nový odkaz
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
              Název odkazu
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="projekt1, klient-a, důležité"
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
              {loading ? 'Přidávání...' : 'Přidat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
