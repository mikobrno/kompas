import { useState } from 'react';
import { MoreVertical, Edit2, Trash2, Share2, Archive, Pin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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

interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onShare: (category: Category) => void;
  onArchive: (categoryId: string) => void;
  onRefresh: () => void;
}

export const CategoryCard = ({
  category,
  onEdit,
  onDelete,
  onShare,
  onArchive,
  onRefresh,
}: CategoryCardProps) => {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState<string | null>(null);

  const isOwner = category.owner_id === user?.id;
  const canEdit = isOwner || category.permission === 'editor';

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

  const deleteLink = async (linkId: string) => {
    if (!confirm('Opravdu chcete smazat tento odkaz?')) return;

    const { error } = await supabase
      .from('links')
      .delete()
      .eq('id', linkId);

    if (!error) {
      onRefresh();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-slate-50 dark:from-slate-700 dark:to-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
          <span>{category.name}</span>
          {category.isShared && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">
              Sdíleno
            </span>
          )}
        </h3>

        {(isOwner || canEdit) && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition"
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
                  {isOwner && (
                    <>
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
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        {category.links.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8 text-sm">
            Žádné odkazy
          </p>
        ) : (
          category.links.map((link) => (
            <div
              key={link.id}
              className="group relative bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
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
                  <p className="font-medium text-slate-900 dark:text-white truncate">
                    {link.display_name}
                  </p>
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
                      {canEdit && (
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
      </div>
    </div>
  );
};
