import { useState, useEffect, useCallback } from 'react';
import type { DragEvent } from 'react';
import { normalizePinnedRows } from '../../lib/normalize';
import { Pin, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PinnedLink {
  link_id: string;
  display_order: number;
  links: {
    id: string;
    display_name: string;
    url: string;
    favicon_url: string | null;
  };
}

export const PinnedLinksBar = () => {
  const { user } = useAuth();
  const [pinnedLinks, setPinnedLinks] = useState<PinnedLink[]>([]);
  const [dragLinkId, setDragLinkId] = useState<string | null>(null);

  const loadPinnedLinks = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('pinned_links')
      .select(`
        link_id,
        display_order,
        links (
          id,
          display_name,
          url,
          favicon_url
        )
      `)
      .eq('user_id', user.id)
      .order('display_order');

    if (error) {
      console.error('Error loading pinned links:', error);
      return;
    }

    const normalized = normalizePinnedRows(data) as unknown as PinnedLink[];

    setPinnedLinks(normalized || []);
  }, [user]);

  useEffect(() => {
    loadPinnedLinks();
  }, [loadPinnedLinks]);

  const onDragStart = (linkId: string, e: DragEvent<HTMLDivElement>) => {
    setDragLinkId(linkId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = async (targetLinkId: string, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sourceId = dragLinkId;
    setDragLinkId(null);
    if (!sourceId || sourceId === targetLinkId) return;

    const prev = [...pinnedLinks];
    const list = [...pinnedLinks];
    const fromIdx = list.findIndex(p => p.link_id === sourceId);
    const toIdx = list.findIndex(p => p.link_id === targetLinkId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setPinnedLinks(list);

    // persist new order
    try {
      await Promise.all(
        list.map((p, index) =>
          supabase
            .from('pinned_links')
            .update({ display_order: index })
            .eq('user_id', user?.id as string)
            .eq('link_id', p.link_id)
        )
      );
    } catch (err) {
      console.error('Failed to persist pinned order, reverting', err);
      setPinnedLinks(prev);
    }
  };

  const unpinLink = async (linkId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('pinned_links')
      .delete()
      .eq('user_id', user.id)
      .eq('link_id', linkId);

    if (!error) {
      await loadPinnedLinks();
    }
  };

  if (pinnedLinks.length === 0) return null;

  return (
    <div className="bg-gradient-to-b from-slate-100/80 to-slate-50/80 dark:from-slate-900/80 dark:to-slate-900/50 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-5">
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Pin className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Připnuté odkazy
          </h3>
        </div>

        <div className="flex flex-wrap gap-3">
          {pinnedLinks.map((pinnedLink: PinnedLink) => {
            const link = pinnedLink.links;
            return (
              <div
                key={pinnedLink.link_id}
                className="group relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl px-5 py-3 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400/60 dark:hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 hover:scale-105 cursor-move"
                draggable
                onDragStart={(e) => onDragStart(pinnedLink.link_id, e)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(pinnedLink.link_id, e)}
              >
                <a
                  href={link.url}
                  className="flex items-center space-x-3"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-lg overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center shadow-sm">
                    {link.favicon_url ? (
                      <img
                        src={link.favicon_url}
                        alt=""
                        className="w-5 h-5 object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-4 h-4 bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 rounded" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
                    {link.display_name}
                  </span>
                </a>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    unpinLink(pinnedLink.link_id);
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg shadow-red-500/30 hover:scale-110"
                  title="Odepnout"
                  aria-label="Odepnout"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
