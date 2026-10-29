import { useTranslation } from 'react-i18next';
import { STATUS_KINDS } from '@/constants/status';
import { statusValues } from '@/domain/shared/status';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { StatusBadge } from '../../components/core/StatusBadge';
import { Text } from '../../components/core/Text';

/** Gallery section listing every registered status (ADM-014): the registry rendered, not re-typed. */
export function StatusSection() {
  const { t } = useTranslation();
  return (
    <Card className="app-stack" aria-label={t('design.statuses.title')}>
      <Heading level={2}>{t('design.statuses.title')}</Heading>
      {STATUS_KINDS.map((kind) => (
        <div key={kind} className="app-row">
          <Text tone="muted" strong>
            {kind}
          </Text>
          {statusValues(kind).map((value) => (
            <StatusBadge key={value} kind={kind} value={value} />
          ))}
        </div>
      ))}
    </Card>
  );
}
