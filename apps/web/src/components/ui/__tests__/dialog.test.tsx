import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from '../dialog';

const view = (open: boolean, item?: string) => (
  <Dialog open={open}>
    <DialogContent
      aria-describedby={undefined}
      className={item ? 'max-w-5xl' : 'max-w-xl'}
    >
      <DialogTitle>Título</DialogTitle>
      {item && <p>{item}</p>}
    </DialogContent>
  </Dialog>
);

describe('DialogContent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mantém o último conteúdo durante a animação de saída', () => {
    // Simula a animação de saída para o Radix manter o conteúdo montado ao fechar.
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const style = real(el);
      return new Proxy(style, {
        get: (target, key) =>
          key === 'animationName'
            ? `pop-${el.getAttribute('data-state') ?? 'in'}`
            : Reflect.get(target, key),
      });
    });

    const { rerender } = render(view(true, 'Fast Food'));
    expect(screen.getByText('Fast Food')).toBeTruthy();

    // Chamador fecha e limpa o item selecionado no mesmo render.
    rerender(view(false, undefined));
    expect(screen.getByText('Fast Food')).toBeTruthy();
    // a largura derivada do item também fica congelada
    expect(screen.getByRole('dialog').className).toContain('max-w-5xl');
  });
});
