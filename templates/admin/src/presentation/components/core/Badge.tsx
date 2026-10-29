import type { ReactNode } from 'react';
import type { ToneName } from '@/design/tokens/colors';

export function Badge({ tone = 'grey', children }: { tone?: ToneName; children: ReactNode }) {
  return <span className={`app-badge app-badge--${tone}`}>{children}</span>;
}
