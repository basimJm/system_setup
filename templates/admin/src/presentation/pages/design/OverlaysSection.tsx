import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/core/Button';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { Text } from '../../components/core/Text';
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog';
import { Drawer } from '../../components/overlay/Drawer';
import { Menu } from '../../components/overlay/Menu';
import { ReasonDialog } from '../../components/overlay/ReasonDialog';
import { useToast } from '../../components/overlay/Toast';

type Active = 'confirm' | 'confirmDanger' | 'reason' | 'reasonDanger' | 'drawer' | null;

/** Gallery section for the overlay kit (ADM-017). */
export function OverlaysSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const k = (key: string) => t(`design.overlays.${key}`);
  const [active, setActive] = useState<Active>(null);
  const [last, setLast] = useState('');
  const close = () => setActive(null);
  const done = (what: string) => {
    setLast(what);
    close();
  };
  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <div className="app-row">
        <Button variant="secondary" onClick={() => setActive('confirm')}>
          {k('openConfirm')}
        </Button>
        <Button variant="secondary" onClick={() => setActive('confirmDanger')}>
          {k('openConfirmDanger')}
        </Button>
        <Button variant="secondary" onClick={() => setActive('reason')}>
          {k('openReason')}
        </Button>
        <Button variant="secondary" onClick={() => setActive('reasonDanger')}>
          {k('openReasonDanger')}
        </Button>
        <Button variant="secondary" onClick={() => setActive('drawer')}>
          {k('openDrawer')}
        </Button>
        <Menu
          label={k('menu')}
          items={[
            { key: 'view', label: k('menuView'), onSelect: () => setLast(k('menuView')) },
            { key: 'edit', label: k('menuEdit'), onSelect: () => setLast(k('menuEdit')), disabled: true },
            { key: 'block', label: k('menuBlock'), onSelect: () => setLast(k('menuBlock')), danger: true },
          ]}
        />
        {(['info', 'success', 'error'] as const).map((tone) => (
          <Button key={tone} variant="ghost" onClick={() => toast.show(k(`toast.${tone}`), tone)}>
            {k(`toast.${tone}`)}
          </Button>
        ))}
      </div>
      {last ? <Text tone="muted">{t('design.overlays.last', { what: last })}</Text> : null}
      <ConfirmDialog
        open={active === 'confirm'}
        title={k('confirmTitle')}
        description={k('confirmText')}
        confirmLabel={k('yes')}
        onConfirm={() => done(k('openConfirm'))}
        onClose={close}
      />
      <ConfirmDialog
        open={active === 'confirmDanger'}
        title={k('confirmDangerTitle')}
        description={k('confirmDangerText')}
        confirmLabel={k('discard')}
        destructive
        onConfirm={() => done(k('openConfirmDanger'))}
        onClose={close}
      />
      <ReasonDialog
        open={active === 'reason'}
        title={k('reasonTitle')}
        confirmLabel={k('yes')}
        onConfirm={(reason) => done(`${k('openReason')}: ${reason}`)}
        onClose={close}
      />
      <ReasonDialog
        open={active === 'reasonDanger'}
        title={k('reasonDangerTitle')}
        description={k('reasonDangerText')}
        confirmLabel={k('block')}
        destructive
        onConfirm={(reason) => done(`${k('openReasonDanger')}: ${reason}`)}
        onClose={close}
      />
      <Drawer
        open={active === 'drawer'}
        title={k('drawerTitle')}
        onClose={close}
        footer={<Button onClick={close}>{k('close')}</Button>}
      >
        <Text>{k('drawerText')}</Text>
      </Drawer>
    </Card>
  );
}
