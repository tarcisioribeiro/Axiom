import { render } from '@testing-library/react';
import { UserX } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { AlertDialogHeader } from '@/components/ui/alert-dialog';

describe('AlertDialogHeader icon', () => {
  // Ícones do lucide são objetos forwardRef, não funções (React error #31)
  it('renders a lucide component passed as icon', () => {
    const { container } = render(<AlertDialogHeader icon={UserX} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders a JSX element passed as icon as-is', () => {
    const { getByTestId } = render(
      <AlertDialogHeader icon={<span data-testid="custom-icon" />} />
    );
    expect(getByTestId('custom-icon')).toBeTruthy();
  });
});
