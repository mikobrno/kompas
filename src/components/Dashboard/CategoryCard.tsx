import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { MoreVertical, Edit2, Trash2, Share2, Archive, Pin, Users, ChevronDown, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { extractHostname, iconHorseFavicon, googleFavicon, duckDuckGoFavicon } from '../../lib/favicons';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeHexColor, hexToRgba } from '../../lib/colors';
import { createPortal } from 'react-dom';

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
  sharedLinkIds?: string[] | null;
  hasSharedContent?: boolean; // vlastníci: kategorie je sdílená nebo obsahuje sdílené položky
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
  onAddLink?: (categoryId: string) => void;
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
  onAddLink,
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

    const menuButtonRef = useRef<HTMLButtonElement | null>(null);
    const [menuCoords, setMenuCoords] = useState<{ top: number; right: number } | null>(null);
  const accent = useMemo(() => normalizeHexColor(category.color_hex), [category.color_hex]);
  const cardStyle = useMemo(() => ({
    borderColor: hexToRgba(accent, 0.3),
    boxShadow: `0 8px 32px ${hexToRgba(accent, 0.15)}, 0 2px 8px ${hexToRgba(accent, 0.08)}`,
  }), [accent]);
  const headerStyle = useMemo(() => ({
    borderColor: hexToRgba(accent, 0.4),
    background: `linear-gradient(135deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.08)} 100%)`,
  }), [accent]);
  const accentIconStyle = useMemo(() => ({ color: accent }), [accent]);
  const badgeStyle = useMemo(() => ({
    backgroundColor: hexToRgba(accent, 0.22),
    color: accent,
  }), [accent]);
  const partialBadgeStyle = useMemo(() => ({
    backgroundColor: hexToRgba(accent, 0.08),
    color: accent,
    border: `1px solid ${hexToRgba(accent, 0.55)}`,
  }), [accent]);
  const tagStyle = useMemo(() => ({
    borderColor: hexToRgba(accent, 0.3),
    backgroundColor: hexToRgba(accent, 0.12),
    color: accent,
  }), [accent]);
  const linkBorderStyle = useMemo(() => ({ borderColor: hexToRgba(accent, 0.4) }), [accent]);
  const subtleBorderStyle = useMemo(() => ({ borderColor: hexToRgba(accent, 0.35) }), [accent]);
  const menuWidth = 208; // Tailwind w-52

  const closeCategoryMenu = useCallback(() => {
    setShowMenu(false);
  }, []);

  const updateMenuCoords = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();
    setMenuCoords({
      top: rect.bottom + window.scrollY,
      right: rect.right + window.scrollX,
    });
  }, []);

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

  useEffect(() => {
    if (!showMenu) return;
    updateMenuCoords();

    const handleWindowChange = () => updateMenuCoords();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCategoryMenu();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleWindowChange);
      window.addEventListener('scroll', handleWindowChange, true);
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleWindowChange);
        window.removeEventListener('scroll', handleWindowChange, true);
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [showMenu, updateMenuCoords, closeCategoryMenu]);

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
    // Označ přetahovaný prvek jako link, aby šlo přesouvat i mezi kategoriemi
    try {
      e.dataTransfer.setData('text/link-id', linkId);
      e.dataTransfer.setData('text/source-category-id', category.id);
    } catch {
      // ignore – některá prostředí (testy) mohou mít omezený dataTransfer
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const onLinkDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onLinkDrop = async (e: DragEvent<HTMLDivElement>, targetLinkId: string) => {
    e.preventDefault();
    e.stopPropagation(); // zabráníme, aby drop bublal na úroveň kategorie
    const transferId = (() => {
      try {
        return e.dataTransfer.getData('text/link-id');
      } catch {
        return '';
      }
    })();
    const sourceId = dragLinkId || (transferId || null);
    setDragLinkId(null);
    if (!sourceId || sourceId === targetLinkId) return;

    const prev = [...linksLocal];
    const links = [...linksLocal];
    const fromIdx = links.findIndex(l => l.id === sourceId);
    const toIdx = links.findIndex(l => l.id === targetLinkId);
    if (toIdx === -1) return;

    // Přesun v rámci stejné kategorie
    if (fromIdx !== -1) {
      const [moved] = links.splice(fromIdx, 1);
      links.splice(toIdx, 0, moved);

      setLinksLocal(links);
      try {
        await Promise.all(
          links.map((l, index) => supabase.from('links').update({ display_order: index }).eq('id', l.id))
        );
        onRefresh();
      } catch (err) {
        console.error('Chyba při ukládání pořadí odkazů, vracím zpět', err);
        setLinksLocal(prev);
      }
      return;
    }

    // Přesun z jiné kategorie – vlož před targetLinkId
    try {
      // Posuň existující pořadí od cílového indexu
      await Promise.all(
        links
          .slice(toIdx)
          .map((l, indexOffset) =>
            supabase.from('links').update({ display_order: toIdx + 1 + indexOffset }).eq('id', l.id)
          )
      );
      // Přesuň samotný odkaz do této kategorie a nastav jeho pořadí
      await supabase
        .from('links')
        .update({ category_id: category.id, display_order: toIdx })
        .eq('id', sourceId);

      onRefresh();
    } catch (err) {
      console.error('Přesun odkazu mezi kategoriemi selhal:', err);
    }
  };

  // Umožni přetažení odkazu z jiné kategorie na prázdné místo v této kategorii (přidá na konec)
  const onCategoryAreaDragOver = (e: DragEvent<HTMLDivElement>) => {
    // Povolit drop, pokud jde o link
    const linkId = e.dataTransfer?.getData && e.dataTransfer.getData('text/link-id');
    if (linkId) {
      e.preventDefault();
    }
  };

  const onCategoryAreaDrop = async (e: DragEvent<HTMLDivElement>) => {
    const linkId = e.dataTransfer?.getData && e.dataTransfer.getData('text/link-id');
    if (!linkId) return; // nejedná se o přesun odkazu
    e.preventDefault();
    e.stopPropagation();

    // Pokud už odkaz patří do této kategorie, nic – reorder řeší per-link drop zóna
    const alreadyHere = linksLocal.some((l) => l.id === linkId);
    if (alreadyHere) return;

    // Nastav odkaz do této kategorie na konec seznamu
    const nextIndex = linksLocal.length;
    const { error } = await supabase
      .from('links')
      .update({ category_id: category.id, display_order: nextIndex })
      .eq('id', linkId);

    if (error) {
      console.error('Přesun odkazu do jiné kategorie selhal:', error);
      return;
    }

    onRefresh();
  };

  const categoryMenuPortal = showMenu && menuCoords && typeof document !== 'undefined'
    ? createPortal(
        <>
          <div className="fixed inset-0 z-[1500]" onClick={closeCategoryMenu} />
          <div
            className="fixed z-[1510] w-52 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border overflow-hidden"
            style={{
              ...subtleBorderStyle,
              top: menuCoords.top + 8,
              left: Math.max(16, menuCoords.right - menuWidth),
            }}
          >
            <button
              onClick={() => {
                closeCategoryMenu();
                onEdit(category);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left border-b border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/25 dark:border-slate-500/30 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 transition-all duration-200 text-slate-700 dark:text-slate-200"
            >
              <Edit2 className="w-5 h-5" />
              <span className="font-medium">Přejmenovat</span>
            </button>
            {isOwner && (
              <button
                onClick={() => {
                  closeCategoryMenu();
                  onShare(category);
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left border-b border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/25 dark:border-slate-500/30 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 transition-all duration-200 text-slate-700 dark:text-slate-200"
              >
                <Share2 className="w-5 h-5" />
                <span className="font-medium">Sdílet</span>
              </button>
            )}
            <button
              onClick={() => {
                closeCategoryMenu();
                onArchive(category.id);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left border-b border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/25 dark:border-slate-500/30 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 transition-all duration-200 text-slate-700 dark:text-slate-200"
            >
              <Archive className="w-5 h-5" />
              <span className="font-medium">Archivovat</span>
            </button>
            <button
              onClick={() => {
                closeCategoryMenu();
                onDelete(category.id);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left bg-white/10 backdrop-blur-sm hover:bg-red-50/50 dark:bg-slate-700/40 dark:hover:bg-red-900/20 transition-all duration-200 text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-5 h-5" />
              <span className="font-medium">Smazat</span>
            </button>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <div
        className={`bg-white/90 dark:bg-slate-800/85 backdrop-blur-xl rounded-2xl shadow-md border transition-all duration-300 hover:shadow-xl ${showMenu || showLinkMenu ? 'relative z-50' : ''}`}
        style={cardStyle}
      >
      <div
        className="px-2 py-1.5 flex items-center justify-between border-b rounded-t-2xl backdrop-blur-md"
        style={headerStyle}
      >
        <button
          type="button"
          onClick={toggleCollapse}
          className="group flex items-center gap-1.5 flex-1 pr-1.5 py-1 rounded-lg border border-transparent bg-transparent text-left transition-all duration-200 hover:border-white/50 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 dark:hover:bg-slate-700/40"
          aria-label={collapsed ? 'Rozbalit kategorii' : 'Sbalit kategorii'}
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-lg border border-white/40 bg-white/30 backdrop-blur-sm shadow-sm dark:border-slate-500/50 dark:bg-slate-700/70 transition-transform duration-300 group-hover:scale-110">
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-300 ${collapsed ? '-rotate-90' : ''}`}
              style={accentIconStyle}
            />
          </span>
          <span className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 flex-1 min-w-0">
            <span className="whitespace-normal break-words" title={category.name}>{category.name}</span>
            {(() => {
              const isFullShared = category.isShared && (!category.sharedLinkIds || category.sharedLinkIds.length === 0);
              const isPartialShared = !isFullShared && !!category.hasSharedContent;
              if (!isFullShared && !isPartialShared) return null;
              const label = isFullShared
                ? `Sdílená celá kategorie${categoryPermLabel ? ` – ${categoryPermLabel}` : ''}`
                : 'Obsahuje sdílené položky';
              return (
              <span
                className="inline-flex items-center text-xs rounded-full px-1 py-0.5 shadow-sm"
                style={isFullShared ? badgeStyle : partialBadgeStyle}
                title={label}
                aria-label={label}
              >
                <Users className="w-2.5 h-2.5" />
                <span className="sr-only">Sdílené</span>
              </span>
              );
            })()}
          </span>
        </button>

        {canManageCategory && (
          <button
            ref={menuButtonRef}
            onClick={() => {
              const next = !showMenu;
              setShowMenu(next);
              if (next) {
                updateMenuCoords();
              }
            }}
            className="p-1 rounded-lg border border-white/40 bg-white/25 backdrop-blur-sm hover:bg-white/40 dark:border-slate-500/50 dark:bg-slate-700/60 dark:hover:bg-slate-700/80 transition-all duration-200 shadow-sm hover:scale-105"
            title="Možnosti"
          >
            <MoreVertical className="w-3 h-3" style={accentIconStyle} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="p-2 space-y-1.5" onDragOver={onCategoryAreaDragOver} onDrop={onCategoryAreaDrop}>
          {linksLocal.filter(l => !l.is_archived).length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8 text-sm font-medium">
            Žádné odkazy
          </p>
        ) : (
          linksLocal.filter(l => !l.is_archived).map((link) => (
            <div
              key={link.id}
              className={`group relative bg-white/85 dark:bg-slate-800/75 backdrop-blur-md border rounded-lg p-2 transition-all duration-300 hover:shadow-md hover:scale-[1.01] ${showLinkMenu === link.id ? 'z-10' : ''}`}
              style={linkBorderStyle}
              draggable={canEdit}
              onDragStart={(e) => onLinkDragStart(e, link.id)}
              onDragOver={onLinkDragOver}
              onDrop={(e) => onLinkDrop(e, link.id)}
            >
              <a
                href={link.url}
                className="flex items-center space-x-2"
              >
                {(() => {
                  const host = extractHostname(link.url);
                  // Start with icon.horse
                  const primary = host ? iconHorseFavicon(host) : link.favicon_url;

                  if (!primary) {
                    return <div className="w-6 h-6 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 rounded-lg flex-shrink-0 shadow-sm" />;
                  }
                  return (
                    <div className="w-6 h-6 rounded-lg overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center shadow-sm flex-shrink-0">
                      <img
                        src={primary}
                        alt=""
                        className="w-5 h-5 object-contain"
                        data-favicon-attempt="primary"
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement & { dataset: { faviconAttempt?: string } };
                          const attempt = el.dataset.faviconAttempt || 'primary';

                          if (attempt === 'primary' && host) {
                            el.dataset.faviconAttempt = 'google';
                            el.src = googleFavicon(host, 64);
                          } else if (attempt === 'google' && host) {
                            el.dataset.faviconAttempt = 'ddg';
                            el.src = duckDuckGoFavicon(host);
                          } else if (attempt === 'ddg' && link.favicon_url && link.favicon_url !== el.src) {
                            el.dataset.faviconAttempt = 'db';
                            el.src = link.favicon_url;
                          } else {
                            el.style.display = 'none';
                          }
                        }}
                      />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                      {link.display_name}
                    </p>
                    {link.isSharedLink && (
                      <span
                        className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] flex-shrink-0 shadow-sm"
                        style={badgeStyle}
                        title="Sdílené (odkaz/štítek)"
                        aria-label="Sdílené (odkaz/štítek)"
                      >
                        <Users className="w-2.5 h-2.5" />
                        <span className="sr-only">Sdílené</span>
                      </span>
                    )}
                  </div>
                  {link.tags && link.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {link.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border backdrop-blur-sm shadow-sm transition-all duration-200"
                          style={tagStyle}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </a>

              <div className="absolute right-2.5 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => setShowLinkMenu(showLinkMenu === link.id ? null : link.id)}
                  className="p-1.5 rounded-xl border border-white/40 bg-white/30 backdrop-blur-sm hover:bg-white/50 dark:border-slate-500/50 dark:bg-slate-700/60 dark:hover:bg-slate-700/80 shadow-sm transition-all duration-200 hover:scale-105"
                  title="Možnosti odkazu"
                >
                  <MoreVertical className="w-4 h-4" style={accentIconStyle} />
                </button>

                {showLinkMenu === link.id && (
                  <>
                    <div
                      className="fixed inset-0 z-[1500]"
                      onClick={() => setShowLinkMenu(null)}
                    />
                    <div
                      className="absolute right-0 mt-2 w-44 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border overflow-hidden z-[1510]"
                      style={subtleBorderStyle}
                    >
                      <button
                        onClick={() => {
                          setShowLinkMenu(null);
                          pinLink(link.id);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left border-b border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/25 dark:border-slate-500/30 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 transition-all duration-200 text-slate-700 dark:text-slate-200"
                      >
                        <Pin className="w-5 h-5" />
                        <span className="font-medium">Připnout</span>
                      </button>
                      {canManageLinks && (
                        <button
                          onClick={() => {
                            setShowLinkMenu(null);
                            onShareLink(link.id, link.display_name);
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-left border-b border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/25 dark:border-slate-500/30 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 transition-all duration-200 text-slate-700 dark:text-slate-200"
                        >
                          <Share2 className="w-5 h-5" />
                          <span className="font-medium">Sdílet</span>
                        </button>
                      )}
                      {canManageLinks && (
                        <button
                          onClick={() => {
                            setShowLinkMenu(null);
                            onEditLink(link.id);
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-left border-b border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/25 dark:border-slate-500/30 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 transition-all duration-200 text-slate-700 dark:text-slate-200"
                        >
                          <Edit2 className="w-5 h-5" />
                          <span className="font-medium">Upravit</span>
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
                          className="w-full flex items-center space-x-3 px-4 py-3 text-left border-b border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/25 dark:border-slate-500/30 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 transition-all duration-200 text-slate-700 dark:text-slate-200"
                        >
                          <Archive className="w-5 h-5" />
                          <span className="font-medium">Archivovat</span>
                        </button>
                      )}
                      {canManageLinks && (
                        <button
                          onClick={() => {
                            setShowLinkMenu(null);
                            deleteLink(link.id);
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-left bg-white/10 backdrop-blur-sm hover:bg-red-50/50 dark:bg-slate-700/40 dark:hover:bg-red-900/20 transition-all duration-200 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-5 h-5" />
                          <span className="font-medium">Smazat</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
        {canManageLinks && onAddLink && (
          <div className="pt-3 flex justify-end">
            <button
              onClick={() => onAddLink(category.id)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-white/40 bg-white/30 backdrop-blur-sm hover:bg-white/50 dark:border-slate-500/50 dark:bg-slate-700/50 dark:hover:bg-slate-700/70 transition-all duration-200 shadow-sm hover:scale-110"
              title="Přidat odkaz"
              aria-label="Přidat odkaz"
            >
              <Plus className="w-5 h-5" style={accentIconStyle} />
            </button>
          </div>
        )}

        {linksLocal.some(l => l.is_archived) && (
          <div className="pt-4 border-t" style={subtleBorderStyle}>
            <h4
              className="text-xs uppercase tracking-wider font-bold mb-3"
              style={accentIconStyle}
            >
              Archivované odkazy
            </h4>
            <div className="space-y-2.5">
              {linksLocal.filter(l => l.is_archived).map(link => (
                <div
                  key={link.id}
                  className="relative bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm border rounded-xl p-3 opacity-75 hover:opacity-100 transition-all duration-200"
                  style={subtleBorderStyle}
                >
                  <div className="flex items-center justify-between">
                    <a href={link.url} className="truncate text-slate-700 dark:text-slate-300 font-medium text-sm">
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
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 hover:bg-white/40 dark:hover:bg-slate-700 shadow-sm"
                          style={linkBorderStyle}
                        >
                          Obnovit
                        </button>
                        <button
                          onClick={() => deleteLink(link.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-300/70 text-red-600 dark:border-red-500/70 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 shadow-sm transition-all duration-200"
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
      {categoryMenuPortal}
    </>
  );
};
