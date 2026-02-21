/* eslint-disable @typescript-eslint/unbound-method */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/auth-service', () => ({
  authService: {
    login: vi.fn(),
    getUserPermissions: vi.fn(),
    savePermissions: vi.fn(),
    saveUserData: vi.fn(),
    getUserData: vi.fn(),
    getPermissions: vi.fn(),
    isAuthenticated: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('@/services/members-service', () => ({
  membersService: {
    getCurrentUserMember: vi.fn(),
  },
}));

// Imports must come after vi.mock to receive mocked versions
import { authService } from '@/services/auth-service';
import { membersService } from '@/services/members-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Permission } from '@/types';

const resetState = {
  user: null,
  permissions: [] as Permission[],
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true,
  error: null,
} as const;

describe('useAuthStore', () => {
  beforeEach(() => {
    // Merge-reset: resets data fields while preserving action functions
    useAuthStore.setState(resetState);
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with user null and not authenticated', () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.permissions).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('sets an error message', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setError('Login falhou');
      });

      expect(result.current.error).toBe('Login falhou');
    });

    it('clears the error when called with null', () => {
      useAuthStore.setState({ error: 'Erro anterior' });
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('returns false when permissions list is empty', () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasPermission('accounts', 'view')).toBe(false);
    });

    it('returns true when the matching permission exists', () => {
      useAuthStore.setState({
        permissions: [
          {
            app_label: 'accounts',
            codename: 'view_accounts',
            name: 'Can view accounts',
          },
        ],
      });
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasPermission('accounts', 'view')).toBe(true);
    });

    it('returns false when only a different permission exists', () => {
      useAuthStore.setState({
        permissions: [
          {
            app_label: 'accounts',
            codename: 'view_accounts',
            name: 'Can view accounts',
          },
        ],
      });
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasPermission('accounts', 'delete')).toBe(false);
    });

    it('matches on codename pattern <action>_<appName>', () => {
      useAuthStore.setState({
        permissions: [
          { app_label: 'expenses', codename: 'add_expense', name: 'Can add expense' },
        ],
      });
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasPermission('expense', 'add')).toBe(true);
    });
  });

  describe('hasSystemAccess', () => {
    it('returns false when user is null', () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasSystemAccess()).toBe(false);
    });

    it('returns true when user belongs to the Membros group', () => {
      useAuthStore.setState({
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          groups: ['Membros'],
        },
      });
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasSystemAccess()).toBe(true);
    });

    it('returns false when user does not belong to the Membros group', () => {
      useAuthStore.setState({
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          groups: ['Admins'],
        },
      });
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasSystemAccess()).toBe(false);
    });

    it('returns false when user has no groups', () => {
      useAuthStore.setState({
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          groups: [],
        },
      });
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.hasSystemAccess()).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears user, permissions, and auth state', () => {
      useAuthStore.setState({
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          groups: ['Membros'],
        },
        permissions: [{ app_label: 'a', codename: 'view_a', name: 'View A' }],
        isAuthenticated: true,
        error: 'some error',
      });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.permissions).toEqual([]);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('calls authService.logout', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.logout();
      });

      expect(authService.logout).toHaveBeenCalledOnce();
    });
  });

  describe('login', () => {
    it('sets user and permissions on successful login', async () => {
      const mockPermissions: Permission[] = [
        { app_label: 'accounts', codename: 'view_accounts', name: 'Can view accounts' },
      ];

      vi.mocked(authService.login).mockResolvedValue({
        message: 'Login successful',
        user: { username: 'testuser' },
      });
      vi.mocked(authService.getUserPermissions).mockResolvedValue(mockPermissions);
      vi.mocked(membersService.getCurrentUserMember).mockResolvedValue({
        id: 1,
        uuid: 'abc',
        name: 'Test User',
        document: '123',
        phone: '999',
        sex: 'M',
        is_creditor: false,
        is_benefited: false,
        active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({ username: 'testuser', password: 'password' });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.permissions).toEqual(mockPermissions);
      expect(result.current.user?.first_name).toBe('Test');
      expect(result.current.user?.last_name).toBe('User');
    });

    it('parses multi-word last names correctly', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        message: 'OK',
        user: { username: 'user' },
      });
      vi.mocked(authService.getUserPermissions).mockResolvedValue([]);
      vi.mocked(membersService.getCurrentUserMember).mockResolvedValue({
        id: 1,
        uuid: 'abc',
        name: 'Ana Paula Souza',
        document: '123',
        phone: '999',
        sex: 'F',
        is_creditor: false,
        is_benefited: false,
        active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({ username: 'user', password: 'pass' });
      });

      expect(result.current.user?.first_name).toBe('Ana');
      expect(result.current.user?.last_name).toBe('Paula Souza');
    });

    it('sets error state and re-throws on failed login', async () => {
      vi.mocked(authService.login).mockRejectedValue(
        new Error('Credenciais inválidas')
      );

      const { result } = renderHook(() => useAuthStore());

      // Catch the error inside act() so React state updates flush before assertions
      let thrownError: Error | null = null;
      await act(async () => {
        try {
          await result.current.login({ username: 'wrong', password: 'wrong' });
        } catch (e) {
          thrownError = e as Error;
        }
      });

      expect(thrownError).not.toBeNull();
      expect((thrownError as unknown as Error).message).toBe('Credenciais inválidas');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Credenciais inválidas');
    });

    it('handles missing member data gracefully', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        message: 'OK',
        user: { username: 'user' },
      });
      vi.mocked(authService.getUserPermissions).mockResolvedValue([]);
      vi.mocked(membersService.getCurrentUserMember).mockRejectedValue(
        new Error('Not found')
      );

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({ username: 'user', password: 'pass' });
      });

      // Should still authenticate even if member data fetch fails
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.first_name).toBe('');
    });
  });
});
