import { create } from 'zustand';

import { logger } from '@/lib/logger';
import { authService } from '@/services/auth-service';
import { membersService } from '@/services/members-service';
import type { User, Permission, LoginCredentials } from '@/types';

// Variável para evitar múltiplas chamadas simultâneas de loadUserData
let loadUserDataPromise: Promise<void> | null = null;

interface AuthState {
  user: User | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  isAdmin: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
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

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });

    try {
      const loginResponse = await authService.login(credentials);
      logger.log('[AuthStore] Login successful:', loginResponse.message);

      // Os tokens agora são httpOnly cookies definidos pelo backend
      // Podemos fazer chamadas imediatamente

      // Get user permissions and data
      const { permissions: permissionsResponse, is_superuser } =
        await authService.getUserPermissions();

      // Superusuário → acesso exclusivo ao painel admin
      if (is_superuser) {
        const adminUser: User = {
          id: 0,
          username: credentials.username,
          email: '',
          first_name: 'Admin',
          last_name: '',
          groups: [],
          is_superuser: true,
        };
        authService.saveUserData(adminUser);
        authService.savePermissions([]);
        set({
          user: adminUser,
          permissions: [],
          isAuthenticated: true,
          isAdmin: true,
          isLoading: false,
        });
        return;
      }

      authService.savePermissions(permissionsResponse);

      // Construct user object with data from permissions endpoint
      let user: User = {
        id: 1,
        username: credentials.username,
        email: '',
        first_name: '',
        last_name: '',
        groups: ['Membros'],
      };

      // Fetch member data to get full name
      try {
        const memberData = await membersService.getCurrentUserMember();
        if (memberData?.name) {
          const nameParts = memberData.name.trim().split(' ');
          user = {
            ...user,
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
          };
        }
      } catch (memberError) {
        logger.log('[AuthStore] Could not fetch member data:', memberError);
      }

      authService.saveUserData(user);

      set({
        user,
        permissions: permissionsResponse,
        isAuthenticated: true,
        isAdmin: false,
        isLoading: false,
      });
    } catch (error: unknown) {
      const err = error as Error;
      const message =
        err.name === 'PermissionError'
          ? 'Superusuários não têm acesso ao sistema. Use o painel admin.'
          : err.message || 'Login failed';
      set({
        error: message,
        isLoading: false,
      });
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
    });
  },

  loadUserData: async () => {
    // Se já há uma chamada em andamento, retorna a Promise existente
    if (loadUserDataPromise) {
      logger.log('[AuthStore] loadUserData já em andamento, reutilizando...');
      return loadUserDataPromise;
    }

    // Set isInitializing synchronously before the IIFE so any concurrent caller
    // that checks get().isInitializing sees the guard immediately.
    set({ isInitializing: true });

    loadUserDataPromise = (async () => {
      try {
        let user = authService.getUserData();
        const permissions = authService.getPermissions();

        // Se não há dados do usuário nos cookies, não está autenticado
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

        // Verifica se o token ainda é válido
        try {
          const isAuthenticated = await authService.isAuthenticated();

          // If authenticated and user has empty first_name, try to fetch member data
          if (isAuthenticated && user && !user.first_name) {
            try {
              const memberData = await membersService.getCurrentUserMember();
              if (memberData?.name) {
                const nameParts = memberData.name.trim().split(' ');
                user = {
                  ...user,
                  first_name: nameParts[0] || '',
                  last_name: nameParts.slice(1).join(' ') || '',
                };
                authService.saveUserData(user);
              }
            } catch (memberError) {
              logger.log(
                '[AuthStore] Could not fetch member data on reload:',
                memberError
              );
            }
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
          // Erro ao verificar token (401, 429, etc) - trata como não autenticado
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
        // Limpa a Promise após conclusão para permitir novas chamadas no futuro
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
