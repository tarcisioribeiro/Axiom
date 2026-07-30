import { create } from 'zustand';

import { playErrorSound, playSuccessSound } from '@/hooks/use-sound-feedback';
import { logger } from '@/lib/logger';
import { authService } from '@/services/auth-service';
import type { LoginCredentials, Permission, User } from '@/types';

import {
  buildAdminUser,
  buildMemberUser,
  enrichUserWithMemberData,
} from './auth-helpers';

let loadUserDataPromise: Promise<void> | null = null;

interface AuthState {
  user: User | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  isAdmin: boolean;
  error: string | null;
  requires2FA: boolean;
  tempToken: string | null;

  login: (credentials: LoginCredentials) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  logout: () => void;
  loadUserData: () => Promise<void>;
  setError: (error: string | null) => void;
  hasPermission: (appName: string, action: string) => boolean;
  hasSystemAccess: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  permissions: [],
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true,
  isAdmin: false,
  error: null,
  requires2FA: false,
  tempToken: null,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null, requires2FA: false, tempToken: null });

    try {
      const loginResponse = await authService.login(credentials);
      logger.log('[AuthStore] Login response:', loginResponse.message);

      if (loginResponse.requires_2fa) {
        set({
          isLoading: false,
          requires2FA: true,
          tempToken: loginResponse.temp_token,
        });
        return;
      }

      const { permissions: permissionsResponse, is_superuser } =
        await authService.getUserPermissions();

      if (is_superuser) {
        const adminUser = buildAdminUser(credentials.username);
        authService.saveUserData(adminUser);
        authService.savePermissions([]);
        set({
          user: adminUser,
          permissions: [],
          isAuthenticated: true,
          isAdmin: true,
          isLoading: false,
        });
        playSuccessSound();
        return;
      }

      authService.savePermissions(permissionsResponse);

      let user = buildMemberUser(credentials.username);

      user = await enrichUserWithMemberData(user, '[AuthStore] login:');
      authService.saveUserData(user);

      set({
        user,
        permissions: permissionsResponse,
        isAuthenticated: true,
        isAdmin: false,
        isLoading: false,
      });
      playSuccessSound();
    } catch (error: unknown) {
      const err = error as Error;
      const message =
        err.name === 'PermissionError'
          ? 'Superusuários não têm acesso ao sistema. Use o painel admin.'
          : err.message || 'Login failed';
      set({ error: message, isLoading: false });
      playErrorSound();
      throw error;
    }
  },

  verify2FA: async (code: string) => {
    const { tempToken } = get();
    if (!tempToken) {
      set({ error: 'Sessão 2FA expirada. Faça login novamente.' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      await authService.verifyTwoFactor(tempToken, code);

      const { permissions: permissionsResponse, is_superuser } =
        await authService.getUserPermissions();

      if (is_superuser) {
        const adminUser = buildAdminUser('');
        authService.saveUserData(adminUser);
        authService.savePermissions([]);
        set({
          user: adminUser,
          permissions: [],
          isAuthenticated: true,
          isAdmin: true,
          isLoading: false,
          requires2FA: false,
          tempToken: null,
        });
        playSuccessSound();
        return;
      }

      authService.savePermissions(permissionsResponse);
      let user = buildMemberUser('');
      user = await enrichUserWithMemberData(user, '[AuthStore] verify2FA:');
      authService.saveUserData(user);
      set({
        user,
        permissions: permissionsResponse,
        isAuthenticated: true,
        isAdmin: false,
        isLoading: false,
        requires2FA: false,
        tempToken: null,
      });
      playSuccessSound();
    } catch (error: unknown) {
      const err = error as Error;
      set({ error: err.message || 'Código inválido.', isLoading: false });
      playErrorSound();
      throw error;
    }
  },

  logout: () => {
    authService.logout();
    set({
      user: null,
      permissions: [],
      isAuthenticated: false,
      isAdmin: false,
      error: null,
      requires2FA: false,
      tempToken: null,
    });
  },

  loadUserData: async () => {
    if (loadUserDataPromise) {
      logger.log('[AuthStore] loadUserData já em andamento, reutilizando...');
      return loadUserDataPromise;
    }

    set({ isInitializing: true });

    loadUserDataPromise = (async () => {
      try {
        let user = authService.getUserData();
        const permissions = authService.getPermissions();

        if (!user) {
          logger.log('[AuthStore] No user data in cookies - user not authenticated');
          set({
            user: null,
            permissions: [],
            isAuthenticated: false,
            isInitializing: false,
          });
          return;
        }

        try {
          const isAuthenticated = await authService.isAuthenticated();

          if (isAuthenticated && user && !user.is_superuser) {
            user = await enrichUserWithMemberData(user, '[AuthStore] loadUserData:');
            authService.saveUserData(user);
          }

          const isAdminUser = isAuthenticated ? user?.is_superuser === true : false;
          set({
            user: isAuthenticated ? user : null,
            permissions: isAuthenticated ? permissions : [],
            isAuthenticated,
            isAdmin: isAdminUser,
            isInitializing: false,
          });
        } catch {
          logger.log(
            '[AuthStore] Token verification failed - treating as not authenticated'
          );
          set({
            user: null,
            permissions: [],
            isAuthenticated: false,
            isInitializing: false,
          });
        }
      } catch (error) {
        logger.error('[AuthStore] Unexpected error loading user data:', error);
        set({
          user: null,
          permissions: [],
          isAuthenticated: false,
          isInitializing: false,
        });
      } finally {
        loadUserDataPromise = null;
      }
    })();

    return loadUserDataPromise;
  },

  setError: (error: string | null) => {
    set({ error });
  },

  hasPermission: (appName: string, action: string) => {
    const { permissions } = get();
    if (!Array.isArray(permissions)) return false;
    const codename = `${action}_${appName}`;
    return permissions.some((perm) => perm.codename === codename);
  },

  hasSystemAccess: () => {
    const { user } = get();
    if (!user || !Array.isArray(user.groups)) return false;
    return user.groups.includes('Membros');
  },
}));
