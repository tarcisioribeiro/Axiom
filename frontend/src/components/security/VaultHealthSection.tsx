import { AlertTriangle, Clock, Copy, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  securityDashboardService,
  type VaultHealthPassword,
  type VaultHealthReport,
} from '@/services/security-dashboard-service';
import { getErrorMessage } from '@/utils/error-utils';

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
        {/* Track */}
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="12"
        />
        {/* Progress */}
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
        {/* Score text */}
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
// Issue Badge
// ============================================================================

const ISSUE_VARIANTS: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  weak: 'destructive',
  medium: 'secondary',
  duplicate: 'outline',
  outdated: 'outline',
};

// ============================================================================
// Issues Summary Row
// ============================================================================

interface IssueCountProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  color: string;
}

function IssueCount({ icon, count, label, color }: IssueCountProps) {
  return (
    <div className="flex flex-col items-center gap-xs">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
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
// Problematic Password Row
// ============================================================================

interface PasswordRowProps {
  pw: VaultHealthPassword;
}

function PasswordRow({ pw }: PasswordRowProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-xs rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{pw.title}</p>
        <p className="truncate text-xs text-muted-foreground">{pw.username}</p>
        {pw.duplicate_group !== null && (
          <p className="text-xs text-muted-foreground">
            {t('pages.vaultHealth.duplicateGroup', { group: pw.duplicate_group })}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-xs">
        {pw.issues.map((issue) => (
          <Badge key={issue} variant={ISSUE_VARIANTS[issue] ?? 'outline'}>
            {t(`pages.vaultHealth.issues.${issue}`, { defaultValue: issue })}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// VaultHealthSection
// ============================================================================

export function VaultHealthSection() {
  const [report, setReport] = useState<VaultHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      setIsLoading(true);
      const data = await securityDashboardService.getHealthReport();
      setReport(data);
    } catch (error: unknown) {
      toast({
        title: t('pages.vaultHealth.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-sm">
            <ShieldCheck className="h-5 w-5" />
            {t('pages.vaultHealth.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-muted-foreground">
              {t('pages.vaultHealth.analyzing')}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) return null;

  const { score, total_passwords, issues_summary, problematic_passwords } = report;
  const hasIssues = problematic_passwords.length > 0;

  return (
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

      <CardContent className="space-y-lg">
        {/* Score + issue counts side by side */}
        <div className="flex flex-col items-center gap-lg sm:flex-row sm:items-start sm:justify-around">
          <CircularScore score={score} />

          <div className="grid grid-cols-2 gap-lg sm:grid-cols-2">
            <IssueCount
              icon={<ShieldAlert className="h-5 w-5" />}
              count={issues_summary.weak}
              label={t('pages.vaultHealth.issueCounts.weak')}
              color="hsl(var(--destructive))"
            />
            <IssueCount
              icon={<AlertTriangle className="h-5 w-5" />}
              count={issues_summary.duplicate}
              label={t('pages.vaultHealth.issueCounts.duplicate')}
              color="hsl(var(--warning))"
            />
            <IssueCount
              icon={<Copy className="h-5 w-5" />}
              count={issues_summary.medium}
              label={t('pages.vaultHealth.issueCounts.medium')}
              color="hsl(var(--muted-foreground))"
            />
            <IssueCount
              icon={<Clock className="h-5 w-5" />}
              count={issues_summary.outdated}
              label={t('pages.vaultHealth.issueCounts.outdated')}
              color="hsl(var(--muted-foreground))"
            />
          </div>
        </div>

        {/* Problematic passwords list */}
        {hasIssues ? (
          <div className="space-y-sm">
            <p className="text-sm font-medium">
              {t('pages.vaultHealth.needsAttention')}
            </p>
            <div className="max-h-72 space-y-sm overflow-y-auto pr-xs">
              {problematic_passwords.map((pw) => (
                <PasswordRow key={pw.id} pw={pw} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-sm py-md">
            <ShieldCheck className="text-chart-2 h-10 w-10" />
            <p className="text-sm font-medium">{t('pages.vaultHealth.allGood')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
