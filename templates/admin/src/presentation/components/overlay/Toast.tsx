import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MAX_VISIBLE_TOASTS, TOAST_DURATION_MS } from '@/constants/ui';
import { cx } from '../../utils/cx';
import { IconButton } from '../core/IconButton';

export type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  /** Shows a toast and returns its id. At most `MAX_VISIBLE_TOASTS` stay; the oldest goes first. */
  show: (message: string, tone?: ToastTone) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<readonly ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      nextId.current += 1;
      const id = nextId.current;
      setItems((prev) => [...prev, { id, tone, message }].slice(-MAX_VISIBLE_TOASTS));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      );
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="app-toasts" aria-live="polite">
          {items.map((i) => (
            <div
              key={i.id}
              className={cx('app-toast', `app-toast--${i.tone}`)}
              role={i.tone === 'error' ? 'alert' : 'status'}
            >
              <span>{i.message}</span>
              <IconButton icon="close" label={t('common.close')} onClick={() => dismiss(i.id)} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
