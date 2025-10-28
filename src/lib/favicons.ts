export const extractHostname = (rawUrl: string): string | null => {
  try {
    const u = new URL(rawUrl);
    return u.hostname || null;
  } catch {
    return null;
  }
};

export const googleFavicon = (host: string, size: 64 | 32 | 16 = 32): string =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;

export const iconHorseFavicon = (host: string): string =>
  `https://icon.horse/icon/${encodeURIComponent(host)}`;

/**
 * Returns a reasonable favicon URL for a given page URL.
 * Uses Google s2 service by default.
 */
export const bestFaviconFor = (pageUrl: string, size: 64 | 32 | 16 = 32): string | null => {
  const host = extractHostname(pageUrl);
  return host ? googleFavicon(host, size) : null;
};
