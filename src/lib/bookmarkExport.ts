export interface BookmarkLink {
  title: string;
  url: string;
  description?: string | null;
  addDate?: number | null;
  lastModified?: number | null;
  tags?: string[];
}

export interface BookmarkCategory {
  name: string;
  links: BookmarkLink[];
}

interface GenerateOptions {
  generatedAt?: Date;
}

const HEADER = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n'
  + '<!-- This is an automatically generated file.\n'
  + '     It will be read and overwritten.\n'
  + '     DO NOT EDIT! -->\n';

const META = '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">';
const ROOT_TITLE = '<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>';

const escapeHtml = (input: string): string => input
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const escapeAttribute = (input: string): string => escapeHtml(input).replace(/\n/g, ' ');

export const generateBookmarksHtml = (
  categories: BookmarkCategory[],
  options: GenerateOptions = {},
): string => {
  const generatedAt = Math.floor((options.generatedAt ?? new Date()).getTime() / 1000);
  const lines: string[] = [HEADER, META, ROOT_TITLE, '<DL><p>'];

  categories.forEach((category) => {
    const safeName = escapeHtml(category.name || 'Bez názvu');
    const timestamp = generatedAt.toString();
    lines.push(`<DT><H3 FOLDED="true" ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${safeName}</H3>`);
    lines.push('<DL><p>');

    category.links
      .filter((link) => link.url)
      .forEach((link) => {
        const linkTimestamp = Math.floor((link.addDate ? Number(link.addDate) : generatedAt)).toString();
        const href = escapeAttribute(link.url);
        const title = escapeHtml(link.title || link.url || 'Bez názvu');
        const tagsCsv = (link.tags && link.tags.length) ? link.tags.join(', ') : '';
        const tagsAttr = tagsCsv ? ` TAGS="${escapeAttribute(tagsCsv)}" DATA-TAGS="${escapeAttribute(tagsCsv)}"` : '';
        lines.push(`<DT><A HREF="${href}" ADD_DATE="${linkTimestamp}" LAST_MODIFIED="${link.lastModified ? Math.floor(Number(link.lastModified)).toString() : linkTimestamp}"${tagsAttr}>${title}</A>`);
        if (link.description) {
          lines.push(`<DD>${escapeHtml(link.description)}</DD>`);
        }
        // Tags se ukládají do atributu TAGS/DATA-TAGS; popis ponecháváme beze změny
      });

    lines.push('</DL><p>');
  });

  lines.push('</DL><p>');
  return `${lines.join('\n')}`;
};

export interface ParsedBookmarkCategory {
  name: string;
  links: BookmarkLink[];
}

const isElement = (node: Element | null | undefined): node is Element => !!node;

const parseCategoryContent = (dl: Element | null): { links: BookmarkLink[]; nested: ParsedBookmarkCategory[] } => {
  const links: BookmarkLink[] = [];
  const nested: ParsedBookmarkCategory[] = [];
  if (!dl) return { links, nested };

  const children = Array.from(dl.children);
  for (let idx = 0; idx < children.length; idx += 1) {
    const child = children[idx];
    if (child.tagName.toLowerCase() !== 'dt') continue;

    const firstChild = child.firstElementChild;
    if (!firstChild) continue;
    const firstTag = firstChild.tagName.toLowerCase();
    if (firstTag === 'h3') {
      const nestedDl = Array.from(child.children).find((el) => el.tagName.toLowerCase() === 'dl') ?? null;
      const result = parseCategoryContent(nestedDl);
      nested.push({
        name: firstChild.textContent?.trim() || 'Bez názvu',
        links: result.links,
      });
      nested.push(...result.nested);
      continue;
    }

    if (firstTag === 'a') {
      const anchor = firstChild as HTMLAnchorElement;
      const href = anchor.getAttribute('href') ?? '';
      const addDateAttr = anchor.getAttribute('ADD_DATE') ?? anchor.getAttribute('add_date');
      const lastModifiedAttr = anchor.getAttribute('LAST_MODIFIED') ?? anchor.getAttribute('last_modified');
      const link: BookmarkLink = {
        title: (anchor.textContent || '').trim() || href || 'Bez názvu',
        url: href,
        addDate: addDateAttr ? Number(addDateAttr) : undefined,
        lastModified: lastModifiedAttr ? Number(lastModifiedAttr) : undefined,
      };

      // Parse tags from attributes (TAGS or DATA-TAGS)
      const tagsAttr = anchor.getAttribute('TAGS') ?? anchor.getAttribute('tags') ?? anchor.getAttribute('DATA-TAGS') ?? anchor.getAttribute('data-tags');
      if (tagsAttr) {
        const tags = tagsAttr.split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length) link.tags = tags;
      }

      // Collect DD siblings (descriptions)
      const descriptions: string[] = [];
      let lookahead = idx + 1;
      while (lookahead < children.length && children[lookahead].tagName === 'DD') {
        const desc = children[lookahead].textContent?.trim();
        if (desc) descriptions.push(desc);
        lookahead += 1;
      }
      if (descriptions.length) {
        link.description = descriptions.join('\n');
        // Try to infer tags from a description line starting with "Tags:" or "Štítky:"
        const tagLine = descriptions.find(d => /^\s*(tags|štítky)\s*:/i.test(d));
        if (tagLine && !link.tags) {
          const csv = tagLine.replace(/^\s*(tags|štítky)\s*:/i, '').trim();
          const tags = csv.split(',').map(t => t.trim()).filter(Boolean);
          if (tags.length) link.tags = tags;
        }
      }
      idx = lookahead - 1;
      links.push(link);
    }
  }

  return { links, nested };
};

export const parseBookmarksHtml = (html: string): ParsedBookmarkCategory[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rootDl = doc.querySelector('dl');
  if (!isElement(rootDl)) return [];

  const categories: ParsedBookmarkCategory[] = [];
  const children = Array.from(rootDl.children);
  for (let idx = 0; idx < children.length; idx += 1) {
    const child = children[idx];
    if (child.tagName.toLowerCase() !== 'dt') continue;
    const firstChild = child.firstElementChild;
    if (!firstChild || firstChild.tagName.toLowerCase() !== 'h3') continue;
    const nestedDl = Array.from(child.children).find((el) => el.tagName.toLowerCase() === 'dl') ?? null;
    const result = parseCategoryContent(nestedDl);
    categories.push({
      name: firstChild.textContent?.trim() || 'Bez názvu',
      links: result.links,
    });
    categories.push(...result.nested);
  }
  return categories;
};
