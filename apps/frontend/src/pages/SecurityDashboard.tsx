/* eslint-disable max-lines */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  Bell,
  Clock,
  CreditCard,
  Download,
  Eye,
  Globe,
  Key,
  Mail,
  ScrollText,
  Shield,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { StatCard } from '@/components/common/StatCard';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultHealthSection } from '@/components/security/VaultHealthSection';
import {
  VaultOnboardingWizard,
  useVaultOnboarding,
} from '@/components/security/VaultOnboardingWizard';
import { VaultRecoveryKeyModal } from '@/components/security/VaultRecoveryKeyModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { securityDashboardService } from '@/services/security-dashboard-service';
import { vaultConfigService } from '@/services/security-vault-service';
import { getErrorMessage } from '@/utils/error-utils';

function VaultAlertConfigDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: alertConfig, isLoading } = useQuery({
    queryKey: ['vaultAlertConfig'],
    queryFn: () => securityDashboardService.getAlertConfig(),
    enabled: open,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const mutation = useMutation({
    mutationFn: (
      data: Parameters<typeof securityDashboardService.updateAlertConfig>[0]
    ) => securityDashboardService.updateAlertConfig(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vaultAlertConfig'] });
      toast({
        title: t('pages.securityDashboard.alertConfigSaved'),
      });
    },
    onError: () => {
      toast({
        title: t('common.messages.saveError'),
        variant: 'destructive',
      });
    },
  });

  const toggle = (field: string, value: boolean) => {
    if (!alertConfig) return;
    mutation.mutate({ ...alertConfig, [field]: value });
  };

  const rows = [
    { field: 'alert_on_new_ip', icon: Globe, key: 'alertOnNewIp', fallback: true },
    {
      field: 'alert_on_failed_unlock',
      icon: ShieldAlert,
      key: 'alertOnFailedUnlock',
      fallback: true,
    },
    { field: 'alert_on_reveal', icon: Eye, key: 'alertOnReveal', fallback: false },
    {
      field: 'alert_on_excessive_reveals',
      icon: Activity,
      key: 'alertOnExcessiveReveals',
      fallback: true,
    },
    {
      field: 'alert_on_card_reveal',
      icon: CreditCard,
      key: 'alertOnCardReveal',
      fallback: false,
    },
    { field: 'notify_email', icon: Mail, key: 'notifyEmail', fallback: false },
  ] as const;

  // Cada alteração é salva na hora; o modal só abre com a configuração carregada.
  return (
    <Dialog open={open && !isLoading} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle icon={Bell}>
            {t('pages.securityDashboard.alertConfig')}
          </DialogTitle>
          <DialogDescription>
            {t('pages.securityDashboard.alertConfig')}
          </DialogDescription>
        </DialogHeader>
        <div className="gap-md grid sm:grid-cols-2">
          {rows.map(({ field, icon: Icon, key, fallback }) => (
            <div key={field} className="gap-sm flex items-center">
              <Checkbox
                id={field}
                checked={alertConfig?.[field] ?? fallback}
                disabled={mutation.isPending}
                onCheckedChange={(v) => toggle(field, v === true)}
              />
              <Label
                htmlFor={field}
                className="gap-xs flex cursor-pointer items-center"
              >
                <Icon className="text-muted-foreground h-3.5 w-3.5" />
                {t(`pages.securityDashboard.${key}`)}
              </Label>
            </div>
          ))}
        </div>
        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}

function SecurityDashboardContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isRecoveryKeyOpen, setIsRecoveryKeyOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const { isCompleted } = useVaultOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Mostra o assistente de onboarding na primeira visita (checagem única,
  // derivada durante o render — sem efeito).
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  if (!hasCheckedOnboarding) {
    setHasCheckedOnboarding(true);
    if (!isCompleted()) {
      setShowOnboarding(true);
    }
  }

  const { data: stats, isLoading } = useQuery({
    queryKey: ['securityDashboard'],
    queryFn: () => securityDashboardService.getStats(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await vaultConfigService.exportVaultZip();
      toast({
        title: t('pages.securityDashboard.exportVaultSuccess'),
      });
    } catch (err) {
      toast({
        title: t('pages.securityDashboard.exportVaultError', {
          reason: getErrorMessage(err),
        }),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <>
      <PageContainer>
        <PageHeader title={t('pages.securityDashboard.title')} icon={<Shield />}>
          <div className="gap-sm flex items-center">
            <Button variant="outline" onClick={() => setIsAlertsOpen(true)}>
              <Bell className="h-4 w-4" />
              {t('pages.securityDashboard.alerts')}
            </Button>
            <Button variant="outline" onClick={() => setIsRecoveryKeyOpen(true)}>
              <Key className="h-4 w-4" />
              {t('userProfile.security.recoveryKey.menuBtn')}
            </Button>
            <Button
              variant="outline"
              loading={isExporting}
              onClick={() => void handleExport()}
            >
              {!isExporting && <Download className="h-4 w-4" />}
              {t('pages.securityDashboard.exportVault')}
            </Button>
          </div>
        </PageHeader>

        {/* Itens do Cofre */}
        <div className="gap-md grid grid-cols-2 lg:grid-cols-4">
          <StatCard
            centered
            title={t('pages.securityDashboard.passwords')}
            value={stats?.total_passwords || 0}
            icon={<Key className="h-4 w-4" />}
            accentColor="blue"
            onClick={() => void navigate('/security/passwords')}
          />
          <StatCard
            centered
            title={t('pages.securityDashboard.storedCards')}
            value={stats?.total_stored_cards || 0}
            icon={<CreditCard className="h-4 w-4" />}
            accentColor="orange"
            onClick={() => void navigate('/security/stored-cards')}
          />
          <StatCard
            centered
            title={t('pages.securityDashboard.storedAccounts')}
            value={stats?.total_stored_accounts || 0}
            icon={<Wallet className="h-4 w-4" />}
            accentColor="green"
            onClick={() => void navigate('/security/stored-accounts')}
          />
          <StatCard
            centered
            title={t('pages.securityDashboard.archives')}
            value={stats?.total_archives || 0}
            icon={<Archive className="h-4 w-4" />}
            accentColor="purple"
            onClick={() => void navigate('/security/archives')}
          />
        </div>

        {/* Saúde do Cofre + Atenção + Evolução do Score + Atividade Recente */}
        <VaultHealthSection>
          <Card className="flex flex-col">
            <CardHeader className="pb-sm">
              <CardTitle className="gap-sm flex items-center text-base">
                <Clock className="text-muted-foreground h-4 w-4" />
                {t('pages.securityDashboard.vaultHub.recentActivity')}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7"
                  onClick={() => void navigate('/security/activity-logs')}
                  aria-label={t('pages.activityLogs.title')}
                >
                  <ScrollText className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.recent_activity?.length ? (
                <EmptyState title={t('pages.securityDashboard.noRecentActivity')} />
              ) : (
                <PaginatedSlide
                  items={stats.recent_activity}
                  pageSize={LIST_PAGE_SIZE}
                  pinNav={false}
                  className="flex flex-col divide-y"
                >
                  {(pageItems) =>
                    pageItems.map((entry) => (
                      <div
                        key={`${entry.created_at}-${entry.description}`}
                        className="gap-sm py-sm flex items-center"
                      >
                        <Shield className="text-muted-foreground h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm" title={entry.description}>
                            {entry.description}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {formatDate(entry.created_at, 'dd/MM/yyyy HH:mm')}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {entry.action_display}
                        </Badge>
                      </div>
                    ))
                  }
                </PaginatedSlide>
              )}
            </CardContent>
          </Card>
        </VaultHealthSection>
      </PageContainer>

      <VaultAlertConfigDialog open={isAlertsOpen} onOpenChange={setIsAlertsOpen} />

      <VaultRecoveryKeyModal
        open={isRecoveryKeyOpen}
        onOpenChange={setIsRecoveryKeyOpen}
      />
      <VaultOnboardingWizard
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </>
  );
}

// Os dados do cofre só são buscados depois do desbloqueio (o conteúdo monta dentro do guard).
export default function SecurityDashboard() {
  return (
    <VaultGuard>
      <SecurityDashboardContent />
    </VaultGuard>
  );
}
