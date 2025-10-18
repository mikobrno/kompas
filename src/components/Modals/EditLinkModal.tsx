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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#f05a28]/30 bg-white/95 dark:bg-slate-900/95 shadow-2xl shadow-[#f05a28]/10">
        <div className="flex items-center justify-between p-6 border-b border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-white/30 dark:bg-slate-900/40 rounded-t-2xl">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Upravit odkaz
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-transparent hover:border-[#f05a28]/30 hover:bg-white/40 dark:hover:bg-slate-800/60 transition"
            title="Zavřít"
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
              placeholder="např. Google Docs"
              className="w-full px-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition"
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
              className="w-full px-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition"
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
              className="w-full px-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition"
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
              {loading ? 'Ukládání...' : 'Uložit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
