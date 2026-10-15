import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ScreenCatalogModule } from '@/types';

import { PermissionMatrix } from '../PermissionMatrix';

const catalog: ScreenCatalogModule[] = [
  {
    key: 'security',
    label: 'Segurança',
    screens: [
      {
        key: 'security.passwords',
        label: 'Senhas',
        path: '/security/passwords',
        actions: ['view', 'add', 'reveal'],
      },
    ],
  },
];

const checkbox = (name: string) => screen.getByRole('checkbox', { name });

describe('PermissionMatrix', () => {
  it('desmarcar Ver remove a tela inteira', () => {
    const onChange = vi.fn();
    render(
      <PermissionMatrix
        catalog={catalog}
        value={{ 'security.passwords': ['view', 'reveal'] }}
        onChange={onChange}
      />
    );
    fireEvent.click(checkbox('Ver'));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('marcar uma ação mantém a ordem do catálogo', () => {
    const onChange = vi.fn();
    render(
      <PermissionMatrix
        catalog={catalog}
        value={{ 'security.passwords': ['view', 'reveal'] }}
        onChange={onChange}
      />
    );
    fireEvent.click(checkbox('Criar'));
    expect(onChange).toHaveBeenCalledWith({
      'security.passwords': ['view', 'add', 'reveal'],
    });
  });

  it('ações ficam desabilitadas sem Ver', () => {
    render(<PermissionMatrix catalog={catalog} value={{}} onChange={vi.fn()} />);
    expect(checkbox('Revelar')).toBeDisabled();
  });

  it('liberar módulo inteiro concede todas as ações', () => {
    const onChange = vi.fn();
    render(<PermissionMatrix catalog={catalog} value={{}} onChange={onChange} />);
    fireEvent.click(checkbox('Liberar módulo inteiro'));
    expect(onChange).toHaveBeenCalledWith({
      'security.passwords': ['view', 'add', 'reveal'],
    });
  });
});
