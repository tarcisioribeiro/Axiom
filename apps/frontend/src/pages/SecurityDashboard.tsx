/* eslint-disable max-lines */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Key,
  CreditCard,
  Wallet,
  Archive,
  Download,
  Search,
  X,
  Bell,
  Loader2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultHealthSection } from '@/components/security/VaultHealthSection';
import {
  VaultOnboardingWizard,
  useVaultOnboarding,
} from '@/components/security/VaultOnboardingWizard';
import { VaultRecoveryKeyModal } from '@/components/security/VaultRecoveryKeyModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { securityDashboardService } from '@/services/security-dashboard-service';
import { vaultConfigService } from '@/services/security-vault-service';
import { getErrorMessage } from '@/utils/error-utils';

type SearchResultType = 'password' | 'card' | 'account' | 'archive';

interface SearchResultItem {
  id: number;
  type: SearchResultType;
  label: string;
  sublabel: string;
  route: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function VaultSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const enabled = debouncedQuery.trim().length >= 2;

  const { data: searchData, isFetching } = useQuery({
    queryKey: ['vault-search', debouncedQuery],
    queryFn: () => securityDashboardService.globalSearch(debouncedQuery),
    enabled,
    staleTime: 15_000,
  });

  const results = useMemo<SearchResultItem[]>(() => {
    if (!enabled || !searchData) return [];

    const passwordResults: SearchResultItem[] = (searchData.passwords ?? []).map(
      (p) => ({
        id: p.id,
        type: 'password' as const,
        label: p.title,
        sublabel: p.site ?? p.username,
        route: '/security/passwords',
      })
    );

    const cardResults: SearchResultItem[] = (searchData.stored_cards ?? []).map(
      (c) => ({
        id: c.id,
        type: 'card' as const,
        label: c.name,
        sublabel: c.cardholder_name,
        route: '/security/stored-cards',
      })
    );

    const accountResults: SearchResultItem[] = (searchData.stored_accounts ?? []).map(
      (a) => ({
        id: a.id,
        type: 'account' as const,
        label: a.name,
        sublabel: a.institution_name,
        route: '/security/stored-accounts',
      })
    );

    const archiveResults: SearchResultItem[] = (searchData.archives ?? []).map((a) => ({
      id: a.id,
      type: 'archive' as const,
      label: a.title,
      sublabel: a.file_name ?? a.category,
      route: '/security/archives',
    }));

    return [...passwordResults, ...cardResults, ...accountResults, ...archiveResults];
  }, [enabled, searchData]);

  const grouped = useMemo(() => {
    const groups: Record<SearchResultType, SearchResultItem[]> = {
      password: [],
      card: [],
      account: [],
      archive: [],
    };
    for (const r of results) {
      groups[r.type].push(r);
    }
    return groups;
  }, [results]);

  const groupConfig: Array<{
    type: SearchResultType;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      type: 'password',
      label: t('pages.securityDashboard.vaultSearch.groupPasswords'),
      icon: <Key className="h-4 w-4 text-info" />,
    },
    {
      type: 'card',
      label: t('pages.securityDashboard.vaultSearch.groupCards'),
      icon: <CreditCard className="h-4 w-4 text-warning" />,
    },
    {
      type: 'account',
      label: t('pages.securityDashboard.vaultSearch.groupAccounts'),
      icon: <Wallet className="h-4 w-4 text-success" />,
    },
    {
      type: 'archive',
      label: t('pages.securityDashboard.vaultSearch.groupArchives'),
      icon: <Archive className="h-4 w-4 text-accent" />,
    },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: SearchResultItem) => {
    void navigate(item.route);
    setQuery('');
    setIsOpen(false);
  };

  const hasResults = results.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={t('pages.securityDashboard.vaultSearch.placeholder')}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            aria-label={t('common.actions.close')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isOpen && enabled && (
        <div className="absolute left-0 right-0 top-full z-50 mt-xs max-h-96 overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {isFetching ? (
            <div className="flex items-center justify-center gap-sm py-lg">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Buscando...</span>
            </div>
          ) : !hasResults ? (
            <div className="flex flex-col items-center justify-center gap-sm py-lg text-center">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">
                {t('pages.securityDashboard.vaultSearch.noResults')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('pages.securityDashboard.vaultSearch.noResultsDesc')}
              </p>
            </div>
          ) : (
            <div className="py-sm">
              {groupConfig.map(({ type, label, icon }) => {
                const items = grouped[type];
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="flex items-center gap-xs px-md py-xs">
                      {icon}
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </span>
                    </div>
                    {items.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        className="flex w-full items-center gap-sm px-md py-sm text-left transition-colors hover:bg-accent/50"
                        onClick={() => handleSelect(item)}
                        type="button"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.sublabel}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VaultAlertConfigPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: alertConfig, isLoading } = useQuery({
    queryKey: ['vaultAlertConfig'],
    queryFn: () => securityDashboardService.getAlertConfig(),
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-lg">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const rows: {
    field: string;
    label: string;
    desc: string;
    value: boolean;
  }[] = [
    {
      field: 'alert_on_new_ip',
      label: t('pages.securityDashboard.alertOnNewIp'),
      desc: t('pages.securityDashboard.alertOnNewIpDesc'),
      value: alertConfig?.alert_on_new_ip ?? true,
    },
    {
      field: 'alert_on_failed_unlock',
      label: t('pages.securityDashboard.alertOnFailedUnlock'),
      desc: t('pages.securityDashboard.alertOnFailedUnlockDesc'),
      value: alertConfig?.alert_on_failed_unlock ?? true,
    },
    {
      field: 'alert_on_reveal',
      label: t('pages.securityDashboard.alertOnReveal'),
      desc: t('pages.securityDashboard.alertOnRevealDesc'),
      value: alertConfig?.alert_on_reveal ?? false,
    },
    {
      field: 'alert_on_excessive_reveals',
      label: 'Alerta de volume excessivo de revelações',
      desc: `Notifica quando há mais de ${alertConfig?.excessive_reveals_threshold ?? 5} revelações em 1 hora`,
      value: alertConfig?.alert_on_excessive_reveals ?? true,
    },
    {
      field: 'alert_on_card_reveal',
      label: 'Alerta ao revelar cartão bancário',
      desc: 'Notifica sempre que um cartão armazenado é revelado',
      value: alertConfig?.alert_on_card_reveal ?? false,
    },
    {
      field: 'notify_email',
      label: 'Enviar alertas por e-mail',
      desc: 'Envia cópia das notificações de segurança para seu e-mail',
      value: alertConfig?.notify_email ?? false,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-sm text-base">
          <Bell className="h-4 w-4" />
          {t('pages.securityDashboard.alertConfig')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-sm">
        {rows.map(({ field, label, desc, value }) => (
          <div key={field} className="flex items-start justify-between gap-md">
            <div className="min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={value}
              disabled={mutation.isPending}
              onClick={() => toggle(field, !value)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                value ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  value ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SecurityDashboard() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [recoveryKeyModal, setRecoveryKeyModal] = useState<'generate' | 'use' | null>(
    null
  );
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
        description: t('pages.securityDashboard.exportVaultSuccessDesc'),
      });
    } catch (err) {
      toast({
        title: t('pages.securityDashboard.exportVaultError'),
        description: getErrorMessage(err),
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
    <VaultGuard>
      <PageContainer>
        <div className="flex items-center justify-between">
          <PageHeader title={t('pages.securityDashboard.title')} icon={<Shield />} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecoveryKeyModal('generate')}
            className="gap-sm"
          >
            <Key className="h-4 w-4" />
            {t('userProfile.security.recoveryKey.menuBtn')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={() => void handleExport()}
            className="gap-sm"
          >
            <Download className="h-4 w-4" />
            {isExporting
              ? t('common.actions.loading')
              : t('pages.securityDashboard.exportVault')}
          </Button>
        </div>

        <VaultSearch />

        {/* Métricas + Saúde do Cofre */}
        <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
          {/* Card único com as 4 métricas */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-sm">
              <CardTitle className="text-sm font-medium">
                {t('pages.securityDashboard.vaultItems')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <div className="rounded-lg bg-info/10 p-sm ring-1 ring-info/20">
                      <Key className="h-4 w-4 text-info" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('pages.securityDashboard.passwords')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-info">
                    {stats?.total_passwords || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <div className="rounded-lg bg-warning/10 p-sm ring-1 ring-warning/20">
                      <CreditCard className="h-4 w-4 text-warning" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('pages.securityDashboard.storedCards')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-warning">
                    {stats?.total_stored_cards || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
                      <Wallet className="h-4 w-4 text-success" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('pages.securityDashboard.storedAccounts')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-success">
                    {stats?.total_stored_accounts || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <div className="rounded-lg bg-accent/10 p-sm ring-1 ring-accent/20">
                      <Archive className="h-4 w-4 text-accent" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('pages.securityDashboard.archives')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-accent">
                    {stats?.total_archives || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saúde do Cofre */}
          <VaultHealthSection />
        </div>

        {/* Atividade Recente + Ações Rápidas */}
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
          {/* Feed de Atividade Recente */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {t('pages.securityDashboard.vaultHub.recentActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.recent_activity?.length ? (
                <p className="py-md text-center text-sm text-muted-foreground">
                  {t('pages.securityDashboard.noRecentActivity')}
                </p>
              ) : (
                <div className="flex flex-col divide-y">
                  {stats.recent_activity.slice(0, 8).map((entry, i) => (
                    <div key={i} className="flex items-start gap-sm py-sm">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString(i18n.language, {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-muted/60 px-xs py-0.5 text-xs text-muted-foreground">
                        {entry.action_display}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-sm">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                {t('pages.securityDashboard.vaultHub.quickActions')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-sm">
                {(
                  [
                    {
                      label: t('pages.securityDashboard.passwords'),
                      count: stats?.total_passwords ?? 0,
                      icon: Key,
                      route: '/security/passwords',
                      colorClass: 'text-info',
                    },
                    {
                      label: t('pages.securityDashboard.storedCards'),
                      count: stats?.total_stored_cards ?? 0,
                      icon: CreditCard,
                      route: '/security/stored-cards',
                      colorClass: 'text-warning',
                    },
                    {
                      label: t('pages.securityDashboard.storedAccounts'),
                      count: stats?.total_stored_accounts ?? 0,
                      icon: Wallet,
                      route: '/security/stored-accounts',
                      colorClass: 'text-success',
                    },
                    {
                      label: t('pages.securityDashboard.archives'),
                      count: stats?.total_archives ?? 0,
                      icon: Archive,
                      route: '/security/archives',
                      colorClass: 'text-accent',
                    },
                  ] as const
                ).map(({ label, count, icon: Icon, route, colorClass }) => (
                  <button
                    key={route}
                    type="button"
                    onClick={() => void navigate(route)}
                    className="flex items-center gap-sm rounded-lg border bg-card p-sm text-left transition-colors hover:bg-accent/10"
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${colorClass}`} />
                    <span className="flex-1 text-sm">{label}</span>
                    <span className={`text-sm font-bold ${colorClass}`}>{count}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alert Config (#209) */}
        <VaultAlertConfigPanel />
      </PageContainer>

      {recoveryKeyModal && (
        <VaultRecoveryKeyModal
          open={true}
          onOpenChange={(v) => {
            if (!v) setRecoveryKeyModal(null);
          }}
          mode={recoveryKeyModal}
        />
      )}
      <VaultOnboardingWizard
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </VaultGuard>
  );
}
