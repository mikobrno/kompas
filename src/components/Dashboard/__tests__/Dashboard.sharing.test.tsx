import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { Dashboard } from '../Dashboard';
// Lightweight inline supabase mock driven by per-test fixtures
type AnyRecord = Record<string, unknown>;
type Fixtures = {
  byTable: Record<string, { select?: unknown[] }>;
  rpc: Record<string, unknown>;
};
let fixtures: Fixtures = { byTable: {}, rpc: {} };
vi.mock('../../../lib/supabase', () => {
  type Chain = {
    _data: unknown;
    select: () => Chain;
    eq: () => Chain;
    in: () => Chain;
    order: () => Chain;
    limit: () => Chain;
    insert?: (_payload?: unknown) => Chain;
    update?: (_payload?: unknown) => Chain;
    delete?: () => Chain;
    single: () => Chain;
    maybeSingle: () => Chain;
    then: (resolve: (v: unknown) => void) => void;
  };

  const makeChain = (table: string): Chain => {
    const chain: Chain = {
      _data: undefined as unknown,
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
  insert: () => chain,
  update: () => chain,
  delete: () => chain,
      single: () => { chain._data = (fixtures.byTable[table] as AnyRecord)?.single ?? chain._data; return chain; },
      maybeSingle: () => { chain._data = (fixtures.byTable[table] as AnyRecord)?.maybeSingle ?? chain._data; return chain; },
      then: (resolve: (v: unknown) => void) => {
        const base = (fixtures.byTable[table]?.select ?? []) as unknown[];
        resolve({ data: (chain._data ?? base), error: null });
      },
    };
    return chain;
  };

  const fakeChannel = {
    on: () => fakeChannel,
    subscribe: () => ({}) as unknown,
  };

  return {
    supabase: {
      from: (table: string) => makeChain(table),
      rpc: (fn: string) => Promise.resolve({ data: fixtures.rpc[fn] as AnyRecord, error: null }),
      channel: () => fakeChannel,
      removeChannel: () => {},
    },
  };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'owner' },
    profile: { id: 'owner', email: 'owner@example.com', full_name: 'Owner', role: 'admin', theme: 'light' },
    impersonatedUserId: 'zuzana',
  }),
}));

// Make sure vitest-dom types are available via setup file

describe('Dashboard sharing & impersonation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('shows per-category shared data for impersonated user', async () => {
    fixtures = {
      rpc: {
        get_accessible_categories_with_permission: [
          { id: 'cat1', name: 'Cat A', owner_id: 'ownerA', is_archived: false, display_order: 0, created_at: new Date().toISOString(), permission: 'viewer', shared_link_ids: null },
        ],
      },
      byTable: {
        links: {
          select: [
            { id: 'l1', display_name: 'L1', url: '#', favicon_url: null, is_archived: false, display_order: 0, category_id: 'cat1', link_tags: [] },
          ],
        },
      },
    };

    render(<Dashboard />);

    expect(await screen.findByText('Sdíleno se mnou')).toBeInTheDocument();
    expect(await screen.findByText('Cat A')).toBeInTheDocument();
  });

  it('marks per-link shared links with badge', async () => {
    fixtures = {
      rpc: {
        get_accessible_categories_with_permission: [
          { id: 'cat2', name: 'Cat B', owner_id: 'ownerB', is_archived: false, display_order: 0, created_at: new Date().toISOString(), permission: 'viewer', shared_link_ids: ['l2'] },
        ],
      },
      byTable: {
        links: {
          select: [
            { id: 'l2', display_name: 'L2', url: '#', favicon_url: null, is_archived: false, display_order: 0, category_id: 'cat2', link_tags: [] },
          ],
        },
      },
    };

    render(<Dashboard />);

  expect(await screen.findByText('L2')).toBeInTheDocument();
  // Verify per-link badge specifically: it appears next to link name "L2"
  const linkRow = await screen.findByText('L2');
  const rowEl = linkRow.closest('div');
  expect(rowEl).toHaveTextContent('Sdílené');
  });
});
