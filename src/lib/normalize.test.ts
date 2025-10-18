import { describe, it, expect } from 'vitest';
import { normalizePinnedRows } from './normalize';

describe('normalizePinnedRows', () => {
  it('returns empty array for invalid input', () => {
    expect(normalizePinnedRows(null as unknown)).toEqual([]);
  });

  it('normalizes simple objects', () => {
    const input = [
      {
        link_id: 'l1',
        display_order: 0,
        links: { id: 'l1', display_name: 'A', url: 'https://a', favicon_url: null },
      },
    ];
    const out = normalizePinnedRows(input);
    expect(out).toHaveLength(1);
    expect(out[0].links.display_name).toBe('A');
  });

  it('takes first element when links is array', () => {
    const input = [
      {
        link_id: 'l2',
        display_order: 1,
        links: [
          { id: 'l2', display_name: 'B', url: 'https://b', favicon_url: 'ico' },
          { id: 'l2b', display_name: 'Bb', url: 'https://bb', favicon_url: null },
        ],
      },
    ];
    const out = normalizePinnedRows(input);
    expect(out[0].links.favicon_url).toBe('ico');
  });
});
