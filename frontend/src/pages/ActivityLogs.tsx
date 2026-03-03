import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { ScrollText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { activityLogsService } from '@/services/activity-logs-service';
import type { ActivityLog } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const dateFnsLocale: Locale = i18n.language === 'pt-BR' ? ptBR : enUS;

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await activityLogsService.getAll();
      setLogs(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader title={t('pages.activityLogs.title')} icon={<ScrollText />} />

      {logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-12 w-12 text-muted-foreground" />}
          message={t('pages.activityLogs.emptyState')}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pages.activityLogs.columns.dateTime')}</TableHead>
                <TableHead>{t('pages.activityLogs.columns.action')}</TableHead>
                <TableHead>{t('pages.activityLogs.columns.description')}</TableHead>
                <TableHead>{t('pages.activityLogs.columns.ip')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', {
                      locale: dateFnsLocale,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{log.action_display}</Badge>
                  </TableCell>
                  <TableCell>{log.description}</TableCell>
                  <TableCell>{log.ip_address || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
