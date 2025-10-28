import { describe, it, expect } from 'vitest';
import { generateBookmarksHtml, parseBookmarksHtml, type BookmarkCategory } from './bookmarkExport';

describe('bookmark export helpers', () => {
  it('generates html that can be parsed back', () => {
    const categories: BookmarkCategory[] = [
      {
        name: 'Kategorie A',
        links: [
          {
            title: 'Example',
            url: 'https://example.com',
            description: 'Popis odkazu',
            addDate: 1_700_000_000,
            tags: ['alpha', 'beta'],
          },
        ],
      },
      {
        name: 'Kategorie B',
        links: [
          {
            title: 'Example 2',
            url: 'https://example.org',
          },
        ],
      },
    ];

  const html = generateBookmarksHtml(categories, { generatedAt: new Date('2025-01-01T00:00:00Z') });
    expect(html).toContain('<H3');
    expect(html).toContain('<A HREF="https://example.com"');
    expect(html).toContain('TAGS="alpha, beta"');

    const parsed = parseBookmarksHtml(html);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Kategorie A');
    expect(parsed[0].links).toHaveLength(1);
    expect(parsed[0].links[0].url).toBe('https://example.com');
  expect(parsed[0].links[0].description).toBe('Popis odkazu');
  expect(parsed[0].links[0].tags).toEqual(['alpha', 'beta']);
  });

  it('parses nested bookmark folders and descriptions', () => {
    const sample = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3 ADD_DATE="123">Parent</H3>
  <DL><p>
    <DT><A HREF="https://one.example" ADD_DATE="456">First</A>
    <DD>First description</DD>
    <DT><H3>Child</H3>
    <DL><p>
      <DT><A HREF="https://two.example">Second</A>
    </DL><p>
  </DL><p>
</DL><p>`;

    const parsed = parseBookmarksHtml(sample);
    expect(parsed.map((cat) => cat.name)).toEqual(['Parent', 'Child']);
    expect(parsed[0].links).toHaveLength(1);
    expect(parsed[0].links[0]).toMatchObject({ url: 'https://one.example', description: 'First description' });
    expect(parsed[1].links[0].url).toBe('https://two.example');
  });
});
