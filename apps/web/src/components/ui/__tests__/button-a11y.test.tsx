import { render, screen } from '@testing-library/react';
import { Send } from 'lucide-react';
import { describe, it, expect } from 'vitest';

import { Button } from '@/components/ui/button';

describe('Button accessible name', () => {
  it('keeps the title as aria-label when it becomes the tooltip', () => {
    render(
      <Button size="icon" title="Testar">
        <Send />
      </Button>
    );
    expect(screen.getByRole('button', { name: 'Testar' })).toBeTruthy();
  });

  it('does not override an explicit aria-label or label text buttons', () => {
    render(
      <>
        <Button size="icon" title="Dica" aria-label="Excluir">
          <Send />
        </Button>
        <Button title="Dica">Salvar</Button>
      </>
    );
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Salvar' }).getAttribute('aria-label')
    ).toBeNull();
  });
});
