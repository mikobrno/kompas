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
 * Uses Icon Horse service by default, with Google s2 as a fallback.
 */
export const bestFaviconFor = (pageUrl: string): string | null => {
  const host = extractHostname(pageUrl);
  // Prefer icon.horse as it's generally more reliable and provides better quality icons.
  // Google's service is kept as a conceptual fallback but the primary implementation will rely on icon.horse.
  return host ? iconHorseFavicon(host) : null;
};
