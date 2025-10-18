/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddLinkModal } from '../AddLinkModal';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'links') {
        // Chain: select -> eq -> eq -> limit -> Promise<{data}>
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [{ id: 'dup' }], error: null }),
              }),
            }),
          }),
        } as any;
      }
      return { select: () => Promise.resolve({ data: [], error: null }) } as any;
    },
  },
}));

describe('AddLinkModal', () => {
  beforeEach(() => vi.resetModules());

  it('prevents duplicate URL in category and shows alert', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <AddLinkModal isOpen categoryId="c1" onClose={() => {}} onSuccess={() => {}} />
    );

    fireEvent.change(screen.getByPlaceholderText('např. Google Docs'), { target: { value: 'Google' } });
    fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: 'https://google.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Přidat' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  });
});
