/* eslint-disable max-lines */
import {
  ShieldCheckIcon as Shield,
  KeyIcon as Key,
  CreditCardIcon as CreditCard,
  WalletIcon as Wallet,
  ArchiveBoxIcon as Archive,
  ArrowDownTrayIcon as Download,
  MagnifyingGlassIcon as Search,
  XMarkIcon as X,
  BellIcon as Bell,
  ArrowPathIcon as Loader2,
  ClockIcon as Clock,
  ArrowRightIcon as ArrowRight,
} from '@heroicons/react/24/solid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
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
      icon: <Key className="text-info h-4 w-4" />,
    },
    {
      type: 'card',
      label: t('pages.securityDashboard.vaultSearch.groupCards'),
      icon: <CreditCard className="text-warning h-4 w-4" />,
    },
    {
      type: 'account',
      label: t('pages.securityDashboard.vaultSearch.groupAccounts'),
      icon: <Wallet className="text-success h-4 w-4" />,
    },
    {
      type: 'archive',
      label: t('pages.securityDashboard.vaultSearch.groupArchives'),
      icon: <Archive className="text-accent h-4 w-4" />,
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
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={t('pages.securityDashboard.vaultSearch.placeholder')}
          className="pr-10 pl-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
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
        <div className="mt-xs bg-popover absolute top-full right-0 left-0 z-50 max-h-96 overflow-y-auto rounded-lg border shadow-lg">
          {isFetching ? (
            <div className="gap-sm py-lg flex items-center justify-center">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              <span className="text-muted-foreground text-sm">Buscando...</span>
            </div>
          ) : !hasResults ? (
            <div className="gap-sm py-lg flex flex-col items-center justify-center text-center">
              <Search className="text-muted-foreground/40 h-8 w-8" />
              <p className="text-sm font-medium">
                {t('pages.securityDashboard.vaultSearch.noResults')}
              </p>
              <p className="text-muted-foreground text-xs">
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
                    <div className="gap-xs px-md py-xs flex items-center">
                      {icon}
                      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        {label}
                      </span>
                    </div>
                    {items.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        className="gap-sm px-md py-sm hover:bg-accent/50 flex w-full items-center text-left transition-colors"
                        onClick={() => handleSelect(item)}
                        type="button"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.label}</p>
                          <p className="text-muted-foreground truncate text-xs">
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
        <CardContent className="py-lg flex items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
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
        <CardTitle className="gap-sm flex items-center text-base">
          <Bell className="h-4 w-4" />
          {t('pages.securityDashboard.alertConfig')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-sm">
        {rows.map(({ field, label, desc, value }) => (
          <div key={field} className="gap-md flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-muted-foreground text-xs">{desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={value}
              disabled={mutation.isPending}
              onClick={() => toggle(field, !value)}
              className={`focus-visible:ring-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
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

        {/* Itens do Cofre */}
        <div className="gap-md grid grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t('pages.securityDashboard.passwords')}
            value={stats?.total_passwords || 0}
            icon={<Key className="h-4 w-4" />}
            accentColor="blue"
            onClick={() => void navigate('/security/passwords')}
          />
          <StatCard
            title={t('pages.securityDashboard.storedCards')}
            value={stats?.total_stored_cards || 0}
            icon={<CreditCard className="h-4 w-4" />}
            accentColor="orange"
            onClick={() => void navigate('/security/stored-cards')}
          />
          <StatCard
            title={t('pages.securityDashboard.storedAccounts')}
            value={stats?.total_stored_accounts || 0}
            icon={<Wallet className="h-4 w-4" />}
            accentColor="green"
            onClick={() => void navigate('/security/stored-accounts')}
          />
          <StatCard
            title={t('pages.securityDashboard.archives')}
            value={stats?.total_archives || 0}
            icon={<Archive className="h-4 w-4" />}
            accentColor="purple"
            onClick={() => void navigate('/security/archives')}
          />
        </div>

        {/* Saúde do Cofre + Senhas que precisam de atenção + Evolução do Score */}
        <VaultHealthSection />

        {/* Atividade Recente + Ações Rápidas */}
        <div className="gap-lg grid grid-cols-1 lg:grid-cols-3">
          {/* Feed de Atividade Recente */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="gap-sm flex items-center">
                <Clock className="text-muted-foreground h-4 w-4" />
                {t('pages.securityDashboard.vaultHub.recentActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.recent_activity?.length ? (
                <p className="py-md text-muted-foreground text-center text-sm">
                  {t('pages.securityDashboard.noRecentActivity')}
                </p>
              ) : (
                <div className="flex flex-col divide-y">
                  {stats.recent_activity.slice(0, 8).map((entry, i) => (
                    <div key={i} className="gap-sm py-sm flex items-start">
                      <div className="bg-muted mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                        <Shield className="text-muted-foreground h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{entry.description}</p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(entry.created_at).toLocaleString(i18n.language, {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="bg-muted/60 px-xs text-muted-foreground shrink-0 rounded-md py-0.5 text-xs">
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
              <CardTitle className="gap-sm flex items-center">
                <ArrowRight className="text-muted-foreground h-4 w-4" />
                {t('pages.securityDashboard.vaultHub.quickActions')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="gap-sm flex flex-col">
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
                    className="gap-sm bg-card p-sm hover:bg-accent/10 flex items-center rounded-lg border text-left transition-colors"
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${colorClass}`} />
                    <span className="flex-1 text-sm">{label}</span>
                    <span className={`text-sm font-bold ${colorClass}`}>{count}</span>
                    <ArrowRight className="text-muted-foreground h-3.5 w-3.5" />
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
