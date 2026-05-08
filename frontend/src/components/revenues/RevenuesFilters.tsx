import { Filter, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TRANSLATIONS, translate } from '@/config/constants';
import { formatCurrency } from '@/lib/formatters';
import type { Account } from '@/types';

interface RevenuesFiltersProps {
  accounts: Account[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  startDate: Date | undefined;
  setStartDate: (d: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (d: Date | undefined) => void;
  selectedAccounts: number[];
  toggleAccount: (id: number) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  totalRevenues: number;
  count: number;
}

export function RevenuesFilters({
  accounts,
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedAccounts,
  toggleAccount,
  hasActiveFilters,
  clearFilters,
  totalRevenues,
  count,
}: RevenuesFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-semibold">{t('common.actions.filter')}</span>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t('common.actions.clearFilters')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder={t('pages.revenues.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.revenues.allCategories')}</SelectItem>
            {Object.keys(TRANSLATIONS.revenueCategories).map((k) => (
              <SelectItem key={k} value={k}>
                {translate('revenueCategories', k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.revenues.allStatus')}</SelectItem>
            <SelectItem value="received">Recebido</SelectItem>
            <SelectItem value="pending">{t('common.status.pending')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <span className="text-sm">{t('pages.revenues.dateFrom')}</span>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="De..."
            clearable
          />
        </div>
        <div className="space-y-1">
          <span className="text-sm">{t('pages.revenues.dateTo')}</span>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="Até..."
            clearable
          />
        </div>
        <div className="space-y-1">
          <span className="text-sm">{t('common.fields.account')}</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {selectedAccounts.length === 0
                  ? t('pages.revenues.allAccounts')
                  : t('pages.revenues.selectedAccounts', {
                      count: selectedAccounts.length,
                    })}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-2">
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {accounts.map((account) => (
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                  <div
                    key={account.id}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-accent"
                    onClick={() => toggleAccount(account.id)}
                  >
                    <Checkbox
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={() => toggleAccount(account.id)}
                    />
                    <span className="text-sm">{account.account_name}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-sm">{t('pages.revenues.foundRevenues', { count })}</span>
        <span className="text-lg font-bold text-success">
          {t('pages.revenues.total')} {formatCurrency(totalRevenues)}
        </span>
      </div>
    </div>
  );
}
