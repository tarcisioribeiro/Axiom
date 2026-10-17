import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));

import { installNativeValidation } from '@/lib/native-validation';

installNativeValidation();

describe('installNativeValidation', () => {
  it('bloqueia o envio, mostra toast e marca o campo; libera quando válido', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form noValidate onSubmit={onSubmit}>
        <label htmlFor="u">Usuário</label>
        <input id="u" required />
        <button type="submit">Entrar</button>
      </form>
    );
    const input = screen.getByLabelText('Usuário');

    fireEvent.click(screen.getByText('Entrar'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );

    fireEvent.input(input, { target: { value: 'joao' } });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    fireEvent.click(screen.getByText('Entrar'));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
