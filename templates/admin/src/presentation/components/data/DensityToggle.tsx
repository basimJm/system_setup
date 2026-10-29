import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '../form/SegmentedControl';
import type { Density } from './tableTypes';

export interface DensityToggleProps {
  value: Density;
  onChange: (value: Density) => void;
}

export function DensityToggle({ value, onChange }: DensityToggleProps) {
  const { t } = useTranslation();
  return (
    <SegmentedControl<Density>
      ariaLabel={t('table.density')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'comfortable', label: t('table.comfortable') },
        { value: 'compact', label: t('table.compact') },
      ]}
    />
  );
}
