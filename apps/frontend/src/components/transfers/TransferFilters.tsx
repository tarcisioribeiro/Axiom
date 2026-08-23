import { ViewfinderCircleIcon as CircleDot } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput } from '@/components/common/SearchInput';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/formatters';
import type { Account } from '@/types';

interface TransferFiltersProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  accountFilter: string;
  onAccountChange: (v: string) => void;
  startDate: Date | undefined;
  onStartDateChange: (d: Date | undefined) => void;
  endDate: Date | undefined;
  onEndDateChange: (d: Date | undefined) => void;
  accounts: Account[];
  hasActiveFilters: boolean;
  onClear: () => void;
}

export function TransferFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  accountFilter,
  onAccountChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  accounts,
  hasActiveFilters,
  onClear,
}: TransferFiltersProps) {
  const { t } = useTranslation();

  const activeFilters = [
    ...(statusFilter !== 'all'
      ? [
          {
            key: 'status',
            label: `${t('common.fields.status')}: ${t(`common.status.${statusFilter}`)}`,
            onRemove: () => onStatusChange('all'),
          },
        ]
      : []),
    ...(accountFilter !== 'all'
      ? [
          {
            key: 'account',
            label: `${t('common.fields.account')}: ${accounts.find((a) => a.id.toString() === accountFilter)?.account_name ?? accountFilter}`,
            onRemove: () => onAccountChange('all'),
          },
        ]
      : []),
    ...(startDate
      ? [
          {
            key: 'startDate',
            label: `${t('pages.transfers.dateFrom')}: ${formatDate(startDate)}`,
            onRemove: () => onStartDateChange(undefined),
          },
        ]
      : []),
    ...(endDate
      ? [
          {
            key: 'endDate',
            label: `${t('pages.transfers.dateTo')}: ${formatDate(endDate)}`,
            onRemove: () => onEndDateChange(undefined),
          },
        ]
      : []),
  ];

  return (
    <FilterBar
      hasActiveFilters={hasActiveFilters}
      onClear={onClear}
      activeFilters={activeFilters}
    >
      <SearchInput
        placeholder={t('pages.transfers.searchPlaceholder')}
        value={searchTerm}
        onValueChange={onSearchChange}
        className="w-44 flex-none"
      />
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger
          className="w-40"
          startIcon={<CircleDot className="h-3.5 w-3.5" />}
        >
          <SelectValue placeholder={t('pages.transfers.allStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('pages.transfers.allStatus')}</SelectItem>
          <SelectItem value="pending">{t('common.status.pending')}</SelectItem>
          <SelectItem value="processing">{t('common.status.processing')}</SelectItem>
          <SelectItem value="completed">{t('common.status.completed')}</SelectItem>
          <SelectItem value="failed">{t('common.status.failed')}</SelectItem>
          <SelectItem value="cancelled">{t('common.status.cancelled')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={accountFilter} onValueChange={onAccountChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder={t('pages.transfers.allAccounts')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('pages.transfers.allAccounts')}</SelectItem>
          {accounts.map((acc) => (
            <SelectItem key={acc.id} value={String(acc.id)}>
              {acc.account_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="gap-xs flex items-center">
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {t('pages.transfers.dateFrom')}
        </span>
        <DatePicker
          value={startDate}
          onChange={onStartDateChange}
          placeholder={t('pages.transfers.dateFrom')}
          clearable
        />
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {t('pages.transfers.dateTo')}
        </span>
        <DatePicker
          value={endDate}
          onChange={onEndDateChange}
          placeholder={t('pages.transfers.dateTo')}
          clearable
        />
      </div>
    </FilterBar>
  );
}
