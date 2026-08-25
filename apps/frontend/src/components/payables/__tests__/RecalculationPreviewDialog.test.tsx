import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { RecalculationPreviewDialog } from '@/components/payables/RecalculationPreviewDialog';
import type { RecalculationPreview } from '@/types';

const buildPreview = (
  overrides: Partial<RecalculationPreview> = {}
): RecalculationPreview => ({
  payable_id: 1,
  mode: 'keep_count',
  old_installment_count: 3,
  new_installment_count: 3,
  old_value_per_installment: '100.00',
  new_value_per_installment: '150.00',
  remaining_value: '450.00',
  installments_preview: [
    { number: 1, old_value: '100.00', new_value: '150.00', due_date: '2026-09-10' },
    { number: 2, old_value: '100.00', new_value: '150.00', due_date: '2026-10-10' },
    { number: 3, old_value: '100.00', new_value: '150.00', due_date: '2026-11-10' },
  ],
  ...overrides,
});

describe('RecalculationPreviewDialog', () => {
  it('shows a loading placeholder when no preview is available yet', () => {
    render(
      <RecalculationPreviewDialog
        open
        title="Prévia"
        description="desc"
        preview={null}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('renders the installment count change and each installment row', () => {
    render(
      <RecalculationPreviewDialog
        open
        title="Prévia do Recálculo"
        description="Conta a pagar"
        preview={buildPreview()}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Prévia do Recálculo')).toBeInTheDocument();
    expect(screen.getByText('3 → 3')).toBeInTheDocument();
    // header row + 3 installment rows
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getAllByText(/150,00/)).toHaveLength(3);
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <RecalculationPreviewDialog
        open
        title="Prévia"
        description="desc"
        preview={buildPreview()}
        isLoading={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <RecalculationPreviewDialog
        open
        title="Prévia"
        description="desc"
        preview={buildPreview()}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables the confirm button while isLoading', () => {
    render(
      <RecalculationPreviewDialog
        open
        title="Prévia"
        description="desc"
        preview={buildPreview()}
        isLoading
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Salvando/ })).toBeDisabled();
  });

  it('does not render dialog content when closed', () => {
    render(
      <RecalculationPreviewDialog
        open={false}
        title="Prévia"
        description="desc"
        preview={buildPreview()}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('Prévia')).not.toBeInTheDocument();
  });
});
