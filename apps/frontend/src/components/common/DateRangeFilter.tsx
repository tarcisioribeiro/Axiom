import { ArrowRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { DatePicker } from '@/components/ui/date-picker';

interface DateRangeFilterProps {
  startDate?: Date | string;
  endDate?: Date | string;
  onStartChange: (date: Date | undefined) => void;
  onEndChange: (date: Date | undefined) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}) => {
  const { t } = useTranslation();
  return (
    <div className="gap-xs flex items-center">
      <DatePicker
        value={startDate}
        onChange={onStartChange}
        placeholder={t('common.actions.filters.fromDate')}
        clearable
      />
      <ArrowRight
        className="text-muted-foreground/40 h-3 w-3 shrink-0"
        aria-hidden="true"
      />
      <DatePicker
        value={endDate}
        onChange={onEndChange}
        placeholder={t('common.actions.filters.toDate')}
        clearable
      />
    </div>
  );
};
