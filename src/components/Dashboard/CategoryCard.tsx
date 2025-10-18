import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { MoreVertical, Edit2, Trash2, Share2, Archive, Pin, UserPlus, Users, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Link {
  id: string;
  display_name: string;
  url: string;
  favicon_url: string | null;
  is_archived: boolean;
  display_order: number;
  tags?: { name: string }[];
  isSharedLink?: boolean;
}

interface Category {
  id: string;
  name: string;
  owner_id: string;
  is_archived: boolean;
  display_order: number;
  links: Link[];
  isShared?: boolean;
  permission?: 'viewer' | 'editor' | 'owner';
}

interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onShare: (category: Category) => void;
  onArchive: (categoryId: string) => void;
  onRefresh: () => void;
  onEditLink: (linkId: string) => void;
  onShareLink: (linkId: string, linkName: string) => void;
}

export const CategoryCard = ({
  category,
  onEdit,
  onDelete,
  onShare,
  onArchive,
  onRefresh,
  onEditLink,
  onShareLink,
}: CategoryCardProps) => {
  const { user, profile } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState<string | null>(null);
  const [dragLinkId, setDragLinkId] = useState<string | null>(null);
  const [linksLocal, setLinksLocal] = useState<Link[]>(category.links);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Synchronizace s props při změně kategorie/odkazů
  useEffect(() => {
    setLinksLocal(category.links);
  }, [category.links, category.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(`category-collapse-${category.id}`);
    setIsCollapsed(stored === '1');
  }, [category.id]);

  const isOwner = category.owner_id === user?.id;
  const canEdit = isOwner || category.permission === 'editor';
  const isAdmin = profile?.role === 'admin';
  const canManageCategory = isOwner || category.permission === 'editor' || isAdmin;
  const canManageLinks = canManageCategory;
  const categoryPermLabel = category.permission === 'editor' ? 'Editor' : category.permission === 'viewer' ? 'Čtenář' : undefined;

  const pinLink = async (linkId: string) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('pinned_links')
      .select('*')
      .eq('user_id', user.id);

    if (existing && existing.length >= 10) {
      alert('Můžete mít maximálně 10 připnutých odkazů');
      return;
    }

    const nextOrder = existing ? existing.length : 0;

    const { error } = await supabase
      .from('pinned_links')
      .insert({
        user_id: user.id,
        link_id: linkId,
        display_order: nextOrder,
      });

    if (!error) {
      onRefresh();
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(`category-collapse-${category.id}`, next ? '1' : '0');
      }
      return next;
    });
  };

  const deleteLink = async (linkId: string) => {
    if (!canManageLinks) return;
    if (!confirm('Opravdu chcete smazat tento odkaz?')) return;

    const prev = [...linksLocal];
    setLinksLocal(prev.filter((link) => link.id !== linkId));

    await supabase
      .from('pinned_links')
      .delete()
      .eq('link_id', linkId);

    const { error } = await supabase
      .from('links')
      .delete()
      .eq('id', linkId);

    if (error) {
      console.error('Smazání odkazu selhalo:', error);
      alert('Odkaz se nepodařilo smazat.');
      setLinksLocal(prev);
      return;
    }

    onRefresh();
  };

  const onLinkDragStart = (e: DragEvent<HTMLDivElement>, linkId: string) => {
    setDragLinkId(linkId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onLinkDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onLinkDrop = async (e: DragEvent<HTMLDivElement>, targetLinkId: string) => {
    e.preventDefault();
    const sourceId = dragLinkId;
    setDragLinkId(null);
    if (!sourceId || sourceId === targetLinkId) return;

    const prev = [...linksLocal];
    const links = [...linksLocal];
    const fromIdx = links.findIndex(l => l.id === sourceId);
    const toIdx = links.findIndex(l => l.id === targetLinkId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = links.splice(fromIdx, 1);
    links.splice(toIdx, 0, moved);

    // Optimisticky přeuspořádej lokální stav
    setLinksLocal(links);

    try {
      // Persist order
      await Promise.all(
        links.map((l, index) => supabase.from('links').update({ display_order: index }).eq('id', l.id))
      );
      onRefresh();
    } catch (err) {
      console.error('Chyba při ukládání pořadí odkazů, vracím zpět', err);
      setLinksLocal(prev);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="bg-gradient-to-r from-blue-50 to-slate-50 dark:from-slate-700 dark:to-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 flex-1 pr-2">
          <button
            onClick={toggleCollapse}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            aria-label={isCollapsed ? 'Rozbalit kategorii' : 'Sbalit kategorii'}
            aria-expanded={isCollapsed ? 'false' : 'true'}
          >
            <ChevronDown className={`w-4 h-4 text-slate-600 dark:text-slate-300 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          </button>
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 flex-1">
            <span className="whitespace-normal break-words" title={category.name}>{category.name}</span>
            {category.isShared && (
              <span
                className="inline-flex items-center gap-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5"
                title={`Sdílená kategorie${categoryPermLabel ? ` – ${categoryPermLabel}` : ''}`}
                aria-label={`Sdílená kategorie${categoryPermLabel ? ` – ${categoryPermLabel}` : ''}`}
              >
                <Users className="w-3 h-3" />
                <span>Sdílená</span>
              </span>
            )}
          </h3>
        </div>

        {canManageCategory && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition"
              title="Možnosti"
            >
              <MoreVertical className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-20">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(category);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Přejmenovat</span>
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onShare(category);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Sdílet</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onArchive(category.id);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Archivovat</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(category.id);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Smazat</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="p-4 space-y-2">
        {linksLocal.filter(l => !l.is_archived).length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8 text-sm">
            Žádné odkazy
          </p>
        ) : (
          linksLocal.filter(l => !l.is_archived).map((link) => (
            <div
              key={link.id}
              className="group relative bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              draggable={canEdit}
              onDragStart={(e) => onLinkDragStart(e, link.id)}
              onDragOver={onLinkDragOver}
              onDrop={(e) => onLinkDrop(e, link.id)}
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3"
              >
                {link.favicon_url ? (
                  <img
                    src={link.favicon_url}
                    alt=""
                    className="w-5 h-5 flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-5 h-5 bg-slate-300 dark:bg-slate-600 rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {link.display_name}
                    </p>
                    {link.isSharedLink && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 text-xs flex-shrink-0"
                        title="Sdíleno odkazem"
                        aria-label="Sdíleno odkazem"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Sdílené</span>
                      </span>
                    )}
                  </div>
                  {link.tags && link.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {link.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </a>

              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => setShowLinkMenu(showLinkMenu === link.id ? null : link.id)}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                  title="Možnosti odkazu"
                >
                  <MoreVertical className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>

                {showLinkMenu === link.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowLinkMenu(null)}
                    />
                    <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-20">
                      <button
                        onClick={() => {
                          setShowLinkMenu(null);
                          pinLink(link.id);
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
                      >
                        <Pin className="w-4 h-4" />
                        <span>Připnout</span>
                      </button>
                      {canManageLinks && (
                        <button
                          onClick={() => {
                            setShowLinkMenu(null);
                            onShareLink(link.id, link.display_name);
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>Sdílet</span>
                        </button>
                      )}
                      {canManageLinks && (
                        <button
                          onClick={() => {
                            setShowLinkMenu(null);
                            onEditLink(link.id);
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>Upravit</span>
                        </button>
                      )}
                      {canManageLinks && (
                        <button
                          onClick={async () => {
                            setShowLinkMenu(null);
                            const prev = [...linksLocal];
                            setLinksLocal(prev.map(l => l.id === link.id ? { ...l, is_archived: true } : l));
                            const { error } = await supabase.from('links').update({ is_archived: true }).eq('id', link.id);
                            if (error) {
                              console.error('Archivace odkazu selhala:', error);
                              setLinksLocal(prev);
                            } else {
                              onRefresh();
                            }
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
                        >
                          <Archive className="w-4 h-4" />
                          <span>Archivovat</span>
                        </button>
                      )}
                      {canManageLinks && (
                        <button
                          onClick={() => {
                            setShowLinkMenu(null);
                            deleteLink(link.id);
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Smazat</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
        {linksLocal.some(l => l.is_archived) && (
          <div className="pt-4">
            <h4 className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Archivované odkazy</h4>
            <div className="space-y-2">
              {linksLocal.filter(l => l.is_archived).map(link => (
                <div key={link.id} className="relative bg-slate-50/60 dark:bg-slate-700/40 rounded-lg p-3 opacity-80 hover:opacity-100 transition">
                  <div className="flex items-center justify-between">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="truncate text-slate-700 dark:text-slate-300">
                      {link.display_name}
                    </a>
                    {canManageLinks && (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            const prev = [...linksLocal];
                            setLinksLocal(prev.map(l => l.id === link.id ? { ...l, is_archived: false } : l));
                            const { error } = await supabase.from('links').update({ is_archived: false }).eq('id', link.id);
                            if (error) {
                              console.error('Obnovení odkazu selhalo:', error);
                              setLinksLocal(prev);
                            } else {
                              onRefresh();
                            }
                          }}
                          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          Obnovit
                        </button>
                        <button
                          onClick={() => deleteLink(link.id)}
                          className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 dark:border-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
                        >
                          Smazat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
