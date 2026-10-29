import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_OPTIONS } from '@/constants/ui';
import { formatNumber } from '@/domain/shared/format';
import { useLanguage } from '../../hooks/useLanguage';
import { Select } from '../form/Select';
import { IconButton } from '../core/IconButton';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Accessible name of the navigation; give each table on a page its own. */
  ariaLabel?: string;
}

export const pageCount = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  ariaLabel,
}: PaginationProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const num = (value: number) => formatNumber(value, language);
  const pages = pageCount(total, pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="app-pagination" aria-label={ariaLabel ?? t('table.pagination')}>
      <span className="app-pagination__range">
        {t('table.range', { from: num(from), to: num(to), total: num(total) })}
      </span>
      <Select
        label={t('table.pageSize')}
        value={String(pageSize)}
        options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="app-pagination__size"
      />
      <IconButton
        icon="chevronStart"
        directional
        label={t('table.previous')}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      <span className="app-pagination__page">{t('table.pageOf', { page, pages })}</span>
      <IconButton
        icon="chevronEnd"
        directional
        label={t('table.next')}
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
}
