/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  securityDashboardService,
  type VaultHealthPassword,
  type VaultHealthReport,
  type VaultHealthSnapshot,
} from '@/services/security-dashboard-service';

// ============================================================================
// Circular Score Indicator
// ============================================================================

interface CircularScoreProps {
  score: number;
}

function CircularScore({ score }: CircularScoreProps) {
  const { t } = useTranslation();
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const dashOffset = circumference - filled;

  const color =
    score >= 75
      ? 'hsl(var(--chart-2))'
      : score >= 45
        ? 'hsl(var(--warning))'
        : 'hsl(var(--destructive))';

  const levelKey = score >= 75 ? 'good' : score >= 45 ? 'fair' : 'critical';
  const label = t(`pages.vaultHealth.levels.${levelKey}`);

  return (
    <div className="flex flex-col items-center gap-sm">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="12"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="70"
          y="65"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="28"
          fontWeight="700"
          fill="currentColor"
        >
          {score}
        </text>
        <text
          x="70"
          y="87"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fill="hsl(var(--muted-foreground))"
        >
          / 100
        </text>
      </svg>
      <span className="text-sm font-medium" style={{ color }}>
        {t('pages.vaultHealth.securityLevel', { level: label })}
      </span>
    </div>
  );
}

// ============================================================================
// Issue count card
// ============================================================================

interface IssueCountProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  color: string;
  severity: 'critical' | 'warning' | 'info';
}

function IssueCount({ icon, count, label, color, severity }: IssueCountProps) {
  const bgMap = {
    critical: 'bg-destructive/10',
    warning: 'bg-warning/10',
    info: 'bg-muted',
  };
  return (
    <div className="flex flex-col items-center gap-xs rounded-lg border p-3">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full ${bgMap[severity]}`}
        style={{ color }}
      >
        {icon}
      </div>
      <span className="text-xl font-bold">{count}</span>
      <span className="text-center text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ============================================================================
// Problematic password row with CTA
// ============================================================================

interface PasswordRowProps {
  pw: VaultHealthPassword;
  onNavigate: (id: number) => void;
}

function PasswordRow({ pw, onNavigate }: PasswordRowProps) {
  const { t } = useTranslation();
  const severityVariant: Record<string, 'destructive' | 'secondary' | 'outline'> = {
    weak: 'destructive',
    medium: 'secondary',
    duplicate: 'outline',
    outdated: 'outline',
  };
  const hasCritical = pw.issues.includes('weak');

  return (
    <div
      className={`flex flex-col gap-xs rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${hasCritical ? 'border-destructive/30 bg-destructive/5' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{pw.title}</p>
        <p className="truncate text-xs text-muted-foreground">{pw.username}</p>
      </div>
      <div className="flex flex-wrap items-center gap-xs">
        {pw.issues.map((issue) => (
          <Badge key={issue} variant={severityVariant[issue] ?? 'outline'}>
            {t(`pages.vaultHealth.issues.${issue}`, { defaultValue: issue })}
          </Badge>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-xs text-xs"
          onClick={() => onNavigate(pw.id)}
        >
          {t('common.update', { defaultValue: 'Atualizar' })}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Score History Chart
// ============================================================================

function ScoreHistoryChart({ data }: { data: VaultHealthSnapshot[] }) {
  const { t } = useTranslation();
  if (!data.length) return null;

  const chartData = [...data].reverse().map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
    score: s.score,
  }));

  return (
    <div className="space-y-sm">
      <div className="flex items-center gap-sm">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">
          {t('pages.vaultHealth.scoreHistory', { defaultValue: 'Evolução do Score' })}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(v: number) => [v, 'Score']}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            fill="url(#scoreGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// VaultHealthSection (redesigned — #198)
// ============================================================================

export function VaultHealthSection() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: report, isLoading: loadingReport } = useQuery<VaultHealthReport>({
    queryKey: ['vault-health-report'],
    queryFn: () => securityDashboardService.getHealthReport(),
    staleTime: 300_000,
  });

  const { data: history = [] } = useQuery<VaultHealthSnapshot[]>({
    queryKey: ['vault-health-history'],
    queryFn: () => securityDashboardService.getVaultHealthHistory(),
    staleTime: 300_000,
  });

  if (loadingReport) {
    return (
      <div className="space-y-md">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!report) return null;

  const { score, total_passwords, issues_summary, problematic_passwords } = report;
  const criticalPasswords = problematic_passwords.filter((p) =>
    p.issues.includes('weak')
  );
  const otherIssues = problematic_passwords.filter((p) => !p.issues.includes('weak'));

  return (
    <div className="space-y-md">
      {/* Section 1 — Score header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-sm">
            <ShieldCheck className="h-5 w-5" />
            {t('pages.vaultHealth.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {total_passwords === 0
              ? t('pages.vaultHealth.noPasswords')
              : t('pages.vaultHealth.analysisOf', { count: total_passwords })}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-lg sm:flex-row sm:items-start sm:justify-around">
            <CircularScore score={score} />
            <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
              <IssueCount
                icon={<ShieldAlert className="h-5 w-5" />}
                count={issues_summary.weak}
                label={t('pages.vaultHealth.issueCounts.weak')}
                color="hsl(var(--destructive))"
                severity="critical"
              />
              <IssueCount
                icon={<AlertTriangle className="h-5 w-5" />}
                count={issues_summary.duplicate}
                label={t('pages.vaultHealth.issueCounts.duplicate')}
                color="hsl(var(--warning))"
                severity="warning"
              />
              <IssueCount
                icon={<Copy className="h-5 w-5" />}
                count={issues_summary.medium}
                label={t('pages.vaultHealth.issueCounts.medium')}
                color="hsl(var(--muted-foreground))"
                severity="info"
              />
              <IssueCount
                icon={<Clock className="h-5 w-5" />}
                count={issues_summary.outdated}
                label={t('pages.vaultHealth.issueCounts.outdated')}
                color="hsl(var(--muted-foreground))"
                severity="info"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Critical issues */}
      {criticalPasswords.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-base text-destructive">
              <ShieldAlert className="h-4 w-4" />
              {t('pages.vaultHealth.criticalIssues', {
                defaultValue: 'Senhas Críticas',
              })}
              <Badge variant="destructive" className="ml-auto">
                {criticalPasswords.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 space-y-sm overflow-y-auto pr-xs">
              {criticalPasswords.map((pw) => (
                <PasswordRow
                  key={pw.id}
                  pw={pw}
                  onNavigate={() => navigate('/security/passwords')}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 3 — Other issues */}
      {otherIssues.length > 0 && (
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {t('pages.vaultHealth.needsAttention')}
              <Badge variant="secondary" className="ml-auto">
                {otherIssues.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 space-y-sm overflow-y-auto pr-xs">
              {otherIssues.map((pw) => (
                <PasswordRow
                  key={pw.id}
                  pw={pw}
                  onNavigate={() => navigate('/security/passwords')}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4 — All good */}
      {problematic_passwords.length === 0 && total_passwords > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-sm py-lg">
            <CheckCircle2 className="text-chart-2 h-10 w-10" />
            <p className="text-sm font-medium">{t('pages.vaultHealth.allGood')}</p>
          </CardContent>
        </Card>
      )}

      {/* Section 5 — Score history chart */}
      {history.length > 1 && (
        <Card>
          <CardHeader className="pb-sm">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t('pages.vaultHealth.scoreHistory', {
                  defaultValue: 'Evolução do Score',
                })}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-xs text-xs"
                onClick={() => navigate('/security/health')}
              >
                <RefreshCw className="h-3 w-3" />
                {t('common.refresh', { defaultValue: 'Atualizar' })}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScoreHistoryChart data={history} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
