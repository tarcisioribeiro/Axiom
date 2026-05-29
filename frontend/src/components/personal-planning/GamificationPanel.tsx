import { useQuery } from '@tanstack/react-query';
import { Award, Flame, Medal, Star, TrendingUp, Zap } from 'lucide-react';

import { LoadingState } from '@/components/common/LoadingState';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getIconByName } from '@/components/ui/icon-picker';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/services/api-client';

interface GamificationData {
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  tasks_completed_total: number;
  xp_next_level: number;
  xp_in_level: number;
  xp_needed_for_next_level: number;
  level_progress_pct: number;
  badges: {
    slug: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    earned_at: string;
  }[];
  recent_xp: {
    amount: number;
    event: string;
    description: string;
    total_after: number;
    created_at: string;
  }[];
}

export function GamificationPanel() {
  const { data, isLoading } = useQuery<GamificationData>({
    queryKey: ['gamification-profile'],
    queryFn: () =>
      apiClient.get<GamificationData>('/api/v1/personal-planning/gamification/'),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingState />;
  if (!data) return null;

  const levelColors = [
    'bg-slate-400',
    'bg-green-500',
    'bg-blue-500',
    'bg-violet-500',
    'bg-amber-500',
  ];
  const levelColor =
    levelColors[Math.min(Math.floor(data.current_level / 5), levelColors.length - 1)];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Nível"
          value={`Nível ${data.current_level}`}
          icon={<Star className="h-4 w-4" />}
          description={`${data.total_xp} XP total`}
        />
        <StatCard
          title="Sequência atual"
          value={`${data.current_streak} dias`}
          icon={<Flame className="h-4 w-4 text-orange-500" />}
          description={`Recorde: ${data.longest_streak} dias`}
        />
        <StatCard
          title="Tarefas concluídas"
          value={data.tasks_completed_total}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          description="Total histórico"
        />
        <StatCard
          title="Badges"
          value={data.badges.length}
          icon={<Award className="h-4 w-4 text-amber-500" />}
          description="Conquistados"
        />
      </div>

      {/* Level progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div
              className={`h-6 w-6 rounded-full ${levelColor} flex items-center justify-center text-xs font-bold text-white`}
            >
              {data.current_level}
            </div>
            Progresso para o Nível {data.current_level + 1}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={data.level_progress_pct} className="h-3" />
          <p className="mt-1 text-xs text-muted-foreground">
            {data.xp_in_level} / {data.xp_needed_for_next_level} XP (
            {data.level_progress_pct}%)
          </p>
        </CardContent>
      </Card>

      {/* Badges */}
      {data.badges.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Badges Conquistados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.badges.map((b) => (
                <div
                  key={b.slug}
                  title={`${b.name}: ${b.description}\n${new Date(b.earned_at).toLocaleDateString('pt-BR')}`}
                  className="flex cursor-default items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-sm"
                >
                  {(() => {
                    const BadgeIcon = getIconByName(b.icon) ?? Medal;
                    return <BadgeIcon className="h-4 w-4 text-yellow-500" />;
                  })()}
                  <span>{b.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent XP */}
      {data.recent_xp.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-yellow-500" />
              Últimos XP Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recent_xp.map((tx, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {tx.description || tx.event}
                  </span>
                  <Badge variant="outline" className="border-green-200 text-green-600">
                    +{tx.amount} XP
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
