import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { DragEvent } from 'react';
import { Plus, FolderPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Header } from './Header';
import { PinnedLinksBar } from './PinnedLinksBar';
import { CategoryCard } from './CategoryCard';
import { AddCategoryModal } from '../Modals/AddCategoryModal';
import { AddLinkModal } from '../Modals/AddLinkModal';
import { ShareCategoryModal } from '../Modals/ShareCategoryModal';
import { ShareLinkModal } from '../Modals/ShareLinkModal';
import { AdminPanel } from '../Admin/AdminPanel';
import { EditCategoryModal } from '../Modals/EditCategoryModal';
import { EditLinkModal } from '../Modals/EditLinkModal';
import { SettingsModal } from '../Modals/SettingsModal';
import { filterCategories } from '../../lib/search';

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
}

// Types for Supabase responses with nested relations
type DbLinkWithTags = {
  id: string;
  display_name: string;
  url: string;
  favicon_url: string | null;
  is_archived?: boolean;
  display_order: number;
  category_id: string;
  link_tags?: { tags: { name: string } }[];
};

// (unused legacy type removed)

type RpcCategoryRow = {
  id: string;
  name: string;
  owner_id: string;
  is_archived: boolean;
  display_order: number;
  created_at: string;
  permission: 'viewer' | 'editor' | 'owner' | null;
  shared_link_ids: string[] | null;
  color_hex: string;
};

export const Dashboard = () => {
  const { user, profile, impersonatedUserId } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResetToken, setSearchResetToken] = useState(0);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddLink, setShowAddLink] = useState<string | null>(null);
  const [shareCategoryId, setShareCategoryId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<{ id: string; name: string } | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editCategory, setEditCategory] = useState<{ id: string; name: string; color_hex: string } | null>(null);
  const [editLinkId, setEditLinkId] = useState<string | null>(null);
  const [collapseMode, setCollapseMode] = useState<'none' | 'collapsed' | 'expanded'>('none');
  const [manualExpandedCategories, setManualExpandedCategories] = useState<string[]>([]);
  const refreshTimerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const previewUserId = impersonatedUserId && impersonatedUserId !== user?.id ? impersonatedUserId : null;

  useEffect(() => {
    const focusSearch = (selectAll = false) => {
      const input = searchInputRef.current;
      if (!input) return;
      if (document.activeElement !== input) {
        input.focus();
      }
      requestAnimationFrame(() => {
        const length = input.value.length;
        input.setSelectionRange(selectAll ? 0 : length, length);
      });
    };

    const handleGlobalKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === 'Escape') {
        setSearchQuery('');
        setSearchResetToken((token) => token + 1);
        const input = searchInputRef.current;
        if (input && document.activeElement === input) {
          input.blur();
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        if (target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
          return;
        }
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        focusSearch(true);
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        focusSearch();
        setSearchQuery((prev) => {
          if (!prev) {
            return prev;
          }
          return prev.slice(0, -1);
        });
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        focusSearch();
        const character = event.key;
        setSearchQuery((prev) => `${prev}${character}`);
      }
    };

    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  }, [searchQuery]);

  // Throttle pro refresh, aby se více změn sloučilo do jedné
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current != null) return;
    refreshTimerRef.current = window.setTimeout(() => {
      setRefreshKey((k: number) => k + 1);
      refreshTimerRef.current = null;
    }, 300);
  }, []);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    // 1) Získej přístupné kategorie s oprávněním pomocí RPC
    const rpcArgs = previewUserId ? { override_user_id: previewUserId } : undefined;
    const { data: rpcCategories, error: rpcError } = await supabase
      .rpc('get_accessible_categories_with_permission', rpcArgs);

    if (rpcError) {
      console.error('Error loading accessible categories via RPC:', rpcError);
      return;
    }

    const viewerId = previewUserId || user.id;
    const cats = (rpcCategories || []) as RpcCategoryRow[];
    if (cats.length === 0) {
      setCategories([]);
      return;
    }

    // 2) Načti všechny odkazy s tagy pro dané kategorie jedním dotazem
    const categoryIds = cats.map((c) => c.id);
    const { data: linksData, error: linksError } = await supabase
      .from('links')
      .select(`
        id,
        display_name,
        url,
        favicon_url,
        is_archived,
        display_order,
        category_id,
        link_tags ( tags ( name ) )
      `)
      .in('category_id', categoryIds)
      .order('display_order');

    if (linksError) {
      console.error('Error loading links for categories:', linksError);
      return;
    }

    const linksByCategory = new Map<string, DbLinkWithTags[]>();
    (linksData as unknown as DbLinkWithTags[]).forEach((l) => {
      const arr = linksByCategory.get(l.category_id) || [];
      arr.push(l);
      linksByCategory.set(l.category_id, arr);
    });

    // 3) Sestav finální strukturu s linky a tagy
    const processed: Category[] = cats.map((c) => {
      const permission = (c.permission ?? undefined) as Category['permission'];
      const allowedLinkIds = Array.isArray(c.shared_link_ids) && c.shared_link_ids.length > 0 ? c.shared_link_ids : null;
      const links = (linksByCategory.get(c.id) || [])
        .map((link) => ({
          id: link.id,
          display_name: link.display_name,
          url: link.url,
          favicon_url: link.favicon_url,
          is_archived: (link as unknown as { is_archived?: boolean }).is_archived ?? false,
          display_order: link.display_order,
          tags: link.link_tags?.map((lt) => ({ name: lt.tags.name })) || [],
          isSharedLink: !!allowedLinkIds && allowedLinkIds.includes(link.id),
        }))
        .filter((link) => {
          if (!allowedLinkIds) return true;
          return allowedLinkIds.includes(link.id);
        })
        .sort((a, b) => a.display_order - b.display_order);
      return {
        id: c.id,
        name: c.name,
        owner_id: c.owner_id,
        is_archived: c.is_archived,
        display_order: c.display_order,
        links,
        isShared: viewerId ? c.owner_id !== viewerId : true,
        permission,
        sharedLinkIds: allowedLinkIds,
        color_hex: c.color_hex,
      };
    });
    setCategories(processed);
  }, [user, previewUserId]);

  const toggleCollapseAll = useCallback(() => {
    setCollapseMode((prev) => {
      if (prev === 'none') {
        setManualExpandedCategories([]);
        return 'collapsed';
      }
      if (prev === 'collapsed') {
        return 'expanded';
      }
      setManualExpandedCategories([]);
      return 'none';
    });
  }, []);

  const toggleManualExpand = useCallback((categoryId: string) => {
    setManualExpandedCategories((prev) => {
      const exists = prev.includes(categoryId);
      if (exists) {
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  }, []);

  useEffect(() => {
    loadCategories();
  }, [user, refreshKey, loadCategories]);

  // Demo autoseed odstraněn – aplikace běží pouze na reálných datech z DB

  // Realtime subscriptions to auto-refresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'link_tags' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'category_shares' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'link_shares' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tag_shares' }, scheduleRefresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, scheduleRefresh]);

  // Drag & drop reordering for categories
  const onCategoryDragStart = useCallback((e: DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('text/category-id', id);
  }, []);

  const onCategoryDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const onCategoryDrop = useCallback(async (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/category-id');
    if (!draggedId || draggedId === targetId) return;

    const idxFrom = categories.findIndex((c: Category) => c.id === draggedId);
    const idxTo = categories.findIndex((c: Category) => c.id === targetId);
    if (idxFrom === -1 || idxTo === -1) return;

    const prevOrder = [...categories];
    const newOrder = [...categories];
    const [moved] = newOrder.splice(idxFrom, 1);
    newOrder.splice(idxTo, 0, moved);
    setCategories(newOrder);

    // Persist display_order for own categories only; shared categories order is per owner, so we don't update them
    try {
      const own = newOrder.filter((c: Category) => c.owner_id === user?.id);
      await Promise.all(
        own.map((cat, index: number) =>
          supabase.from('categories').update({ display_order: index }).eq('id', cat.id)
        )
      );
    } catch (err) {
      console.error('Failed to persist category order, reverting...', err);
      setCategories(prevOrder);
    }
  }, [categories, user]);

  const filteredCategories = useMemo(() => filterCategories(categories, searchQuery), [categories, searchQuery]);

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Opravdu chcete smazat tuto kategorii a všechny její odkazy?')) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (!error) {
      setRefreshKey((k: number) => k + 1);
    }
  };

  const handleArchiveCategory = async (categoryId: string) => {
    const { error } = await supabase
      .from('categories')
      .update({ is_archived: true })
      .eq('id', categoryId);

    if (!error) {
      setRefreshKey((k: number) => k + 1);
    }
  };

  const ownCategories = filteredCategories.filter((cat: Category) => !cat.isShared);
  const sharedCategories = filteredCategories.filter((cat: Category) => cat.isShared);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAdmin={profile?.role === 'admin' ? () => setShowAdmin(true) : undefined}
        onAddCategory={() => setShowAddCategory(true)}
  onToggleCollapseAll={toggleCollapseAll}
  collapseState={collapseMode}
        searchResetToken={searchResetToken}
        searchInputRef={searchInputRef}
      />

      <PinnedLinksBar key={refreshKey} />

      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-6">
        {ownCategories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Moje kategorie
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {ownCategories.map((category: Category) => {
                const forcedExpanded = !!searchQuery || collapseMode === 'expanded' || (collapseMode === 'collapsed' && manualExpandedCategories.includes(category.id));
                const forcedCollapsed = collapseMode === 'collapsed' && !forcedExpanded;

                return (
                  <div
                    key={category.id}
                    className="relative"
                    draggable
                    onDragStart={(e: DragEvent<HTMLDivElement>) => onCategoryDragStart(e, category.id)}
                    onDragOver={onCategoryDragOver}
                    onDrop={(e: DragEvent<HTMLDivElement>) => onCategoryDrop(e, category.id)}
                  >
                    <CategoryCard
                      category={category}
                      onEdit={(cat: Category) => setEditCategory({ id: cat.id, name: cat.name, color_hex: cat.color_hex })}
                      onDelete={handleDeleteCategory}
                      onShare={(cat: Category) => setShareCategoryId(cat.id)}
                      onArchive={handleArchiveCategory}
                      onRefresh={() => setRefreshKey((k: number) => k + 1)}
                      onEditLink={(id: string) => setEditLinkId(id)}
                      onShareLink={(linkId: string, linkName: string) => setShareLink({ id: linkId, name: linkName })}
                      onAddLink={(catId: string) => setShowAddLink(catId)}
                      forceExpanded={forcedExpanded}
                      forceCollapsed={forcedCollapsed}
                      onForcedToggle={collapseMode === 'collapsed' && !searchQuery ? () => toggleManualExpand(category.id) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sharedCategories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Sdíleno se mnou
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {sharedCategories.map((category: Category) => {
                const forcedExpanded = !!searchQuery || collapseMode === 'expanded' || (collapseMode === 'collapsed' && manualExpandedCategories.includes(category.id));
                const forcedCollapsed = collapseMode === 'collapsed' && !forcedExpanded;

                return (
                  <div key={category.id} className="relative">
                    <CategoryCard
                      category={category}
                      onEdit={(cat: Category) => setEditCategory({ id: cat.id, name: cat.name, color_hex: cat.color_hex })}
                      onDelete={handleDeleteCategory}
                      onShare={(cat: Category) => setShareCategoryId(cat.id)}
                      onArchive={handleArchiveCategory}
                      onRefresh={() => setRefreshKey((k: number) => k + 1)}
                      onEditLink={(id: string) => setEditLinkId(id)}
                      onShareLink={(linkId: string, linkName: string) => setShareLink({ id: linkId, name: linkName })}
                      onAddLink={(catId: string) => setShowAddLink(catId)}
                      forceExpanded={forcedExpanded}
                      forceCollapsed={forcedCollapsed}
                      onForcedToggle={collapseMode === 'collapsed' && !searchQuery ? () => toggleManualExpand(category.id) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredCategories.length === 0 && (
          <div className="text-center py-20">
            <FolderPlus className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">
              {searchQuery ? 'Nenalezeny žádné výsledky' : 'Žádné kategorie'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {searchQuery ? 'Zkuste jiné hledání' : 'Začněte vytvořením nové kategorie'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddCategory(true)}
                className="inline-flex items-center space-x-2 rounded-full border border-[#f05a28]/40 bg-white/30 backdrop-blur px-6 py-3 text-[#f05a28] shadow-sm transition hover:bg-white/45 hover:border-[#f05a28]/60"
              >
                <Plus className="w-5 h-5" />
                <span>Vytvořit první kategorii</span>
              </button>
            )}
          </div>
        )}
      </main>

      <AddCategoryModal
        isOpen={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSuccess={() => setRefreshKey((k: number) => k + 1)}
      />

      {showAddLink && (
        <AddLinkModal
          isOpen={true}
          categoryId={showAddLink}
          onClose={() => setShowAddLink(null)}
          onSuccess={() => setRefreshKey((k: number) => k + 1)}
        />
      )}

      {shareCategoryId && (
        <ShareCategoryModal
          isOpen={true}
          categoryId={shareCategoryId}
          onClose={() => setShareCategoryId(null)}
        />
      )}

      {shareLink && (
        <ShareLinkModal
          isOpen={true}
          linkId={shareLink.id}
          linkName={shareLink.name}
          onClose={() => setShareLink(null)}
          onSaved={() => setRefreshKey((k: number) => k + 1)}
        />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {profile?.role === 'admin' && (
        <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} />
      )}

      {editCategory && (
        <EditCategoryModal
          isOpen={true}
          categoryId={editCategory.id}
          initialName={editCategory.name}
          initialColor={editCategory.color_hex}
          onClose={() => setEditCategory(null)}
          onSuccess={() => setRefreshKey((k: number) => k + 1)}
        />
      )}

      {editLinkId && (
        <EditLinkModal
          isOpen={true}
          linkId={editLinkId}
          onClose={() => setEditLinkId(null)}
          onSuccess={() => setRefreshKey((k: number) => k + 1)}
        />
      )}
    </div>
  );
};
