import { describe, it, expect } from 'vitest';
import { filterCategories, type Category } from './search';

const sample: Category[] = [
  {
    id: 'c1',
    name: 'Dev nástroje',
    owner_id: 'u1',
    is_archived: false,
    display_order: 0,
    links: [
      { id: 'l1', display_name: 'GitHub', url: 'https://github.com', favicon_url: null, display_order: 0, tags: [{ name: 'code' }] },
      { id: 'l2', display_name: 'Docs', url: 'https://docs.example.com', favicon_url: null, display_order: 1, tags: [{ name: 'docs' }] },
    ],
  },
  {
    id: 'c2',
    name: 'Marketing',
    owner_id: 'u1',
    is_archived: false,
    display_order: 1,
    links: [
      { id: 'l3', display_name: 'Google Ads', url: 'https://ads.google.com', favicon_url: null, display_order: 0, tags: [{ name: 'ads' }] },
    ],
  },
];

describe('filterCategories', () => {
  it('returns all when query empty', () => {
    expect(filterCategories(sample, '').length).toBe(2);
  });

  it('filters by category name', () => {
    const res = filterCategories(sample, 'market');
    expect(res.length).toBe(1);
    expect(res[0].name).toBe('Marketing');
  });

  it('filters by link name or url', () => {
    const res = filterCategories(sample, 'github');
    expect(res.length).toBe(1);
    expect(res[0].links.some(l => l.display_name === 'GitHub')).toBe(true);
  });

  it('filters by tag name', () => {
    const res = filterCategories(sample, 'docs');
    expect(res.length).toBe(1);
    expect(res[0].links.length).toBe(1);
    expect(res[0].links[0].display_name).toBe('Docs');
  });
});
