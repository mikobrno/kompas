export type Tag = { name: string };
export type Link = {
  id: string;
  display_name: string;
  url: string;
  favicon_url: string | null;
  is_archived: boolean;
  display_order: number;
  tags?: Tag[];
  isSharedLink?: boolean;
};
export type Category = {
  id: string;
  name: string;
  owner_id: string;
  is_archived: boolean;
  display_order: number;
  links: Link[];
  isShared?: boolean;
  permission?: 'viewer' | 'editor' | 'owner';
};

export function filterCategories(categories: Category[], query: string): Category[] {
  const q = query.trim().toLowerCase();
  if (!q) return categories;
  return categories
    .map((category) => {
      const categoryMatches = category.name.toLowerCase().includes(q);
      const filteredLinks = category.links.filter((link) => {
        const nameMatches = link.display_name.toLowerCase().includes(q);
        const urlMatches = link.url.toLowerCase().includes(q);
        const tagsMatch = link.tags?.some((t) => t.name.toLowerCase().includes(q));
        return !!(nameMatches || urlMatches || tagsMatch);
      });
      if (categoryMatches || filteredLinks.length > 0) {
        return { ...category, links: categoryMatches ? category.links : filteredLinks };
      }
      return null;
    })
    .filter((c): c is Category => c !== null);
}
