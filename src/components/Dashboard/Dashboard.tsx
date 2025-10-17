import { useState, useEffect, useMemo } from 'react';
import { Plus, FolderPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Header } from './Header';
import { PinnedLinksBar } from './PinnedLinksBar';
import { CategoryCard } from './CategoryCard';
import { AddCategoryModal } from '../Modals/AddCategoryModal';
import { AddLinkModal } from '../Modals/AddLinkModal';
import { ShareCategoryModal } from '../Modals/ShareCategoryModal';
import { AdminPanel } from '../Admin/AdminPanel';

interface Link {
  id: string;
  display_name: string;
  url: string;
  favicon_url: string | null;
  display_order: number;
  tags?: { name: string }[];
}

interface Category {
  id: string;
  name: string;
  owner_id: string;
  is_archived: boolean;
  display_order: number;
  links: Link[];
  isShared?: boolean;
  permission?: 'viewer' | 'editor';
}

export const Dashboard = () => {
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddLink, setShowAddLink] = useState<string | null>(null);
  const [shareCategoryId, setShareCategoryId] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadCategories = async () => {
    if (!user) return;

    const { data: ownCategories, error: ownError } = await supabase
      .from('categories')
      .select(`
        *,
        links (
          id,
          display_name,
          url,
          favicon_url,
          display_order,
          link_tags (
            tags (
              name
            )
          )
        )
      `)
      .eq('owner_id', user.id)
      .eq('is_archived', false)
      .order('display_order');

    if (ownError) {
      console.error('Error loading own categories:', ownError);
      return;
    }

    const { data: shares, error: sharesError } = await supabase
      .from('category_shares')
      .select(`
        permission_level,
        categories (
          id,
          name,
          owner_id,
          is_archived,
          display_order,
          links (
            id,
            display_name,
            url,
            favicon_url,
            display_order,
            link_tags (
              tags (
                name
              )
            )
          )
        )
      `)
      .or(`shared_with_user_id.eq.${user.id},shared_with_group_id.in.(${await getUserGroupIds()})`);

    if (sharesError) {
      console.error('Error loading shared categories:', sharesError);
    }

    const processedOwn = (ownCategories || []).map(cat => ({
      ...cat,
      links: (cat.links || [])
        .map((link: any) => ({
          ...link,
          tags: link.link_tags?.map((lt: any) => ({ name: lt.tags.name })) || [],
        }))
        .sort((a: Link, b: Link) => a.display_order - b.display_order),
    }));

    const processedShared = (shares || [])
      .filter(share => share.categories && !share.categories.is_archived)
      .map(share => ({
        ...(share.categories as any),
        isShared: true,
        permission: share.permission_level,
        links: ((share.categories as any).links || [])
          .map((link: any) => ({
            ...link,
            tags: link.link_tags?.map((lt: any) => ({ name: lt.tags.name })) || [],
          }))
          .sort((a: Link, b: Link) => a.display_order - b.display_order),
      }));

    setCategories([...processedOwn, ...processedShared]);
  };

  const getUserGroupIds = async (): Promise<string> => {
    if (!user) return '';

    const { data } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    return data?.map(gm => gm.group_id).join(',') || '';
  };

  useEffect(() => {
    loadCategories();
  }, [user, refreshKey]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase();

    return categories
      .map(category => {
        const categoryMatches = category.name.toLowerCase().includes(query);

        const filteredLinks = category.links.filter(link => {
          const nameMatches = link.display_name.toLowerCase().includes(query);
          const urlMatches = link.url.toLowerCase().includes(query);
          const tagsMatch = link.tags?.some(tag => tag.name.toLowerCase().includes(query));

          return nameMatches || urlMatches || tagsMatch;
        });

        if (categoryMatches || filteredLinks.length > 0) {
          return {
            ...category,
            links: categoryMatches ? category.links : filteredLinks,
          };
        }

        return null;
      })
      .filter((cat): cat is Category => cat !== null);
  }, [categories, searchQuery]);

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Opravdu chcete smazat tuto kategorii a všechny její odkazy?')) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (!error) {
      setRefreshKey(k => k + 1);
    }
  };

  const handleArchiveCategory = async (categoryId: string) => {
    const { error } = await supabase
      .from('categories')
      .update({ is_archived: true })
      .eq('id', categoryId);

    if (!error) {
      setRefreshKey(k => k + 1);
    }
  };

  const ownCategories = filteredCategories.filter(cat => cat.owner_id === user?.id);
  const sharedCategories = filteredCategories.filter(cat => cat.isShared);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => {}}
        onOpenAdmin={profile?.role === 'admin' ? () => setShowAdmin(true) : undefined}
      />

      <PinnedLinksBar key={refreshKey} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <button
            onClick={() => setShowAddCategory(true)}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            <span>Nová kategorie</span>
          </button>
        </div>

        {ownCategories.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Moje kategorie
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {ownCategories.map(category => (
                <div key={category.id} className="relative">
                  <CategoryCard
                    category={category}
                    onEdit={() => {}}
                    onDelete={handleDeleteCategory}
                    onShare={() => setShareCategoryId(category.id)}
                    onArchive={handleArchiveCategory}
                    onRefresh={() => setRefreshKey(k => k + 1)}
                  />
                  <button
                    onClick={() => setShowAddLink(category.id)}
                    className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition"
                    title="Přidat odkaz"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {sharedCategories.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Sdíleno se mnou
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sharedCategories.map(category => (
                <div key={category.id} className="relative">
                  <CategoryCard
                    category={category}
                    onEdit={() => {}}
                    onDelete={handleDeleteCategory}
                    onShare={() => {}}
                    onArchive={handleArchiveCategory}
                    onRefresh={() => setRefreshKey(k => k + 1)}
                  />
                  {category.permission === 'editor' && (
                    <button
                      onClick={() => setShowAddLink(category.id)}
                      className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition"
                      title="Přidat odkaz"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
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
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
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
        onSuccess={() => setRefreshKey(k => k + 1)}
      />

      {showAddLink && (
        <AddLinkModal
          isOpen={true}
          categoryId={showAddLink}
          onClose={() => setShowAddLink(null)}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      )}

      {shareCategoryId && (
        <ShareCategoryModal
          isOpen={true}
          categoryId={shareCategoryId}
          onClose={() => setShareCategoryId(null)}
        />
      )}

      {profile?.role === 'admin' && (
        <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
};
