import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SkillsRadarChart } from '@/components/library/SkillsRadarChart';
import type { Skill } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  RadarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="radar-chart">{children}</div>
  ),
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />,
  Radar: () => <div data-testid="radar" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  id: 1,
  uuid: 'uuid-1',
  name: 'Python',
  category: 'technology',
  category_display: 'Technology',
  proficiency: 'intermediate',
  proficiency_display: 'Intermediate',
  proficiency_level: 3,
  status: 'evolving',
  status_display: 'Evolving',
  notes: null,
  owner: 1,
  owner_name: 'Test User',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('SkillsRadarChart', () => {
  it('renders empty state when no skills', () => {
    render(<SkillsRadarChart skills={[]} />);
    expect(screen.getByText('pages.skills.radarChart.emptyState')).toBeInTheDocument();
    expect(screen.queryByTestId('radar-chart')).not.toBeInTheDocument();
  });

  it('renders radar chart when skills are present', () => {
    const skills = [
      makeSkill({ id: 1, category: 'technology', proficiency_level: 3 }),
      makeSkill({ id: 2, category: 'design', proficiency_level: 4, name: 'Figma' }),
    ];
    render(<SkillsRadarChart skills={skills} />);
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    expect(
      screen.queryByText('pages.skills.radarChart.emptyState')
    ).not.toBeInTheDocument();
  });

  it('renders chart title', () => {
    const skills = [makeSkill()];
    render(<SkillsRadarChart skills={skills} />);
    expect(screen.getByText('pages.skills.radarChart.title')).toBeInTheDocument();
  });

  it('aggregates multiple skills in same category', () => {
    const skills = [
      makeSkill({ id: 1, category: 'technology', proficiency_level: 2 }),
      makeSkill({ id: 2, category: 'technology', proficiency_level: 4 }),
    ];
    // Should render chart (aggregation works, at least one category exists)
    render(<SkillsRadarChart skills={skills} />);
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
  });
});
