import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICON_PATHS, type IconName } from '@/constants/icons';
import { AppError } from '@/infrastructure/errors/AppError';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { Icon } from '../../components/core/Icon';
import { IconButton } from '../../components/core/IconButton';
import { AsyncView } from '../../components/feedback/AsyncView';
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary';
import { IdleWarningDialog } from '../../components/feedback/IdleWarningDialog';
import { InlineAlert } from '../../components/feedback/InlineAlert';
import { Skeleton } from '../../components/feedback/Skeleton';
import { Spinner } from '../../components/feedback/Spinner';
import { StatusPage } from '../../components/feedback/StatusPage';
import { SegmentedControl } from '../../components/form/SegmentedControl';
import { TextArea } from '../../components/form/TextArea';

type View = 'loading' | 'error' | 'ready';
const ICONS = Object.keys(ICON_PATHS) as IconName[];

function Boom(): never {
  throw new Error('gallery render failure');
}

/** Gallery section for the small pieces: icons, icon buttons, spinners, alerts, async states, boundary, text area. */
export function BasicsSection() {
  const { t } = useTranslation();
  const k = (key: string) => t(`designKits.basics.${key}`);
  const [view, setView] = useState<View>('ready');
  const [crash, setCrash] = useState(false);
  const [idleOpen, setIdleOpen] = useState(false);
  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <div className="app-row" aria-label={k('icons')} role="group">
        {ICONS.map((name) => (
          <Icon key={name} name={name} label={name} />
        ))}
      </div>
      <div className="app-row">
        <IconButton icon="bell" label={k('bell')} badge={3} />
        <IconButton icon="gear" label={k('gear')} disabled />
        <Spinner />
        <Spinner small />
      </div>
      <InlineAlert error={new AppError({ kind: 'validation' })} />
      <SegmentedControl<View>
        ariaLabel={k('state')}
        value={view}
        onChange={setView}
        options={[
          { value: 'loading', label: k('loading') },
          { value: 'error', label: k('error') },
          { value: 'ready', label: k('ready') },
        ]}
      />
      <AsyncView
        loading={view === 'loading'}
        error={view === 'error' ? new AppError({ kind: 'network' }) : undefined}
        onRetry={() => setView('ready')}
        skeleton={<Skeleton width="half" />}
      >
        <p>{k('content')}</p>
      </AsyncView>
      <button type="button" className="app-btn app-btn--secondary app-btn--sm" onClick={() => setIdleOpen(true)}>
        {k('idle')}
      </button>
      <IdleWarningDialog open={idleOpen} secondsLeft={45} onStay={() => setIdleOpen(false)} onSignOut={() => setIdleOpen(false)} />
      <TextArea label={k('notes')} rows={3} />
      <StatusPage code="403" title={k('forbiddenTitle')} text={k('forbiddenText')} icon="shield" />
      <button type="button" className="app-btn app-btn--secondary app-btn--sm" onClick={() => setCrash(true)}>
        {k('crash')}
      </button>
      <ErrorBoundary>{crash ? <Boom /> : <p>{k('boundaryOk')}</p>}</ErrorBoundary>
    </Card>
  );
}
