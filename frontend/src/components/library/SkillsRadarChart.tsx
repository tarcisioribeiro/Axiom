import { useTranslation } from 'react-i18next';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IntellectCategory, Skill } from '@/types';

interface SkillsRadarChartProps {
  skills: Skill[];
}

const CATEGORY_ORDER: IntellectCategory[] = [
  'technology',
  'languages',
  'design',
  'business',
  'science',
  'arts',
  'other',
];

function aggregateByCategory(
  skills: Skill[]
): { category: string; level: number; label: string }[] {
  const map = new Map<string, { total: number; count: number; label: string }>();

  for (const skill of skills) {
    const existing = map.get(skill.category);
    if (existing) {
      existing.total += skill.proficiency_level;
      existing.count += 1;
    } else {
      map.set(skill.category, {
        total: skill.proficiency_level,
        count: 1,
        label: skill.category_display,
      });
    }
  }

  return CATEGORY_ORDER.filter((cat) => map.has(cat)).map((cat) => {
    const { total, count, label } = map.get(cat)!;
    return {
      category: cat,
      level: Math.round((total / count) * 10) / 10,
      label,
    };
  });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function RadarTooltip({ active, payload, label }: TooltipProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const level = payload[0].value;
  const proficiency =
    level <= 1
      ? 'beginner'
      : level <= 2
        ? 'basic'
        : level <= 3
          ? 'intermediate'
          : level <= 4
            ? 'advanced'
            : 'expert';
  return (
    <div className="rounded-lg border border-border bg-popover px-md py-sm shadow-lg">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">
        {t(`pages.skills.proficiency.${proficiency}`)} ({level}/5)
      </p>
    </div>
  );
}

export function SkillsRadarChart({ skills }: SkillsRadarChartProps) {
  const { t } = useTranslation();
  const data = aggregateByCategory(skills);

  return (
    <Card>
      <CardHeader className="pb-sm">
        <CardTitle className="text-base">
          {t('pages.skills.radarChart.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {t('pages.skills.radarChart.emptyState')}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={data}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 5]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickCount={6}
              />
              <Radar
                dataKey="level"
                stroke="hsl(var(--category-intellect))"
                fill="hsl(var(--category-intellect))"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip content={<RadarTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
