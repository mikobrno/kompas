/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareCategoryModal } from '../ShareCategoryModal';
import * as AuthModule from '../../../contexts/AuthContext';

// supabase mock capturing calls
const calls: any[] = [];
vi.mock('../../../lib/supabase', () => {
  const chain = (res: any) => ({ then: (resolve: (v: any) => void) => resolve({ data: res, error: null }) });
  const makeQuery = (table: string) => ({
    select: () => {
      if (table === 'users') {
        const res = [{ id: 'u1', full_name: 'User One', email: 'u1@x' }];
        return { neq: () => chain(res) } as unknown as any;
      }
      if (table === 'groups') return chain([{ id: 'g1', name: 'Group One' }, { id: 'g2', name: 'Group Two' }]);
      if (table === 'category_shares') {
        const shares = [
          { category_id: 'c1', shared_with_user_id: 'u1', shared_with_group_id: null, permission_level: 'viewer' },
          { category_id: 'c1', shared_with_user_id: null, shared_with_group_id: 'g2', permission_level: 'editor' },
        ];
        return { eq: () => chain(shares) } as unknown as any;
      }
      return chain([]);
    },
    delete: () => {
      calls.push({ op: 'delete', table });
      return { eq: () => chain(null) } as unknown as any;
    },
    insert: (payload: any) => {
      calls.push({ op: 'insert', table, payload });
      return chain(payload);
    },
  });
  return { supabase: { from: (t: string) => makeQuery(t) } };
});

// Mock auth so current user is u_current (filtered out from users list by component logic)
vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
  user: { id: 'u_current' } as any,
  profile: null,
  session: null,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  refreshProfile: vi.fn(),
});

describe('ShareCategoryModal', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('loads users/groups, keeps existing shares and saves changes', async () => {
    render(
      <ShareCategoryModal isOpen categoryId="c1" onClose={() => {}} />
    );

    // Existing: u1 viewer and g2 editor. Toggle user u1 to editor.
    await waitFor(() => expect(screen.getByText('Uživatelé')).toBeInTheDocument());
    // select permission for user u1
    const userSelect = screen.getByLabelText('Oprávnění pro uživatele User One') as HTMLSelectElement;
    fireEvent.change(userSelect, { target: { value: 'editor' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => {
      const hasDelete = calls.some((c) => c.op === 'delete' && c.table === 'category_shares');
      const ins = calls.find((c) => c.op === 'insert' && c.table === 'category_shares');
      expect(hasDelete).toBe(true);
      expect(ins).toBeTruthy();
      expect(ins.payload).toEqual([
        { category_id: 'c1', shared_with_user_id: 'u1', shared_with_group_id: null, permission_level: 'editor' },
        { category_id: 'c1', shared_with_user_id: null, shared_with_group_id: 'g2', permission_level: 'editor' },
      ]);
    });
  });
});
