import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';

import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { useAuthStore } from '@/stores/auth-store';
import type { Permission } from '@/types';

// Helper to set auth store state
function setAuthState(
  partial: Partial<{
    isAuthenticated: boolean;
    isInitializing: boolean;
    permissions: Permission[];
  }>
) {
  useAuthStore.setState({
    isAuthenticated: false,
    isInitializing: false,
    permissions: [],
    ...partial,
  });
}

const renderInRouter = (ui: React.ReactElement, initialEntry = '/protected') =>
  render(<MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    setAuthState({ isAuthenticated: false, isInitializing: false, permissions: [] });
  });

  it('shows a loading spinner while initializing', () => {
    setAuthState({ isInitializing: true });
    const { container } = renderInRouter(
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>
    );
    // Spinner SVG rendered instead of children
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    setAuthState({ isAuthenticated: true });
    renderInRouter(
      <ProtectedRoute>
        <div data-testid="protected">secret page</div>
      </ProtectedRoute>
    );
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    setAuthState({ isAuthenticated: false, isInitializing: false });
    renderInRouter(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>
    );
    // MemoryRouter + Navigate replaces the location; children should not render
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders children when authenticated and has the required permission', () => {
    setAuthState({
      isAuthenticated: true,
      permissions: [
        { app_label: 'expenses', codename: 'view_expenses', name: 'Can view expense' },
      ],
    });
    renderInRouter(
      <ProtectedRoute requirePermission={{ appName: 'expenses', action: 'view' }}>
        <div data-testid="perm-protected">expenses</div>
      </ProtectedRoute>
    );
    expect(screen.getByTestId('perm-protected')).toBeInTheDocument();
  });

  it('redirects to /unauthorized when lacking the required permission', () => {
    setAuthState({ isAuthenticated: true, permissions: [] });
    renderInRouter(
      <ProtectedRoute requirePermission={{ appName: 'expenses', action: 'view' }}>
        <div>expenses</div>
      </ProtectedRoute>
    );
    expect(screen.queryByText('expenses')).not.toBeInTheDocument();
  });
});
