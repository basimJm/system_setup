import { Suspense, createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_RELOAD_WINDOW_MS, isChunkLoadError, lazyPage } from '@/app/lazyPage';
import { STORAGE_KEYS } from '@/constants/storage';
import { ErrorBoundary } from '@/presentation/components/feedback/ErrorBoundary';
import { safeStorage } from '@/infrastructure/storage/safeStorage';

const chunkError = () =>
  new TypeError('Failed to fetch dynamically imported module: /assets/Page-abc.js');
const Page = () => <p>page ready</p>;

const show = (page: ReturnType<typeof lazyPage>) =>
  render(
    <ErrorBoundary>
      <Suspense fallback={<p>loading</p>}>{createElement(page)}</Suspense>
    </ErrorBoundary>,
  );

beforeEach(() => safeStorage.remove(STORAGE_KEYS.chunkReloadAt));

describe('isChunkLoadError', () => {
  it('knows the messages browsers give for a missing page file', () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: x'))).toBe(
      true,
    );
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 7 failed'))).toBe(true);
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
  });
});

describe('lazyPage', () => {
  it('renders the page and forgets an earlier reload', async () => {
    safeStorage.set(STORAGE_KEYS.chunkReloadAt, '123');
    show(lazyPage(() => Promise.resolve({ default: Page })));
    expect(await screen.findByText('page ready')).toBeInTheDocument();
    expect(safeStorage.get(STORAGE_KEYS.chunkReloadAt)).toBeNull();
  });

  it('reloads once when the page file is gone (a new version was deployed) and keeps waiting', async () => {
    const reload = vi.fn();
    show(lazyPage(() => Promise.reject(chunkError()), { reload, now: () => 1_000_000 }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(safeStorage.get(STORAGE_KEYS.chunkReloadAt)).toBe('1000000');
  });

  it('does not reload again right after a reload: the failure is thrown', async () => {
    const reload = vi.fn();
    safeStorage.set(STORAGE_KEYS.chunkReloadAt, String(1_000_000 - (CHUNK_RELOAD_WINDOW_MS - 1)));
    show(lazyPage(() => Promise.reject(chunkError()), { reload, now: () => 1_000_000 }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads again for a later deploy (outside the window)', async () => {
    const reload = vi.fn();
    safeStorage.set(STORAGE_KEYS.chunkReloadAt, '1');
    show(
      lazyPage(() => Promise.reject(chunkError()), {
        reload,
        now: () => 1 + CHUNK_RELOAD_WINDOW_MS,
      }),
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('never reloads for an error that is not a missing file', async () => {
    const reload = vi.fn();
    show(lazyPage(() => Promise.reject(new Error('boom')), { reload }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
