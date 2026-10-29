import { useTranslation } from 'react-i18next';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';

/** Gallery section for the shell pieces shown outside the real shell: the breadcrumbs row. */
export function ShellSection() {
  const { t } = useTranslation();
  const k = (key: string) => t(`designKits.shell.${key}`);
  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <Breadcrumbs crumbs={[{ label: k('crumbModule'), to: '#' }, { label: k('crumbPage') }]} />
    </Card>
  );
}
