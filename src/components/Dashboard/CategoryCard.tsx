import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { MoreVertical, Edit2, Trash2, Share2, Archive, Pin, UserPlus, Users, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeHexColor, hexToRgba } from '../../lib/colors';

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
  color_hex: string;
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
  forceExpanded?: boolean;
  forceCollapsed?: boolean;
  onForcedToggle?: () => void;
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
  forceExpanded = false,
  forceCollapsed = false,
  onForcedToggle,
}: CategoryCardProps) => {
  const { user, profile } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState<string | null>(null);
  const [dragLinkId, setDragLinkId] = useState<string | null>(null);
  const [linksLocal, setLinksLocal] = useState<Link[]>(category.links);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapsed = forceExpanded ? false : forceCollapsed ? true : isCollapsed;

  const accent = useMemo(() => normalizeHexColor(category.color_hex), [category.color_hex]);
  const cardStyle = useMemo(() => ({
    borderColor: hexToRgba(accent, 0.4),
    boxShadow: `0 18px 35px ${hexToRgba(accent, 0.12)}`,
  }), [accent]);
  const headerStyle = useMemo(() => ({
    borderColor: hexToRgba(accent, 0.5),
    background: `linear-gradient(135deg, ${hexToRgba(accent, 0.24)} 0%, ${hexToRgba(accent, 0.1)} 100%)`,
  }), [accent]);
  const accentIconStyle = useMemo(() => ({ color: accent }), [accent]);
  const badgeStyle = useMemo(() => ({
    backgroundColor: hexToRgba(accent, 0.22),
    color: accent,
  }), [accent]);
  const tagStyle = useMemo(() => ({
    borderColor: hexToRgba(accent, 0.3),
    backgroundColor: hexToRgba(accent, 0.12),
    color: accent,
  }), [accent]);
  const linkBorderStyle = useMemo(() => ({ borderColor: hexToRgba(accent, 0.4) }), [accent]);
  const subtleBorderStyle = useMemo(() => ({ borderColor: hexToRgba(accent, 0.35) }), [accent]);

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
    if (forceCollapsed || forceExpanded) {
      if (onForcedToggle) {
        onForcedToggle();
      }
      return;
    }
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
    <div
      className="bg-white/85 dark:bg-slate-800/75 backdrop-blur-sm rounded-xl shadow-sm border transition-colors"
      style={cardStyle}
    >
      <div
        className="px-3 py-2 flex items-center justify-between border-b rounded-t-xl bg-white/20 dark:bg-slate-800/60"
        style={headerStyle}
      >
        <button
          type="button"
          onClick={toggleCollapse}
          className="group flex items-center gap-2.5 flex-1 pr-3 py-1.5 rounded-lg border border-transparent bg-transparent text-left transition hover:border-white/40 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/40 dark:hover:bg-slate-700/50"
          aria-label={collapsed ? 'Rozbalit kategorii' : 'Sbalit kategorii'}
        >
          <span className="flex items-center justify-center w-6 h-6 rounded-lg border border-white/30 bg-white/25 backdrop-blur dark:border-slate-500/40 dark:bg-slate-700/60">
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`}
              style={accentIconStyle}
            />
          </span>
          <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 flex-1">
            <span className="whitespace-normal break-words" title={category.name}>{category.name}</span>
            {category.isShared && (
              <span
                className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5"
                style={badgeStyle}
                title={`Sdílená kategorie${categoryPermLabel ? ` – ${categoryPermLabel}` : ''}`}
                aria-label={`Sdílená kategorie${categoryPermLabel ? ` – ${categoryPermLabel}` : ''}`}
              >
                <Users className="w-3 h-3" />
                <span>Sdílená</span>
              </span>
            )}
          </span>
        </button>

        {canManageCategory && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded border border-white/30 bg-white/20 backdrop-blur hover:bg-white/35 dark:border-slate-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition"
              title="Možnosti"
            >
              <MoreVertical className="w-4 h-4" style={accentIconStyle} />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  className="absolute right-0 mt-1 w-48 bg-white/95 dark:bg-slate-800 rounded-xl shadow-xl border z-20"
                  style={subtleBorderStyle}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(category);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left rounded-lg border border-white/30 bg-white/15 backdrop-blur hover:bg-white/30 dark:border-slate-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition text-slate-700 dark:text-slate-200"
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
                      className="w-full flex items-center space-x-2 px-4 py-2 text-left rounded-lg border border-white/30 bg-white/15 backdrop-blur hover:bg-white/30 dark:border-slate-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition text-slate-700 dark:text-slate-200"
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
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left rounded-lg border border-white/30 bg-white/15 backdrop-blur hover:bg-white/30 dark:border-slate-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition text-slate-700 dark:text-slate-200"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Archivovat</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(category.id);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left rounded-lg border border-red-200/70 bg-white/15 backdrop-blur hover:bg-white/30 dark:border-red-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition text-red-600 dark:text-red-400"
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

      {!collapsed && (
        <div className="p-4 space-y-2">
          {linksLocal.filter(l => !l.is_archived).length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-6 text-sm">
            Žádné odkazy
          </p>
        ) : (
          linksLocal.filter(l => !l.is_archived).map((link) => (
            <div
              key={link.id}
              className="group relative bg-white/80 dark:bg-slate-800/65 border rounded-lg p-2.5 transition hover:shadow-md"
              style={linkBorderStyle}
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
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                      {link.display_name}
                    </p>
                    {link.isSharedLink && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] flex-shrink-0"
                        style={badgeStyle}
                        title="Sdíleno odkazem"
                        aria-label="Sdíleno odkazem"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Sdílené</span>
                      </span>
                    )}
                  </div>
                  {link.tags && link.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {link.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full border backdrop-blur-sm shadow-sm"
                          style={tagStyle}
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
                  className="p-1 rounded border border-white/30 bg-white/20 backdrop-blur hover:bg-white/35 dark:border-slate-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70"
                  title="Možnosti odkazu"
                >
                  <MoreVertical className="w-4 h-4" style={accentIconStyle} />
                </button>

                {showLinkMenu === link.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowLinkMenu(null)}
                    />
                    <div
                      className="absolute right-0 mt-1 w-40 bg-white/95 dark:bg-slate-800 rounded-xl shadow-xl border z-20"
                      style={subtleBorderStyle}
                    >
                      <button
                        onClick={() => {
                          setShowLinkMenu(null);
                          pinLink(link.id);
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-left rounded-lg border border-white/30 bg-white/15 backdrop-blur hover:bg-white/30 dark:border-slate-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition text-slate-700 dark:text-slate-200"
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
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left rounded-lg border border-white/30 bg-white/15 backdrop-blur hover:bg-white/30 dark:border-slate-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition text-slate-700 dark:text-slate-200"
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
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left rounded-lg border border-white/30 bg-white/15 backdrop-blur hover:bg-white/30 dark:border-slate-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition text-slate-700 dark:text-slate-200"
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
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left rounded-lg border border-white/30 bg-white/15 backdrop-blur hover:bg-white/30 dark:border-slate-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition text-slate-700 dark:text-slate-200"
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
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left rounded-lg border border-red-200/70 bg-white/15 backdrop-blur hover:bg-white/30 dark:border-red-500/40 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition text-red-600 dark:text-red-400"
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
          <div className="pt-3">
            <h4
              className="text-xs uppercase tracking-wide mb-1.5"
              style={accentIconStyle}
            >
              Archivované odkazy
            </h4>
            <div className="space-y-2">
              {linksLocal.filter(l => l.is_archived).map(link => (
                <div
                  key={link.id}
                  className="relative bg-white/70 dark:bg-slate-800/50 border rounded-lg p-2.5 opacity-80 hover:opacity-100 transition"
                  style={subtleBorderStyle}
                >
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
                          className="px-2 py-1 text-xs rounded border transition hover:bg-white/40 dark:hover:bg-slate-700"
                          style={linkBorderStyle}
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
