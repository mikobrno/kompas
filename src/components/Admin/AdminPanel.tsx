import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { X, Users, Trash2, Undo2, Save, Link as LinkIcon, Merge, Shield, Download, Upload, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_CATEGORY_COLOR } from '../../lib/colors';
import { generateBookmarksHtml, parseBookmarksHtml, type BookmarkCategory } from '../../lib/bookmarkExport';
import { ShareTagModal } from '../Modals/ShareTagModal';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
}

interface Group {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

interface ArchivedCategory {
  id: string;
  name: string;
  owner_id: string;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanel = ({ isOpen, onClose }: AdminPanelProps) => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'groups' | 'tags' | 'archive' | 'backup'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [archived, setArchived] = useState<ArchivedCategory[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});
  const [addingMemberUserId, setAddingMemberUserId] = useState<string>('');
  const [renameTagIds, setRenameTagIds] = useState<Record<string, string>>({});
  const [mergeSourceId, setMergeSourceId] = useState<string>('');
  const [mergeTargetName, setMergeTargetName] = useState<string>('');
  const [promoteCandidateId, setPromoteCandidateId] = useState('');
  const [exportOwnerId, setExportOwnerId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importOwnerId, setImportOwnerId] = useState('');
  const [importHtml, setImportHtml] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [clearBeforeImport, setClearBeforeImport] = useState(false);
  const [importStats, setImportStats] = useState<{ categories: number; links: number } | null>(null);
  const [shareTag, setShareTag] = useState<{ id: string; name: string } | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ full_name: string; email: string; password: string }>({ full_name: '', email: '', password: '' });
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  // Odstraněny akce pro seed uživatelů
  // Demo akce odstraněny – panel pracuje jen s reálnými daty

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: groupsData } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: tagsData } = await supabase
      .from('tags')
      .select('*')
      .order('name');

    const { data: archivedData } = await supabase
      .from('categories')
      .select('id, name, owner_id')
      .eq('is_archived', true)
      .order('name');

    setUsers(usersData || []);
    setPromoteCandidateId('');
    setGroups(groupsData || []);
    setTags(tagsData || []);
    setArchived(archivedData || []);
  };

  useEffect(() => {
    if (!users.length) return;
    if (!exportOwnerId) {
      const preferred = profile?.id && users.some((u) => u.id === profile.id) ? profile.id : users[0]?.id;
      if (preferred) setExportOwnerId(preferred);
    }
    if (!importOwnerId) {
      const preferred = profile?.id && users.some((u) => u.id === profile.id) ? profile.id : users[0]?.id;
      if (preferred) setImportOwnerId(preferred);
    }
  }, [users, profile?.id, exportOwnerId, importOwnerId]);

  // seedNamedUsers odstraněn

  const adminUsers = useMemo(() => users.filter(user => user.role === 'admin'), [users]);
  const regularUsers = useMemo(() => users.filter(user => user.role === 'user'), [users]);

  const startUserEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({ full_name: user.full_name ?? '', email: user.email ?? '', password: '' });
    setEditError(null);
  };

  const cancelUserEdit = () => {
    setEditingUserId(null);
    setEditForm({ full_name: '', email: '', password: '' });
    setSavingUserId(null);
    setEditError(null);
  };

  const handleSaveUser = async () => {
    if (!editingUserId) return;
    const trimmedName = editForm.full_name.trim();
    const trimmedEmail = editForm.email.trim().toLowerCase();
    const trimmedPassword = editForm.password.trim();

    if (!trimmedName) {
      setEditError('Zadejte prosím jméno.');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setEditError('Zadejte prosím platný e-mail.');
      return;
    }

    if (trimmedPassword && trimmedPassword.length < 8) {
      setEditError('Heslo musí mít alespoň 8 znaků.');
      return;
    }

    setSavingUserId(editingUserId);
    setEditError(null);

    const { error } = await supabase.rpc('admin_update_user', {
      p_user_id: editingUserId,
      p_email: trimmedEmail,
      p_full_name: trimmedName,
      p_password: trimmedPassword ? trimmedPassword : null,
    });

    if (error) {
      // Chybu zobrazíme uživateli, aby hned věděl, co se stalo.
      setEditError(error.message || 'Uložení se nezdařilo. Zkuste to prosím znovu.');
      setSavingUserId(null);
      return;
    }

    await loadData();
    cancelUserEdit();
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('groups')
      .insert({ name: newGroupName });

    if (!error) {
      setNewGroupName('');
      setShowAddGroup(false);
      loadData();
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Opravdu chcete smazat tuto skupinu?')) return;

    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (!error) {
      loadData();
    }
  };

  const loadGroupMembers = async (groupId: string) => {
    const { data } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);
  setGroupMembers((prev: Record<string, string[]>) => ({ ...prev, [groupId]: (data || []).map((m: { user_id: string }) => m.user_id) }));
  };

  const handleAddMember = async (groupId: string) => {
    if (!addingMemberUserId) return;
    await supabase.from('group_members').insert({ group_id: groupId, user_id: addingMemberUserId });
    setAddingMemberUserId('');
    await loadGroupMembers(groupId);
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    await loadGroupMembers(groupId);
  };

  const handleRestoreCategory = async (categoryId: string) => {
    await supabase.from('categories').update({ is_archived: false }).eq('id', categoryId);
    await loadData();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Trvale smazat kategorii? Tuto akci nelze vrátit.')) return;
    await supabase.from('categories').delete().eq('id', categoryId);
    await loadData();
  };

  const handleRenameTag = async (tagId: string) => {
    const newName = renameTagIds[tagId];
    if (!newName || !newName.trim()) return;
    await supabase.from('tags').update({ name: newName.trim() }).eq('id', tagId);
    setRenameTagIds((prev) => ({ ...prev, [tagId]: '' }));
    await loadData();
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Smazat štítek? Odkazy tento štítek ztratí.')) return;
    await supabase.from('tags').delete().eq('id', tagId);
    await loadData();
  };

  const handleMergeTags = async () => {
    if (!mergeSourceId || !mergeTargetName.trim()) return;
    // Ensure target exists (by name)
    const targetName = mergeTargetName.trim();
    const { data: existing } = await supabase.from('tags').select('id').eq('name', targetName).maybeSingle();
    let targetId = existing?.id as string | undefined;
    if (!targetId) {
      const { data: created } = await supabase.from('tags').insert({ name: targetName }).select('id').single();
      targetId = created?.id;
    }
    if (!targetId) return;
    // Repoint link_tags
    await supabase.from('link_tags').update({ tag_id: targetId }).eq('tag_id', mergeSourceId);
    // Delete old tag
    await supabase.from('tags').delete().eq('id', mergeSourceId);
    setMergeSourceId('');
    setMergeTargetName('');
    await loadData();
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (currentRole === 'admin') {
      const adminCount = users.filter(user => user.role === 'admin').length;
      if (adminCount <= 1) {
        alert('Nelze odebrat roli poslednímu administrátorovi.');
        return;
      }
    }

    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    const { error } = await supabase.rpc('set_user_role', { target_user: userId, new_role: newRole });

    if (!error) {
      loadData();
    }
  };

  const handlePromoteToAdmin = async () => {
    if (!promoteCandidateId) return;
    await handleToggleRole(promoteCandidateId, 'user');
    setPromoteCandidateId('');
  };

  const handleExportBookmarks = async () => {
    if (!exportOwnerId) return;
    setExporting(true);
    setExportStatus(null);
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, display_order')
        .eq('owner_id', exportOwnerId)
        .eq('is_archived', false)
        .order('display_order', { ascending: true });

      if (categoriesError) throw categoriesError;

      const categoriesList = categoriesData ?? [];
      if (!categoriesList.length) {
        setExportStatus('Vybraný uživatel nemá žádné kategorie k exportu.');
        return;
      }

      const categoryIds = categoriesList.map((category) => category.id);
      const { data: linksData, error: linksError } = await supabase
        .from('links')
        .select('category_id, display_name, url, display_order, is_archived, link_tags ( tags ( name ) )')
        .in('category_id', categoryIds)
        .eq('is_archived', false)
        .order('display_order', { ascending: true });

      if (linksError) throw linksError;

      const linksByCategory = new Map<string, { display_name: string; url: string; display_order: number; tags?: string[] }[]>();
      (linksData ?? []).forEach((link) => {
        const entries = linksByCategory.get(link.category_id) || [];
        entries.push({
          display_name: link.display_name,
          url: link.url,
          display_order: link.display_order,
          tags: (link as unknown as { link_tags?: { tags: { name: string } }[] }).link_tags?.map((lt) => lt.tags.name) || [],
        });
        linksByCategory.set(link.category_id, entries);
      });

      const bookmarkCategories: BookmarkCategory[] = categoriesList
        .map((category) => {
          const links = (linksByCategory.get(category.id) || [])
            .sort((a, b) => a.display_order - b.display_order)
            .map((link) => ({
              title: link.display_name,
              url: link.url,
              tags: link.tags && link.tags.length ? link.tags : undefined,
            }));
          return {
            name: category.name,
            links,
          };
        })
        .filter((category) => category.links.length > 0);

      if (!bookmarkCategories.length) {
        setExportStatus('Nenalezeny žádné aktivní odkazy k exportu.');
        return;
      }

      const html = generateBookmarksHtml(bookmarkCategories);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      const owner = users.find((user) => user.id === exportOwnerId);
      const fallbackName = owner?.full_name || owner?.email || 'export';
      downloadLink.href = url;
      downloadLink.download = `stopar-bookmarks-${sanitizeFileName(fallbackName)}.html`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      setExportStatus('Soubor s exportem byl připraven. Stahování právě proběhlo.');
    } catch (err) {
      console.error('Export záložek selhal:', err);
      setExportStatus('Export se nezdařil. Zkuste to prosím znovu.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setImportHtml(text);
      setImportStatus(`Načten soubor ${file.name}.`);
      setImportStats(null);
    } catch (err) {
      console.error('Čtení souboru selhalo:', err);
      setImportStatus('Soubor se nepodařilo načíst.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportBookmarks = async () => {
    if (!importOwnerId) return;
    if (!importHtml.trim()) {
      setImportStatus('Nejprve vložte obsah exportu nebo vyberte soubor.');
      return;
    }

    setImporting(true);
    setImportStatus(null);
    setImportStats(null);

    try {
      const parsed = parseBookmarksHtml(importHtml);
      const prepared = parsed
        .map((category) => ({
          name: category.name.trim() || 'Nová kategorie',
          links: category.links
            .map((link) => ({
              title: (link.title || link.url || '').trim() || link.url || 'Bez názvu',
              url: link.url.trim(),
            }))
            .filter((link) => !!link.url),
        }))
        .filter((category) => category.links.length > 0);

      if (!prepared.length) {
        setImportStatus('V souboru nebyly nalezeny žádné odkazy.');
        return;
      }

      if (clearBeforeImport) {
        const confirmed = confirm('Opravdu chcete smazat všechny existující kategorie tohoto uživatele?');
        if (!confirmed) {
          setImportStatus('Import byl zrušen.');
          return;
        }
        const { error: deleteError } = await supabase
          .from('categories')
          .delete()
          .eq('owner_id', importOwnerId);
        if (deleteError) throw deleteError;
      }

      const totalLinks = prepared.reduce((sum, category) => sum + category.links.length, 0);

      for (let idx = 0; idx < prepared.length; idx += 1) {
        const category = prepared[idx];
        const { data: insertedCategory, error: categoryError } = await supabase
          .from('categories')
          .insert({
            name: category.name,
            owner_id: importOwnerId,
            is_archived: false,
            display_order: idx,
            color_hex: DEFAULT_CATEGORY_COLOR,
          })
          .select('id')
          .single();

        if (categoryError || !insertedCategory) throw categoryError;

        // Vkládejme odkazy postupně, abychom mohli přiřadit štítky
        for (let linkIdx = 0; linkIdx < category.links.length; linkIdx += 1) {
          const link = category.links[linkIdx];
          const { data: newLink, error: linkError } = await supabase
            .from('links')
            .insert({
              category_id: insertedCategory.id,
              display_name: link.title,
              url: link.url,
              display_order: linkIdx,
              is_archived: false,
              favicon_url: null,
            })
            .select('id')
            .single();
          if (linkError || !newLink) throw linkError;

          // Zpracuj štítky, pokud existují
          const tagNames = (link as unknown as { tags?: string[] }).tags || [];
          if (tagNames.length) {
            // Najdi existující tagy
            const { data: existingTags, error: existingErr } = await supabase
              .from('tags')
              .select('id, name')
              .in('name', tagNames);
            if (existingErr) throw existingErr;
            const existingMap = new Map<string, string>();
            (existingTags as { id: string; name: string }[] | null | undefined)?.forEach((t) => existingMap.set(t.name, t.id));

            // Vytvoř chybějící
            const missing = tagNames.filter((n) => !existingMap.has(n));
            if (missing.length) {
              const { data: created, error: createErr } = await supabase
                .from('tags')
                .insert(missing.map((name) => ({ name })))
                .select('id, name');
              if (createErr) throw createErr;
              (created as { id: string; name: string }[] | null | undefined)?.forEach((t) => existingMap.set(t.name, t.id));
            }

            // Propoj link s tagy
            const relations = tagNames
              .map((n) => existingMap.get(n))
              .filter((id): id is string => !!id)
              .map((tagId) => ({ link_id: newLink.id, tag_id: tagId }));
            if (relations.length) {
              const { error: ltErr } = await supabase.from('link_tags').insert(relations);
              if (ltErr) throw ltErr;
            }
          }
        }
      }

      await loadData();
      setImportStats({ categories: prepared.length, links: totalLinks });
      setImportStatus('Import byl úspěšně dokončen.');
      setImportHtml('');
      setClearBeforeImport(false);
    } catch (err) {
      console.error('Import záložek selhal:', err);
      setImportStatus('Import se nepodařilo dokončit. Zkontrolujte soubor a zkuste to znovu.');
    } finally {
      setImporting(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 dark:bg-slate-900/95 border border-[#f05a28]/30 rounded-2xl shadow-2xl shadow-[#f05a28]/10 max-w-4xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-white/40 dark:bg-slate-900/40 rounded-t-2xl">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Administrace
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-transparent hover:border-[#f05a28]/30 hover:bg-white/40 dark:hover:bg-slate-800/60 transition"
            title="Zavřít administraci"
            aria-label="Zavřít administraci"
          >
            <X className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
          </button>
        </div>

        <div className="flex border-b border-[#f05a28]/20 dark:border-[#f05a28]/25 bg-white/30 dark:bg-slate-900/30">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'users'
                ? 'text-[#f05a28] dark:text-[#ff8b5c] border-b-2 border-[#f05a28] dark:border-[#ff8b5c] bg-white/50 dark:bg-slate-900/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#f05a28] dark:hover:text-[#ff8b5c]'
            }`}
          >
            Uživatelé
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'roles'
                ? 'text-[#f05a28] dark:text-[#ff8b5c] border-b-2 border-[#f05a28] dark:border-[#ff8b5c] bg-white/50 dark:bg-slate-900/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#f05a28] dark:hover:text-[#ff8b5c]'
            }`}
          >
            Role
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'groups'
                ? 'text-[#f05a28] dark:text-[#ff8b5c] border-b-2 border-[#f05a28] dark:border-[#ff8b5c] bg-white/50 dark:bg-slate-900/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#f05a28] dark:hover:text-[#ff8b5c]'
            }`}
          >
            Skupiny
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'tags'
                ? 'text-[#f05a28] dark:text-[#ff8b5c] border-b-2 border-[#f05a28] dark:border-[#ff8b5c] bg-white/50 dark:bg-slate-900/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#f05a28] dark:hover:text-[#ff8b5c]'
            }`}
          >
            Štítky
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'archive'
                ? 'text-[#f05a28] dark:text-[#ff8b5c] border-b-2 border-[#f05a28] dark:border-[#ff8b5c] bg-white/50 dark:bg-slate-900/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#f05a28] dark:hover:text-[#ff8b5c]'
            }`}
          >
            Archiv
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              activeTab === 'backup'
                ? 'text-[#f05a28] dark:text-[#ff8b5c] border-b-2 border-[#f05a28] dark:border-[#ff8b5c] bg-white/50 dark:bg-slate-900/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#f05a28] dark:hover:text-[#ff8b5c]'
            }`}
          >
            Export / Import
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Hint odstraněn – žádné seedování uživatelů z UI */}
              {/* Demo sdílení odstraněno */}
              {editError && (
                <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm text-red-600 dark:border-red-500/60 dark:bg-red-900/20 dark:text-red-300">
                  {editError}
                </div>
              )}

              {users.map(user => {
                const isEditing = editingUserId === user.id;
                return (
                  <div
                    key={user.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-xl border border-[#f05a28]/15 bg-white/70 dark:bg-slate-900/50 shadow-sm"
                  >
                    <div className="flex-1 space-y-2">
                      {isEditing ? (
                        <>
                          <input
                            value={editForm.full_name}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, full_name: event.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                            placeholder="Celé jméno"
                            aria-label="Celé jméno uživatele"
                          />
                          <input
                            value={editForm.email}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                            placeholder="E-mail"
                            aria-label="E-mail uživatele"
                          />
                          <input
                            value={editForm.password}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                            placeholder="Nové heslo (nepovinné)"
                            aria-label="Nové heslo"
                            type="password"
                            autoComplete="new-password"
                          />
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {user.full_name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {user.email}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                      {isEditing ? (
                        <>
                          <button
                            onClick={handleSaveUser}
                            disabled={savingUserId === user.id}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                              savingUserId === user.id
                                ? 'bg-white/60 border border-[#f05a28]/20 text-slate-400 cursor-not-allowed'
                                : 'bg-[#f05a28] hover:bg-[#ff7846] text-white shadow'
                            }`}
                          >
                            Uložit
                          </button>
                          <button
                            onClick={cancelUserEdit}
                            className="px-3 py-1.5 rounded text-sm font-medium border border-[#f05a28]/25 text-[#f05a28] dark:text-[#ff8b5c] hover:bg-[#f05a28]/10 dark:hover:bg-[#f05a28]/20 transition"
                          >
                            Zrušit
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              localStorage.setItem('impersonateUserId', user.id);
                              window.location.reload();
                            }}
                            className="px-3 py-1 rounded text-sm font-medium border border-[#f05a28]/25 text-[#f05a28] dark:text-[#ff8b5c] hover:bg-[#f05a28]/10 dark:hover:bg-[#f05a28]/20 transition"
                            title="Náhled jako tento uživatel"
                          >
                            Náhled
                          </button>
                          <button
                            onClick={() => startUserEdit(user)}
                            className="px-3 py-1 rounded text-sm font-medium border border-[#f05a28]/25 text-slate-700 dark:text-slate-200 hover:bg-[#f05a28]/10 dark:hover:bg-[#f05a28]/20 transition"
                          >
                            Upravit
                          </button>
                          <button
                            onClick={() => handleToggleRole(user.id, user.role)}
                            className={`px-3 py-1 rounded text-sm font-medium transition ${
                              user.role === 'admin'
                                ? 'border border-[#f05a28]/30 bg-[#f05a28]/15 dark:bg-[#f05a28]/20 text-[#f05a28] dark:text-[#ff8b5c]'
                                : 'border border-[#f05a28]/20 text-slate-700 dark:text-slate-200 hover:bg-[#f05a28]/10 dark:hover:bg-[#f05a28]/20'
                            }`}
                          >
                            {user.role === 'admin' ? 'Admin' : 'Uživatel'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              <div className="p-4 bg-[#f05a28]/10 dark:bg-[#f05a28]/20 rounded-xl border border-[#f05a28]/20 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-[#f05a28] dark:text-[#ff8b5c]" />
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">Správa rolí</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Přidávejte a odebírejte administrátory. Běžní uživatelé nemají přístup k nastavení ani správě ostatních.
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-slate-700 dark:text-slate-200">
                  <p><strong>{adminUsers.length}</strong> administrátor{adminUsers.length === 1 ? '' : adminUsers.length >= 2 && adminUsers.length <= 4 ? 'i' : 'ů'}</p>
                  <p><strong>{regularUsers.length}</strong> běžných uživatelů</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <section className="p-4 rounded-xl bg-white/85 dark:bg-slate-900/60 border border-[#f05a28]/20">
                  <h5 className="text-lg font-medium text-slate-900 dark:text-white">Administrátoři</h5>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Mají plný přístup do administrace, k uživatelům, skupinám i archivovaným kategoriím.
                  </p>

                  <div className="mt-4 space-y-2">
                    {adminUsers.length === 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Zatím nejsou nastaveni žádní administrátoři.</p>
                    )}

                    {adminUsers.map(admin => (
                      <div
                        key={admin.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-[#f05a28]/15 bg-white/70 dark:bg-slate-900/50"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{admin.full_name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{admin.email}</p>
                        </div>
                        <button
                          onClick={() => handleToggleRole(admin.id, 'admin')}
                          disabled={adminUsers.length <= 1}
                          className={`px-3 py-1 rounded text-sm font-medium border transition ${
                            adminUsers.length <= 1
                              ? 'border-[#f05a28]/15 text-slate-400 cursor-not-allowed'
                              : 'border-red-300 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10'
                          }`}
                          title={adminUsers.length <= 1 ? 'Musí zůstat alespoň jeden administrátor' : 'Odebrat uživatele z role administrátor'}
                        >
                          Odebrat roli
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 p-4 bg-[#f05a28]/10 dark:bg-[#f05a28]/15 rounded-xl border border-[#f05a28]/15">
                    <h6 className="font-medium text-slate-900 dark:text-white">Přidat administrátora</h6>
                    {regularUsers.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Všichni uživatelé již mají roli administrátor.</p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                          Vyberte existujícího uživatele, který získá přístup do administrace.
                        </p>
                        <div className="mt-3 flex flex-col sm:flex-row gap-3">
                          <select
                            value={promoteCandidateId}
                            onChange={(e) => setPromoteCandidateId(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/50"
                            aria-label="Vyberte uživatele, kterému chcete udělit roli administrátora"
                          >
                            <option value="">Vyberte uživatele</option>
                            {regularUsers.map(user => (
                              <option key={user.id} value={user.id}>
                                {user.full_name} ({user.email})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handlePromoteToAdmin}
                            disabled={!promoteCandidateId}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                              promoteCandidateId
                                ? 'bg-[#f05a28] hover:bg-[#ff7846] text-white shadow'
                                : 'bg-white/60 text-slate-400 cursor-not-allowed border border-[#f05a28]/20'
                            }`}
                          >
                            Přidat
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <section className="p-4 rounded-xl bg-white/85 dark:bg-slate-900/60 border border-[#f05a28]/20">
                  <h5 className="text-lg font-medium text-slate-900 dark:text-white">Běžní uživatelé</h5>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Vidí pouze své vlastní nebo s nimi sdílené kategorie a nemohou vstoupit do administrace.
                  </p>

                  <div className="mt-4 space-y-2">
                    {regularUsers.length === 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Žádní běžní uživatelé.</p>
                    )}
                    {regularUsers.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-[#f05a28]/15 bg-white/70 dark:bg-slate-900/50"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{user.full_name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                        <button
                          onClick={() => handleToggleRole(user.id, 'user')}
                          className="px-3 py-1 rounded text-sm font-medium border border-[#f05a28]/30 text-[#f05a28] dark:text-[#ff8b5c] hover:bg-[#f05a28]/10 dark:hover:bg-[#f05a28]/20 transition"
                        >
                          Udělit roli Admin
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="space-y-4">
              <button
                onClick={() => setShowAddGroup(true)}
                className="w-full flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-[#f05a28]/30 rounded-xl hover:border-[#f05a28]/70 text-slate-600 dark:text-slate-400 hover:text-[#f05a28] dark:hover:text-[#ff8b5c] transition"
              >
                <Users className="w-5 h-5" />
                <span>Vytvořit novou skupinu</span>
              </button>

              {showAddGroup && (
                <form onSubmit={handleCreateGroup} className="p-4 bg-[#f05a28]/10 dark:bg-[#f05a28]/20 rounded-xl border border-[#f05a28]/20">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Název skupiny"
                    required
                    autoFocus
                    className="w-full px-4 py-2 rounded-xl border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white mb-3 focus:outline-none focus:ring-2 focus:ring-[#f05a28]/50"
                  />
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddGroup(false);
                        setNewGroupName('');
                      }}
                      className="flex-1 px-4 py-2 border border-[#f05a28]/25 rounded-xl bg-white/70 text-[#f05a28] dark:text-[#ff8b5c] hover:bg-[#f05a28]/10 transition"
                    >
                      Zrušit
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 rounded-xl bg-[#f05a28] hover:bg-[#ff7846] text-white shadow transition"
                    >
                      Vytvořit
                    </button>
                  </div>
                </form>
              )}

              {groups.map(group => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-[#f05a28]/15 bg-white/70 dark:bg-slate-900/50"
                >
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
                    <p className="font-medium text-slate-900 dark:text-white">
                      {group.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const newExpanded = expandedGroupId === group.id ? null : group.id;
                        setExpandedGroupId(newExpanded);
                        if (newExpanded) await loadGroupMembers(group.id);
                      }}
                      className="px-3 py-1 rounded-xl border border-[#f05a28]/25 bg-white/60 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 text-sm hover:bg-[#f05a28]/10 dark:hover:bg-[#f05a28]/20 transition"
                    >
                      Členové
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition text-red-600 dark:text-red-400"
                      title="Smazat skupinu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {expandedGroupId && (
                <div className="p-4 rounded-xl bg-white/85 dark:bg-slate-900/60 border border-[#f05a28]/20">
                  <h4 className="font-medium text-slate-900 dark:text-white mb-3">Správa členů</h4>
                  <div className="space-y-2 mb-4">
                    {(groupMembers[expandedGroupId] || []).map((uid) => {
                      const u = users.find(us => us.id === uid);
                      if (!u) return null;
                      return (
                        <div key={uid} className="flex items-center justify-between p-2 rounded-xl border border-[#f05a28]/15 bg-white/70 dark:bg-slate-900/50">
                          <span className="text-sm text-slate-800 dark:text-slate-200">{u.full_name} ({u.email})</span>
                          <button
                            onClick={() => handleRemoveMember(expandedGroupId, uid)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                            title="Odebrat člena"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={addingMemberUserId}
                      onChange={(e) => setAddingMemberUserId(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/50"
                      aria-label="Vyberte uživatele pro přidání do skupiny"
                    >
                      <option value="">Vyberte uživatele</option>
                      {users
                        .filter(u => !(groupMembers[expandedGroupId] || []).includes(u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                        ))}
                    </select>
                    <button
                      onClick={() => handleAddMember(expandedGroupId)}
                      className="px-3 py-2 rounded-xl bg-[#f05a28] hover:bg-[#ff7846] text-white text-sm shadow transition"
                    >
                      Přidat
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl border border-[#f05a28]/20 bg-white/80 dark:bg-slate-900/60">
                <h4 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Merge className="w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" /> Sloučit štítky
                </h4>
                <div className="flex items-center gap-2">
                  <select
                    value={mergeSourceId}
                    onChange={(e) => setMergeSourceId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/50"
                    aria-label="Zdrojový štítek pro sloučení"
                  >
                    <option value="">Zdrojový štítek</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={mergeTargetName}
                    onChange={(e) => setMergeTargetName(e.target.value)}
                    placeholder="Cílový štítek (existující nebo nový)"
                    className="flex-1 px-3 py-2 rounded-xl border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/50"
                  />
                  <button
                    onClick={handleMergeTags}
                    className="px-3 py-2 rounded-xl bg-[#f05a28] hover:bg-[#ff7846] text-white text-sm shadow transition"
                  >
                    Sloučit
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between p-3 rounded-xl border border-[#f05a28]/15 bg-white/75 dark:bg-slate-900/55">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" />
                      <input
                        type="text"
                        defaultValue={tag.name}
                        onChange={(e) => setRenameTagIds(prev => ({ ...prev, [tag.id]: e.target.value }))}
                        className="px-3 py-1 rounded-lg border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                        aria-label={`Přejmenovat štítek ${tag.name}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShareTag({ id: tag.id, name: tag.name })}
                        className="p-2 rounded-lg hover:bg-[#f05a28]/10 dark:hover:bg-[#f05a28]/20 transition"
                        title="Sdílet štítek"
                      >
                        <Share2 className="w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" />
                      </button>
                      <button
                        onClick={() => handleRenameTag(tag.id)}
                        className="p-2 rounded-lg hover:bg-[#f05a28]/10 dark:hover:bg-[#f05a28]/20 transition"
                        title="Přejmenovat"
                      >
                        <Save className="w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition"
                        title="Smazat štítek"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'archive' && (
            <div className="space-y-2">
              {archived.length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-400">Archiv je prázdný.</p>
              )}
              {archived.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border border-[#f05a28]/15 bg-white/70 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{cat.name}</span>
                    <span className="text-xs text-slate-500">({cat.id.slice(0, 8)})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreCategory(cat.id)}
                      className="p-2 rounded-lg hover:bg-[#f05a28]/10 dark:hover:bg-[#f05a28]/20 text-[#f05a28] dark:text-[#ff8b5c] transition"
                      title="Obnovit"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition"
                      title="Trvale smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-8">
              <section className="p-5 rounded-2xl border border-[#f05a28]/20 bg-white/85 dark:bg-slate-900/65 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-[#f05a28]/15 dark:bg-[#f05a28]/25 text-[#f05a28] dark:text-[#ff8b5c]">
                    <Download className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Export záložek</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Vygeneruje soubor ve formátu Netscape Bookmark, který lze importovat do prohlížečů i zpět do Stopáře.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_auto] items-end">
                  <label className="flex flex-col gap-2" aria-label="Uživatel pro export">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Uživatel</span>
                    <select
                      value={exportOwnerId}
                      onChange={(event) => setExportOwnerId(event.target.value)}
                      className="px-3 py-2 rounded-xl border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    onClick={handleExportBookmarks}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
                      exporting
                        ? 'bg-white/60 text-slate-400 border border-[#f05a28]/20 cursor-not-allowed'
                        : 'bg-[#f05a28] hover:bg-[#ff7846] text-white shadow'
                    }`}
                    disabled={exporting || !exportOwnerId}
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    {exporting ? 'Připravuji…' : 'Stáhnout export'}
                  </button>
                </div>

                {exportStatus && (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{exportStatus}</p>
                )}
              </section>

              <section className="p-5 rounded-2xl border border-[#f05a28]/20 bg-white/85 dark:bg-slate-900/65 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-[#f05a28]/15 dark:bg-[#f05a28]/25 text-[#f05a28] dark:text-[#ff8b5c]">
                    <Upload className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Import záložek</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Načte soubor ve formátu Netscape Bookmark a vytvoří z něj kategorie a odkazy pro vybraného uživatele.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_auto] items-start">
                  <label className="flex flex-col gap-2" aria-label="Uživatel pro import">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Uživatel</span>
                    <select
                      value={importOwnerId}
                      onChange={(event) => setImportOwnerId(event.target.value)}
                      className="px-3 py-2 rounded-xl border border-[#f05a28]/30 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Obsah exportu</span>
                      <textarea
                        value={importHtml}
                        onChange={(event) => setImportHtml(event.target.value)}
                        placeholder="Sem můžete vložit obsah bookmark HTML souboru…"
                        className="w-full min-h-[140px] px-3 py-2 rounded-xl border border-[#f05a28]/25 bg-white/90 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f05a28]/40"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-dashed border-[#f05a28]/30 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/40 cursor-pointer hover:border-[#f05a28]/60 transition">
                      <span>nebo vyberte soubor (.html)</span>
                      <input
                        type="file"
                        accept=".html,.htm,text/html"
                        className="hidden"
                        onChange={handleImportFileSelection}
                        aria-label="Vybrat soubor s exportem"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={clearBeforeImport}
                        onChange={(event) => setClearBeforeImport(event.target.checked)}
                        className="w-4 h-4 rounded border border-[#f05a28]/40 text-[#f05a28] focus:ring-[#f05a28]/50"
                        aria-label="Smazat před importem všechny existující kategorie"
                      />
                      Smazat před importem všechny existující kategorie tohoto uživatele
                    </label>
                    <button
                      onClick={handleImportBookmarks}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
                        importing
                          ? 'bg-white/60 text-slate-400 border border-[#f05a28]/20 cursor-not-allowed'
                          : 'bg-[#f05a28] hover:bg-[#ff7846] text-white shadow'
                      }`}
                      disabled={importing || !importOwnerId}
                    >
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      {importing ? 'Importuji…' : 'Importovat'}
                    </button>
                  </div>
                </div>

                {importStatus && (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                    {importStatus}
                    {importStats && (
                      <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Vytvořeno {importStats.categories} kategorií a {importStats.links} odkazů.
                      </span>
                    )}
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
      {shareTag && (
        <ShareTagModal
          isOpen={true}
          tagId={shareTag.id}
          tagName={shareTag.name}
          onClose={() => setShareTag(null)}
          onSaved={() => loadData()}
        />
      )}
    </div>
  );
};

const sanitizeFileName = (input: string): string => {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'export';
};

