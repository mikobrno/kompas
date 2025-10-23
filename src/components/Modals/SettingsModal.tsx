import { ChangeEvent, useEffect, useState } from 'react';
import { X, Moon, Sun, User, Download, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { DEFAULT_CATEGORY_COLOR } from '../../lib/colors';
import { generateBookmarksHtml, parseBookmarksHtml, type BookmarkCategory } from '../../lib/bookmarkExport';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { profile, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  // Export/Import state
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importHtml, setImportHtml] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [clearBeforeImport, setClearBeforeImport] = useState(false);
  const [importStats, setImportStats] = useState<{ categories: number; links: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFullName(profile?.full_name ?? '');
    setTheme(profile?.theme ?? 'light');
    setMessage(null);
  }, [isOpen, profile?.full_name, profile?.theme]);

  if (!isOpen) return null;

  const applyTheme = (selected: 'light' | 'dark') => {
    if (selected === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({ full_name: fullName.trim() || profile?.full_name || '', theme });
      applyTheme(theme);
      setMessage('Nastavení bylo uloženo.');
      setTimeout(() => onClose(), 800);
    } catch (err) {
      console.error('Uložení nastavení selhalo:', err);
      setMessage('Nepodařilo se uložit nastavení. Zkuste to znovu.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportBookmarks = async () => {
    if (!profile?.id) return;
    setExporting(true);
    setExportStatus(null);
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, display_order')
        .eq('owner_id', profile.id)
        .eq('is_archived', false)
        .order('display_order', { ascending: true });

      if (categoriesError) throw categoriesError;

      const categoriesList = categoriesData ?? [];
      if (!categoriesList.length) {
        setExportStatus('Nemáte žádné kategorie k exportu.');
        return;
      }

      const categoryIds = categoriesList.map((category) => category.id);
      const { data: linksData, error: linksError } = await supabase
        .from('links')
        .select('category_id, display_name, url, display_order, is_archived')
        .in('category_id', categoryIds)
        .eq('is_archived', false)
        .order('display_order', { ascending: true });

      if (linksError) throw linksError;

      const linksByCategory = new Map<string, { display_name: string; url: string; display_order: number }[]>();
      (linksData ?? []).forEach((link) => {
        const entries = linksByCategory.get(link.category_id) || [];
        entries.push({
          display_name: link.display_name,
          url: link.url,
          display_order: link.display_order,
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
      const fallbackName = profile?.full_name || profile?.email || 'export';
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
    if (!profile?.id) return;
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
        const confirmed = confirm('Opravdu chcete smazat všechny existující kategorie?');
        if (!confirmed) {
          setImportStatus('Import byl zrušen.');
          return;
        }
        const { error: deleteError } = await supabase
          .from('categories')
          .delete()
          .eq('owner_id', profile.id);
        if (deleteError) throw deleteError;
      }

      const totalLinks = prepared.reduce((sum, category) => sum + category.links.length, 0);

      for (let idx = 0; idx < prepared.length; idx += 1) {
        const category = prepared[idx];
        const { data: insertedCategory, error: categoryError } = await supabase
          .from('categories')
          .insert({
            name: category.name,
            owner_id: profile.id,
            is_archived: false,
            display_order: idx,
            color_hex: DEFAULT_CATEGORY_COLOR,
          })
          .select('id')
          .single();

        if (categoryError || !insertedCategory) throw categoryError;

        const linkPayload = category.links.map((link, linkIdx) => ({
          category_id: insertedCategory.id,
          display_name: link.title,
          url: link.url,
          display_order: linkIdx,
          is_archived: false,
          favicon_url: null,
        }));

        if (linkPayload.length) {
          const { error: linksError } = await supabase.from('links').insert(linkPayload);
          if (linksError) throw linksError;
        }
      }

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

const sanitizeFileName = (input: string): string => {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'export';
};

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-[#f05a28]/30 bg-white/95 dark:bg-slate-900/95 shadow-2xl shadow-[#f05a28]/10 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#f05a28]/20 dark:border-[#f05a28]/15 bg-white/30 dark:bg-slate-900/40 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#f05a28]/15 dark:bg-[#f05a28]/25">
              <SettingsIcon />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Nastavení</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Upravte profil, vzhled a spravujte své záložky.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-transparent hover:border-[#f05a28]/30 hover:bg-white/40 dark:hover:bg-slate-800/60 transition"
            title="Zavřít"
            aria-label="Zavřít dialog"
          >
            <X className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Profil</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="settings-fullname">
                  Jméno a příjmení
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" />
                  <input
                    id="settings-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#f05a28]/30 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#f05a28]/60 focus:border-[#f05a28]/40 transition"
                    placeholder="Vaše jméno"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Email účtu</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{profile?.email}</p>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-[#f05a28]/30 bg-white/70 text-[#f05a28] dark:text-[#ff8b5c] hover:bg-[#f05a28]/15 hover:border-[#f05a28]/50 transition text-sm"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#f05a28] hover:bg-[#ff7846] text-white shadow-md transition disabled:opacity-50 text-sm"
                >
                  {saving ? 'Ukládám…' : 'Uložit profil'}
                </button>
              </div>
              {message && (
                <div className="text-sm text-[#f05a28] dark:text-[#ff8b5c] bg-[#f05a28]/10 dark:bg-[#f05a28]/20 px-4 py-2 rounded-lg">
                  {message}
                </div>
              )}
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Vzhled</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center space-x-3 rounded-xl px-4 py-3 transition border ${theme === 'light' ? 'border-[#f05a28] bg-[#f05a28]/15 dark:bg-[#f05a28]/25 text-[#f05a28] dark:text-[#ff8b5c]' : 'border-[#f05a28]/25 dark:border-[#f05a28]/20 hover:border-[#f05a28]/40 hover:bg-[#f05a28]/10'}`}
              >
                <Sun className="w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Světlý režim</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Vhodný pro osvětlení.</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center space-x-3 rounded-xl px-4 py-3 transition border ${theme === 'dark' ? 'border-[#f05a28] bg-[#f05a28]/15 dark:bg-[#f05a28]/25 text-[#f05a28] dark:text-[#ff8b5c]' : 'border-[#f05a28]/25 dark:border-[#f05a28]/20 hover:border-[#f05a28]/40 hover:bg-[#f05a28]/10'}`}
              >
                <Moon className="w-4 h-4 text-[#f05a28] dark:text-[#ff8b5c]" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Tmavý režim</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Šetří baterii.</p>
                </div>
              </button>
            </div>
          </section>

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

            <button
              onClick={handleExportBookmarks}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
                exporting
                  ? 'bg-white/60 text-slate-400 border border-[#f05a28]/20 cursor-not-allowed'
                  : 'bg-[#f05a28] hover:bg-[#ff7846] text-white shadow'
              }`}
              disabled={exporting}
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              {exporting ? 'Připravuji…' : 'Stáhnout export'}
            </button>

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
                  Načte soubor ve formátu Netscape Bookmark a vytvoří z něj kategorie a odkazy.
                </p>
              </div>
            </div>

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
                Smazat před importem všechny existující kategorie
              </label>
              <button
                onClick={handleImportBookmarks}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  importing
                    ? 'bg-white/60 text-slate-400 border border-[#f05a28]/20 cursor-not-allowed'
                    : 'bg-[#f05a28] hover:bg-[#ff7846] text-white shadow'
                }`}
                disabled={importing}
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                {importing ? 'Importuji…' : 'Importovat'}
              </button>
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

        <div className="border-t border-[#f05a28]/20 bg-white/30 dark:bg-slate-900/30 p-4 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#f05a28]/30 bg-white/70 text-[#f05a28] dark:text-[#ff8b5c] hover:bg-[#f05a28]/15 hover:border-[#f05a28]/50 transition"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  className="w-5 h-5 text-[#f05a28] dark:text-[#ff8b5c]"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894a1.125 1.125 0 001.591.832l.764-.36a1.125 1.125 0 011.45.516l.547.95c.275.476.12 1.08-.331 1.4l-.764.55c-.718.516-.718 1.57 0 2.086l.764.55c.45.32.606.923.331 1.4l-.547.95a1.125 1.125 0 01-1.45.516l-.764-.36a1.125 1.125 0 00-1.591.832l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894a1.125 1.125 0 00-1.592-.832l-.763.36a1.125 1.125 0 01-1.45-.516l-.548-.95c-.275-.476-.12-1.08.331-1.4l.764-.55c.718-.516.718-1.57 0-2.086l-.764-.55c-.45-.32-.606-.923-.331-1.4l.548-.95a1.125 1.125 0 011.45-.516l.763.36a1.125 1.125 0 001.592-.832l.148-.894z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
