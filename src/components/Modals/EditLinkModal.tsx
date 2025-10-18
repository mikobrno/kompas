import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EditLinkModalProps {
  isOpen: boolean;
  linkId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditLinkModal = ({ isOpen, linkId, onClose, onSuccess }: EditLinkModalProps) => {
  const [displayName, setDisplayName] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!isOpen) return;
      const { data: link } = await supabase
        .from('links')
        .select('*')
        .eq('id', linkId)
        .single();

      if (link) {
        setDisplayName(link.display_name);
        setUrl(link.url);
      }

      const { data: linkTags } = await supabase
        .from('link_tags')
        .select('tags(name)')
        .eq('link_id', linkId);

  const tagNames = (linkTags || []).map((lt) => (lt as unknown as { tags: { name: string } }).tags.name);
      setTags(tagNames.join(', '));
    };
    load();
  }, [isOpen, linkId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error: updateError } = await supabase
      .from('links')
      .update({ display_name: displayName, url })
      .eq('id', linkId);

    if (updateError) {
      console.error(updateError);
      setLoading(false);
      return;
    }

    // Rebuild tags set for the link
    await supabase.from('link_tags').delete().eq('link_id', linkId);
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    for (const tagName of tagList) {
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .maybeSingle();
      let tagId: string | undefined = existing?.id;
      if (!tagId) {
        const { data: newTag } = await supabase
          .from('tags')
          .insert({ name: tagName })
          .select('id')
          .single();
        tagId = newTag?.id;
      }
      if (tagId) {
        await supabase.from('link_tags').insert({ link_id: linkId, tag_id: tagId });
      }
    }

    setLoading(false);
    onClose();
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Upravit odkaz
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            title="Zavřít"
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
              placeholder="např. Google Docs"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              placeholder="https://..."
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              placeholder="projekt1, klient-a, důležité"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {loading ? 'Ukládání...' : 'Uložit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
