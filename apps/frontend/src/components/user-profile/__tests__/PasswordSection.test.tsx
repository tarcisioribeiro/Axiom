import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { PasswordSection } from '@/components/user-profile/PasswordSection';
import { ValidationError } from '@/services/api-errors';
import { authService } from '@/services/auth-service';

describe('PasswordSection', () => {
  it('reveals the fields on demand, hides rules until typing and flags a wrong current password', async () => {
    const user = userEvent.setup();
    vi.spyOn(authService, 'changePassword').mockRejectedValue(
      new ValidationError('error: Senha atual incorreta.', {
        error: 'Senha atual incorreta.',
      } as unknown as Record<string, string[]>)
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PasswordSection />
      </QueryClientProvider>
    );

    expect(screen.queryByLabelText('Senha atual')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));
    expect(screen.queryByText('Mínimo de 8 caracteres')).not.toBeInTheDocument();
    expect(screen.queryByText('As senhas coincidem')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Senha atual'), 'errada');
    await user.type(screen.getByLabelText('Nova senha'), 'NovaSenha123!');
    expect(screen.getByText('Mínimo de 8 caracteres')).toBeInTheDocument();
    expect(screen.queryByText('As senhas coincidem')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'NovaSenha123!');
    expect(screen.getByText('As senhas coincidem')).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Alterar senha' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Senha atual incorreta.'
    );
    expect(authService.changePassword).toHaveBeenCalledWith(
      'errada',
      'NovaSenha123!',
      'NovaSenha123!'
    );
  });
});
