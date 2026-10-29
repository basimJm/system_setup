import { useTranslation } from 'react-i18next';
import { STATUS_LABEL_PREFIX, type StatusKind } from '@/constants/status';
import { isKnownStatus, toneOf } from '@/domain/shared/status';
import { Badge } from './Badge';

export interface StatusBadgeProps {
  kind: StatusKind;
  /** The enum value as the API sends it. */
  value: string;
}

/** The only way pages show a status: tone and label come from the registry, an unknown value shows as it is. */
export function StatusBadge({ kind, value }: StatusBadgeProps) {
  const { t } = useTranslation();
  const label = isKnownStatus(kind, value) ? t(`${STATUS_LABEL_PREFIX}.${kind}.${value}`) : value;
  return <Badge tone={toneOf(kind, value)}>{label}</Badge>;
}
