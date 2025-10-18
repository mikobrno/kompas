import { supabase } from './supabase';

const faviconFor = (rawUrl: string): string | null => {
  try {
    const u = new URL(rawUrl);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return null;
  }
};

export async function seedInitialData(userId: string): Promise<void> {
  // Zjisti, zda uživatel už nemá nějaké kategorie
  const { data: existing, error: existErr } = await supabase
    .from('categories')
    .select('id')
    .eq('owner_id', userId)
    .limit(1);

  if (!existErr && existing && existing.length > 0) return; // už něco má, neseeduj

  // Vytvoř první kategorii
  const { data: newCat, error: catErr } = await supabase
    .from('categories')
    .insert({ name: 'Moje první kategorie', owner_id: userId, display_order: 0 })
    .select('id')
    .single();

  if (catErr || !newCat) return;

  // Dva ukázkové odkazy
  const links = [
    {
      category_id: newCat.id,
      display_name: 'Supabase Docs',
      url: 'https://supabase.com/docs',
      favicon_url: faviconFor('https://supabase.com'),
      display_order: 0,
    },
    {
      category_id: newCat.id,
      display_name: 'GitHub',
      url: 'https://github.com',
      favicon_url: faviconFor('https://github.com'),
      display_order: 1,
    },
  ];

  const { data: insertedLinks, error: linksErr } = await supabase
    .from('links')
    .insert(links)
    .select('id')
    .order('display_order');

  if (linksErr || !insertedLinks || insertedLinks.length === 0) return;

  // Připnout první odkaz
  const firstLinkId = insertedLinks[0].id as string;
  await supabase
    .from('pinned_links')
    .insert({ user_id: userId, link_id: firstLinkId, display_order: 0 });

  // Volitelně přidat tag "důležité" k prvnímu odkazu
  const { data: maybeTag } = await supabase
    .from('tags')
    .select('id')
    .eq('name', 'důležité')
    .maybeSingle();

  let tagId = maybeTag?.id as string | undefined;
  if (!tagId) {
    const { data: createdTag } = await supabase
      .from('tags')
      .insert({ name: 'důležité' })
      .select('id')
      .single();
    tagId = createdTag?.id as string | undefined;
  }

  if (tagId) {
    await supabase
      .from('link_tags')
      .insert({ link_id: firstLinkId, tag_id: tagId });
  }
}
