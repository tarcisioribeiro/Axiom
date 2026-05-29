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

  return (
    <FilterBar hasActiveFilters={hasActiveFilters} onClear={onClear}>
      <SearchInput
        placeholder={t('pages.transfers.searchPlaceholder')}
        value={searchTerm}
        onValueChange={onSearchChange}
        className="w-44 flex-none"
      />
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-40">
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
      <div className="flex items-center gap-xs">
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {t('pages.transfers.dateFrom')}
        </span>
        <DatePicker
          value={startDate}
          onChange={onStartDateChange}
          placeholder={t('pages.transfers.dateFrom')}
          clearable
        />
        <span className="whitespace-nowrap text-xs text-muted-foreground">
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
