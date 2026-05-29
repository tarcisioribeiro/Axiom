import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GoalForm } from '@/components/personal-planning/GoalForm';
import type { Goal, RoutineTask } from '@/types';

vi.mock('@/services/members-service', () => ({
  membersService: {
    getCurrentUserMember: vi.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

const mockRoutineTasks: RoutineTask[] = [
  {
    id: 1,
    uuid: 'uuid-1',
    name: 'Meditar',
    category: 'health',
    category_display: 'Saúde',
    periodicity: 'daily',
    periodicity_display: 'Diária',
    is_active: true,
    priority: 'medium',
    priority_display: 'Média',
    allowed_skips_per_month: 0,
    target_quantity: 1,
    unit: 'vez',
    completion_rate: 80,
    total_completions: 20,
    daily_occurrences: 1,
    owner: 1,
    owner_name: 'Test',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  },
];

const mockGoal: Goal = {
  id: 1,
  uuid: 'goal-uuid',
  title: 'Meditar 30 dias',
  goal_type: 'consecutive_days',
  goal_type_display: 'Dias Consecutivos',
  target_value: 30,
  current_value: 5,
  calculated_current_value: 5,
  start_date: '2025-01-01',
  end_date: '2025-02-01',
  status: 'active',
  status_display: 'Ativo',
  progress_percentage: 16.7,
  days_active: 5,
  owner: 1,
  owner_name: 'Test',
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
};

describe('GoalForm', () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    onSubmit.mockClear();
    onCancel.mockClear();
  });

  it('renders the form with empty defaults for new goal', async () => {
    render(
      <GoalForm
        routineTasks={mockRoutineTasks}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/Título/i)).toBeInTheDocument();
    });
  });

  it('renders with pre-filled values when editing an existing goal', () => {
    render(
      <GoalForm
        goal={mockGoal}
        routineTasks={mockRoutineTasks}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
    expect((screen.getByLabelText(/Título/i) as HTMLInputElement).value).toBe(
      'Meditar 30 dias'
    );
  });

  it('renders the deadline field', () => {
    const customGoal = {
      ...mockGoal,
      goal_type: 'custom',
      goal_type_display: 'Personalizado',
    };
    render(
      <GoalForm
        goal={customGoal}
        routineTasks={mockRoutineTasks}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('Data de Término')).toBeInTheDocument();
  });

  it('shows validation error when title is too short', async () => {
    render(
      <GoalForm
        routineTasks={mockRoutineTasks}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
    const titleInput = screen.getByLabelText(/Título/i);
    fireEvent.change(titleInput, { target: { value: 'ab' } });

    const submitBtn = screen.getByRole('button', { name: /Salvar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/mínimo 3/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    render(
      <GoalForm
        routineTasks={mockRoutineTasks}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows loading state when isLoading is true', () => {
    render(
      <GoalForm
        routineTasks={mockRoutineTasks}
        onSubmit={onSubmit}
        onCancel={onCancel}
        isLoading={true}
      />
    );
    expect(screen.getByText(/Salvando/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvando/i })).toBeDisabled();
  });

  it('shows related task dropdown with tasks', () => {
    render(
      <GoalForm
        routineTasks={mockRoutineTasks}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText(/Tarefa Relacionada/i)).toBeInTheDocument();
  });
});
