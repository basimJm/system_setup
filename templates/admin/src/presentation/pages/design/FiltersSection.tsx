import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GALLERY_NOW } from '@/constants/ui';
import { initialRangeValue, type DateRangeValue } from '@/domain/shared/dateRange';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { Text } from '../../components/core/Text';
import { DateRangePicker } from '../../components/data/DateRangePicker';
import { ExportMenu } from '../../components/data/ExportMenu';
import { FilterBar, type ActiveFilter } from '../../components/data/FilterBar';
import { Select } from '../../components/form/Select';

const CITY_KEYS = ['amman', 'irbid', 'zarqa'] as const;
const NO_CITY = '';

/** Gallery section for the filter kit (ADM-016): filter bar with chips, date range with compare, export menu. */
export function FiltersSection() {
  const { t } = useTranslation();
  const k = (key: string) => t(`design.filters.${key}`);
  const now = new Date(GALLERY_NOW);
  const [range, setRange] = useState<DateRangeValue>(() => initialRangeValue(now));
  const [city, setCity] = useState(NO_CITY);
  const [exports, setExports] = useState<string[]>([]);

  const active: ActiveFilter[] = [
    ...(city === NO_CITY
      ? []
      : [{ key: 'city', label: `${k('city')}: ${k(`cities.${city}`)}`, onRemove: () => setCity(NO_CITY) }]),
    { key: 'range', label: t(`dateRange.preset.${range.preset}`), onRemove: () => setRange(initialRangeValue(now)) },
  ];
  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <FilterBar
        active={active}
        onClearAll={() => {
          setCity(NO_CITY);
          setRange(initialRangeValue(now));
        }}
      >
        <Select
          label={k('city')}
          value={city}
          onChange={(event) => setCity(event.target.value)}
          options={[
            { value: NO_CITY, label: k('anyCity') },
            ...CITY_KEYS.map((key) => ({ value: key, label: k(`cities.${key}`) })),
          ]}
        />
        <DateRangePicker value={range} onChange={setRange} now={now} />
        <ExportMenu
          onExport={(format) => {
            setExports((list) => [...list, format]);
            return Promise.resolve();
          }}
        />
      </FilterBar>
      {exports.length > 0 ? <Text tone="muted">{t('design.filters.exported', { list: exports.join(', ') })}</Text> : null}
    </Card>
  );
}
