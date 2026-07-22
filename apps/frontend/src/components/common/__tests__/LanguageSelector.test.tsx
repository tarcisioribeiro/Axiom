import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockChangeLanguage = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'pt-BR',
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

import { LanguageSelector } from '@/components/common/LanguageSelector';

describe('LanguageSelector', () => {
  it('renders the language toggle button', () => {
    render(<LanguageSelector />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('button has the accessible label from translation key', () => {
    render(<LanguageSelector />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'layout.language');
  });

  it('renders without crashing when language is pt-BR', () => {
    expect(() => render(<LanguageSelector />)).not.toThrow();
  });
});
