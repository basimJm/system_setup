import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GALLERY_SAMPLE_PAGES } from '@/constants/richText';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { Text } from '../../components/core/Text';
import {
  LocalizedRichTextEditor,
  type LocalizedHtml,
} from '../../components/form/LocalizedRichTextEditor';
import { SchedulePicker, type Schedule } from '../../components/form/SchedulePicker';

/** Gallery section for the rich text editor and the schedule picker (ADM-021). */
export function RichTextSection() {
  const { t } = useTranslation();
  const k = (key: string) => t(`designKits.richText.${key}`);
  const [pages, setPages] = useState<LocalizedHtml>(GALLERY_SAMPLE_PAGES);
  const [schedule, setSchedule] = useState<Schedule>({ start: '2026-10-14', end: '2026-10-21' });
  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <LocalizedRichTextEditor label={k('page')} value={pages} onChange={setPages} />
      <SchedulePicker
        startLabel={k('start')}
        endLabel={k('end')}
        value={schedule}
        onChange={setSchedule}
      />
      <Text tone="muted">{t('designKits.richText.saved', { start: schedule.start, end: schedule.end })}</Text>
    </Card>
  );
}
