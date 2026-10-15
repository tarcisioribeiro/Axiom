import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-screen-access', () => ({
  useScreenAccess: () => ({ ready: true, can: () => true }),
}));

import { CommandPalette } from '@/components/layout/CommandPalette';
import { useCommandPaletteStore } from '@/stores/command-palette-store';

const Location = () => <div data-testid="path">{useLocation().pathname}</div>;

const renderPalette = () =>
  render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="*" element={<Location />} />
      </Routes>
      <CommandPalette />
    </MemoryRouter>
  );

const selected = () => screen.getByRole('option', { selected: true });

describe('CommandPalette', () => {
  beforeEach(() => useCommandPaletteStore.setState({ isOpen: true }));

  it('pagina em 5 e ↑/↓ atravessam as páginas', async () => {
    renderPalette();
    const input = screen.getByPlaceholderText('Buscar comando');

    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(selected()).toHaveTextContent('Início');

    fireEvent.keyDown(input, { key: 'ArrowUp' }); // volta para o último (página final)
    await waitFor(() => expect(selected()).toHaveTextContent('Sair'));

    fireEvent.keyDown(input, { key: 'ArrowDown' }); // volta ao primeiro
    await waitFor(() => expect(selected()).toHaveTextContent('Início'));
  });

  it('Enter executa o item destacado na ordem exibida', () => {
    renderPalette();
    const input = screen.getByPlaceholderText('Buscar comando');

    fireEvent.change(input, { target: { value: 'receita' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // "Receitas" (navegação) aparece antes de "Nova Receita" (ações).
    expect(screen.getByTestId('path')).toHaveTextContent('/revenues');
  });
});
