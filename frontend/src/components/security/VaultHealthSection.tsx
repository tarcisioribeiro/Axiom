import { AlertTriangle, Clock, Copy, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const dashOffset = circumference - filled;

  const color =
    score >= 75
      ? 'hsl(var(--chart-2))'
      : score >= 45
        ? 'hsl(38 92% 50%)'
        : 'hsl(var(--destructive))';

  const label = score >= 75 ? 'Boa' : score >= 45 ? 'Regular' : 'Crítica';

  return (
    <div className="flex flex-col items-center gap-2">
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
        Segurança {label}
      </span>
    </div>
  );
}

// ============================================================================
// Issue Badge
// ============================================================================

const ISSUE_META: Record<
  string,
  { label: string; variant: 'destructive' | 'secondary' | 'outline' }
> = {
  weak: { label: 'Fraca', variant: 'destructive' },
  medium: { label: 'Média', variant: 'secondary' },
  duplicate: { label: 'Duplicada', variant: 'outline' },
  outdated: { label: 'Desatualizada', variant: 'outline' },
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
    <div className="flex flex-col items-center gap-1">
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
  return (
    <div className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{pw.title}</p>
        <p className="truncate text-xs text-muted-foreground">{pw.username}</p>
        {pw.duplicate_group !== null && (
          <p className="text-xs text-muted-foreground">
            Grupo de duplicatas #{pw.duplicate_group}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {pw.issues.map((issue) => {
          const meta = ISSUE_META[issue];
          return (
            <Badge key={issue} variant={meta.variant}>
              {meta.label}
            </Badge>
          );
        })}
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

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    try {
      setIsLoading(true);
      const data = await securityDashboardService.getHealthReport();
      setReport(data);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar relatório de saúde',
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
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Saúde do Cofre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-muted-foreground">Analisando senhas...</span>
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
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Saúde do Cofre
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {total_passwords === 0
            ? 'Nenhuma senha cadastrada'
            : `Análise de ${total_passwords} ${total_passwords === 1 ? 'senha' : 'senhas'}`}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Score + issue counts side by side */}
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-around">
          <CircularScore score={score} />

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-2">
            <IssueCount
              icon={<ShieldAlert className="h-5 w-5" />}
              count={issues_summary.weak}
              label="Fracas"
              color="hsl(var(--destructive))"
            />
            <IssueCount
              icon={<AlertTriangle className="h-5 w-5" />}
              count={issues_summary.duplicate}
              label="Duplicadas"
              color="hsl(38 92% 50%)"
            />
            <IssueCount
              icon={<Copy className="h-5 w-5" />}
              count={issues_summary.medium}
              label="Médias"
              color="hsl(var(--muted-foreground))"
            />
            <IssueCount
              icon={<Clock className="h-5 w-5" />}
              count={issues_summary.outdated}
              label="Desatualizadas"
              color="hsl(var(--muted-foreground))"
            />
          </div>
        </div>

        {/* Problematic passwords list */}
        {hasIssues ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Senhas que precisam de atenção</p>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {problematic_passwords.map((pw) => (
                <PasswordRow key={pw.id} pw={pw} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <ShieldCheck className="text-chart-2 h-10 w-10" />
            <p className="text-sm font-medium">Todas as senhas estão em boa forma!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
