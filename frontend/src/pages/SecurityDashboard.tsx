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
} from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ChartContainer } from '@/components/charts';
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
import { translate } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { useChartColors, usePasswordStrengthColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { archivesService } from '@/services/archives-service';
import { passwordsService } from '@/services/passwords-service';
import { securityDashboardService } from '@/services/security-dashboard-service';
import { vaultConfigService } from '@/services/security-vault-service';
import { storedAccountsService } from '@/services/stored-accounts-service';
import { storedCardsService } from '@/services/stored-cards-service';
import type {
  Password,
  StoredCreditCard,
  StoredBankAccount,
  Archive as ArchiveType,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type PasswordStrength = 'weak' | 'medium' | 'strong';

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

  const { data: passwords = [] } = useQuery<Password[]>({
    queryKey: ['vault-search', 'passwords'],
    queryFn: () => passwordsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    enabled: true,
  });

  const { data: cards = [] } = useQuery<StoredCreditCard[]>({
    queryKey: ['vault-search', 'cards'],
    queryFn: () => storedCardsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    enabled: true,
  });

  const { data: accounts = [] } = useQuery<StoredBankAccount[]>({
    queryKey: ['vault-search', 'accounts'],
    queryFn: () => storedAccountsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    enabled: true,
  });

  const { data: archives = [] } = useQuery<ArchiveType[]>({
    queryKey: ['vault-search', 'archives'],
    queryFn: () => archivesService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    enabled: true,
  });

  const results = useMemo<SearchResultItem[]>(() => {
    if (!enabled) return [];
    const q = debouncedQuery.toLowerCase();

    const passwordResults: SearchResultItem[] = passwords
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.username.toLowerCase().includes(q) ||
          p.site?.toLowerCase().includes(q)
      )
      .map((p) => ({
        id: p.id,
        type: 'password' as const,
        label: p.title,
        sublabel: p.username,
        route: '/security/passwords',
      }));

    const cardResults: SearchResultItem[] = cards
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.cardholder_name.toLowerCase().includes(q) ||
          c.last_four_digits?.includes(q)
      )
      .map((c) => ({
        id: c.id,
        type: 'card' as const,
        label: c.name,
        sublabel: c.cardholder_name,
        route: '/security/stored-cards',
      }));

    const accountResults: SearchResultItem[] = accounts
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.institution_name.toLowerCase().includes(q) ||
          a.account_number_masked?.includes(q)
      )
      .map((a) => ({
        id: a.id,
        type: 'account' as const,
        label: a.name,
        sublabel: a.institution_name,
        route: '/security/stored-accounts',
      }));

    const archiveResults: SearchResultItem[] = archives
      .filter(
        (a) => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
      )
      .map((a) => ({
        id: a.id,
        type: 'archive' as const,
        label: a.title,
        sublabel: a.category_display,
        route: '/security/archives',
      }));

    return [...passwordResults, ...cardResults, ...accountResults, ...archiveResults];
  }, [debouncedQuery, enabled, passwords, cards, accounts, archives]);

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
          {!hasResults ? (
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [recoveryKeyModal, setRecoveryKeyModal] = useState<'generate' | 'use' | null>(
    null
  );
  const { isCompleted } = useVaultOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Show onboarding wizard on first visit
    if (!isCompleted()) {
      setShowOnboarding(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['securityDashboard'],
    queryFn: () => securityDashboardService.getStats(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const COLORS = useChartColors();
  const strengthColors = usePasswordStrengthColors();

  const ITEM_TYPE_LABELS: Record<string, string> = {
    passwords: t('pages.securityDashboard.passwords'),
    cards: t('pages.securityDashboard.storedCards'),
    accounts: t('pages.securityDashboard.storedAccounts'),
    archives: t('pages.securityDashboard.archives'),
  };

  const translatedItemsDistribution = useMemo(
    () =>
      (stats?.items_distribution || []).map((item) => ({
        ...item,
        type_display: ITEM_TYPE_LABELS[item.type] ?? item.type_display,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats?.items_distribution, t]
  );

  const translatedPasswordsByCategory = useMemo(
    () =>
      (stats?.passwords_by_category || []).map((item) => ({
        ...item,
        category_display: translate('passwordCategories', item.category),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats?.passwords_by_category, t]
  );

  const translatedStrengthDistribution = useMemo(
    () =>
      (stats?.password_strength_distribution || []).map((item) => ({
        ...item,
        strength_display: translate('passwordStrength', item.strength),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats?.password_strength_distribution, t]
  );

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

        {/* Gráficos lado a lado */}
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
          {/* Distribuição de Itens */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.securityDashboard.itemDistribution')}</CardTitle>
              <p className="text-sm">
                {t('pages.securityDashboard.itemDistributionDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="security-items-distribution"
                data={translatedItemsDistribution}
                dataKey="count"
                nameKey="type_display"
                formatter={(value) =>
                  t('pages.securityDashboard.itemCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.securityDashboard.noItems')}
                lockChartType="pie"
                height={300}
              />
            </CardContent>
          </Card>

          {/* Senhas por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.securityDashboard.passwordsByCategory')}</CardTitle>
              <p className="text-sm">
                {t('pages.securityDashboard.passwordsByCategoryDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="security-passwords-category"
                data={translatedPasswordsByCategory}
                dataKey="count"
                nameKey="category_display"
                formatter={(value) =>
                  t('pages.securityDashboard.passwordCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.securityDashboard.noPasswords')}
                lockChartType="pie"
                height={300}
              />
            </CardContent>
          </Card>

          {/* Força das Senhas */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.securityDashboard.securityAnalysis')}</CardTitle>
              <p className="text-sm">
                {t('pages.securityDashboard.securityAnalysisDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="security-password-strength"
                data={translatedStrengthDistribution}
                dataKey="count"
                nameKey="strength_display"
                formatter={(value) =>
                  t('pages.securityDashboard.passwordCount', { count: Number(value) })
                }
                colors={COLORS}
                customColors={(entry) =>
                  strengthColors[(entry as { strength: PasswordStrength }).strength] ||
                  COLORS[0]
                }
                emptyMessage={t('pages.securityDashboard.noPasswords')}
                lockChartType="pie"
                height={300}
              />
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
