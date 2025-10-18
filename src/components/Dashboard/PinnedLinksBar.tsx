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
    <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center space-x-2 mb-3">
          <Pin className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Připnuté odkazy
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {pinnedLinks.map((pinnedLink: PinnedLink) => {
            const link = pinnedLink.links;
            return (
              <div
                key={pinnedLink.link_id}
                className="group relative bg-white dark:bg-slate-800 rounded-lg px-4 py-2 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition"
                draggable
                onDragStart={(e) => onDragStart(pinnedLink.link_id, e)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(pinnedLink.link_id, e)}
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2"
                >
                  {link.favicon_url ? (
                    <img
                      src={link.favicon_url}
                      alt=""
                      className="w-4 h-4"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                  )}
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {link.display_name}
                  </span>
                </a>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    unpinLink(pinnedLink.link_id);
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                  title="Odepnout"
                  aria-label="Odepnout"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
