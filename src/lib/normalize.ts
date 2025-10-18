export type PinnedRow = {
  link_id: string;
  display_order: number;
  links: {
    id: string;
    display_name: string;
    url: string;
    favicon_url: string | null;
  };
};

export function normalizePinnedRows(data: unknown): PinnedRow[] {
  type Row = { link_id: unknown; display_order: unknown; links: unknown };
  const rows = (data as Row[]) || [];
  const result: PinnedRow[] = [];
  const isLinkShape = (val: unknown): val is { id: string; display_name: string; url: string; favicon_url?: unknown } => {
    if (typeof val !== 'object' || val === null) return false;
    const o = val as Record<string, unknown>;
    return typeof o.id === 'string' && typeof o.display_name === 'string' && typeof o.url === 'string';
  };
  for (const raw of rows) {
    const link = raw.links as unknown;
    const linkObj = Array.isArray(link) ? (link as unknown[])[0] : link;
    if (isLinkShape(linkObj)) {
      result.push({
        link_id: String(raw.link_id),
        display_order: Number(raw.display_order),
        links: {
          id: linkObj.id,
          display_name: linkObj.display_name,
          url: linkObj.url,
          favicon_url: ((): string | null => {
            const fv = (linkObj as Record<string, unknown>).favicon_url;
            return typeof fv === 'string' ? fv : null;
          })(),
        },
      });
    }
  }
  return result;
}
