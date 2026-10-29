import { screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteErrorPage } from '@/presentation/pages/RouteErrorPage';
import { makeContainer, renderWithApp } from './helpers/render';

function Boom(): never {
  throw new Error('page exploded');
}

describe('RouteErrorPage', () => {
  it('replaces the router crash screen with the panel error state and a retry', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([
      { path: '/', element: <Boom />, errorElement: <RouteErrorPage /> },
    ]);
    renderWithApp(<RouterProvider router={router} />, makeContainer(), 'en');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected Application Error/i)).toBeNull();
    quiet.mockRestore();
  });
});
