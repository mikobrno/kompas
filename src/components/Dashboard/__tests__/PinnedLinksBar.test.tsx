import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PinnedLinksBar } from '../PinnedLinksBar';
import type { User } from '@supabase/supabase-js';
import * as AuthModule from '../../../contexts/AuthContext';

// Minimal normalize mock (identity)
vi.mock('../../../lib/normalize', () => ({
  normalizePinnedRows: <T,>(d: T) => d,
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'pinned_links') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: [
                  {
                    link_id: 'l1',
                    display_order: 0,
                    links: { id: 'l1', display_name: 'Doc', url: 'https://d', favicon_url: null },
                  },
                ],
                error: null,
              }),
            }),
          }),
        } as unknown as Record<string, unknown>;
      }
      return {} as unknown as Record<string, unknown>;
    },
  },
}));

describe('PinnedLinksBar', () => {
  beforeEach(() => vi.resetModules());

  it('renders pinned links when present', async () => {
    // Mock AuthContext to provide a user id
    // @ts-expect-error simplified mock for tests
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u1' } as unknown as User,
      profile: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(<PinnedLinksBar />);

    await waitFor(() => {
      expect(screen.getByText('Připnuté odkazy')).toBeInTheDocument();
      expect(screen.getByText('Doc')).toBeInTheDocument();
    });
  });
});
