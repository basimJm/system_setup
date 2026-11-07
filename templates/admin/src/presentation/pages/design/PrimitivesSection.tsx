import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import { GALLERY_EXTERNAL_LINK } from '@/constants/ui';
import { Avatar } from '../../components/core/Avatar';
import { Badge } from '../../components/core/Badge';
import { Button } from '../../components/core/Button';
import { Card } from '../../components/core/Card';
import { Chip } from '../../components/core/Chip';
import { Divider } from '../../components/core/Divider';
import { Heading } from '../../components/core/Heading';
import { KeyValue } from '../../components/core/KeyValue';
import { Link } from '../../components/core/Link';
import { Text } from '../../components/core/Text';
import { Tooltip } from '../../components/core/Tooltip';

/** Gallery section for the typography and display primitives (ADM-012). */
export function PrimitivesSection() {
  const { t } = useTranslation();
  const [chipVisible, setChipVisible] = useState(true);
  const k = (key: string) => t(`design.primitives.${key}`);
  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <div className="app-row">
        <Text>{k('text')}</Text>
        <Text tone="muted">{k('muted')}</Text>
        <Text tone="danger" strong>
          {k('danger')}
        </Text>
        <Link to={ROUTES.items}>{k('link')}</Link>
        <Link href={GALLERY_EXTERNAL_LINK}>{k('external')}</Link>
      </div>
      <Heading level={3} look={1}>
        {k('heading')}
      </Heading>
      <Divider />
      <div className="app-row">
        <Avatar name={k('avatar')} size="sm" />
        <Avatar name={k('avatar')} />
        <Avatar name={k('avatar')} size="lg" />
        <Chip>{k('chip')}</Chip>
        {chipVisible ? (
          <Chip tone="purple" onRemove={() => setChipVisible(false)} removeLabel={k('removeChip')}>
            {k('chipRemovable')}
          </Chip>
        ) : null}
        <Tooltip content={k('tooltip')}>
          {(aria) => (
            <Button variant="secondary" {...aria}>
              {k('tooltipTrigger')}
            </Button>
          )}
        </Tooltip>
      </div>
      <KeyValue
        placeholder={k('empty')}
        items={[
          { key: 'phone', label: k('phone'), value: '+991 79 123 4567', ltr: true },
          { key: 'created', label: k('created'), value: '' },
          { key: 'status', label: k('status'), value: <Badge tone="green">{k('text')}</Badge> },
        ]}
      />
    </Card>
  );
}
