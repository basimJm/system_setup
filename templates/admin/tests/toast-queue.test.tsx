import { act, fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_VISIBLE_TOASTS, TOAST_DURATION_MS } from '@/constants/ui';
import { useToast, type ToastTone } from '@/presentation/components/overlay/Toast';
import { renderWithApp } from './helpers/render';

type ToastApi = ReturnType<typeof useToast>;
const holder: { api?: ToastApi } = {};
const api = {
  show: (message: string, tone?: ToastTone) => holder.api?.show(message, tone) ?? -1,
  dismiss: (id: number) => holder.api?.dismiss(id),
};
function Probe({ onApi }: { onApi: (value: ToastApi) => void }) {
  const toast = useToast();
  useEffect(() => {
    onApi(toast);
  });
  return null;
}

const show = (message: string, tone?: ToastTone) => {
  let id = -1;
  act(() => {
    id = api.show(message, tone);
  });
  return id;
};

describe('toast queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renderWithApp(
      <Probe
        onApi={(value) => {
          holder.api = value;
        }}
      />,
    );
  });
  afterEach(() => vi.useRealTimers());

  it('shows messages in order and returns increasing ids', () => {
    const first = show('one');
    const second = show('two');
    expect(second).toBeGreaterThan(first);
    expect(screen.getAllByText(/one|two/).map((e) => e.textContent)).toEqual(['one', 'two']);
  });

  it(`keeps at most ${String(MAX_VISIBLE_TOASTS)} and drops the oldest`, () => {
    ['a', 'b', 'c', 'd', 'e'].forEach((m) => show(m));
    expect(screen.queryByText('a')).toBeNull();
    expect(screen.queryByText('b')).toBeNull();
    expect(['c', 'd', 'e'].every((m) => screen.queryByText(m) !== null)).toBe(true);
  });

  it('each toast disappears after the configured time, independently', async () => {
    show('early');
    await act(() => vi.advanceTimersByTimeAsync(TOAST_DURATION_MS - 1_000));
    show('late');
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(screen.queryByText('early')).toBeNull();
    expect(screen.getByText('late')).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(TOAST_DURATION_MS));
    expect(screen.queryByText('late')).toBeNull();
  });

  it('can be dismissed by the close button or by id, and a stale id is harmless', () => {
    const id = show('by id');
    show('by button');
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1] as HTMLElement);
    expect(screen.queryByText('by button')).toBeNull();
    act(() => api.dismiss(id));
    expect(screen.queryByText('by id')).toBeNull();
    act(() => api.dismiss(id));
    act(() => api.dismiss(9_999));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('errors are announced as alerts, the rest as status', () => {
    show('fine', 'success');
    show('info');
    show('broken', 'error');
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent('broken');
  });

  it('a dismissed toast does not leave a timer behind', async () => {
    const baseline = vi.getTimerCount();
    const id = show('gone');
    expect(vi.getTimerCount()).toBe(baseline + 1);
    act(() => api.dismiss(id));
    expect(vi.getTimerCount()).toBe(baseline);
    await act(() => vi.advanceTimersByTimeAsync(TOAST_DURATION_MS * 2));
    expect(screen.queryByText('gone')).toBeNull();
  });
});
