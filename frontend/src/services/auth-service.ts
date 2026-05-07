import Cookies from 'js-cookie';

import { API_CONFIG, TOKEN_CONFIG } from '@/config/constants';
import { logger } from '@/lib/logger';
import type { LoginCredentials, Permission, User } from '@/types';

import { apiClient } from './api-client';

type LoginResponse =
  | { message: string; user: { username: string }; requires_2fa?: false }
  | { requires_2fa: true; temp_token: string; message: string };

/**
 * Servico de autenticacao.
 *
 * Gerencia login, logout, registro e verificacao de permissoes.
 * Os tokens JWT sao armazenados como httpOnly cookies pelo backend.
 *
 * @example
 * ```ts
 * // Login
 * await authService.login({ username: 'user', password: 'pass' });
 *
 * // Verificar autenticacao
 * const isAuth = await authService.isAuthenticated();
 *
 * // Verificar permissao
 * const canView = authService.hasPermission('accounts', 'view');
 *
 * // Logout
 * authService.logout();
 * ```
 */
class AuthService {
  /**
   * Realiza login do usuario.
   *
   * O backend define os tokens como httpOnly cookies automaticamente.
   * Apos o login, use `saveUserData` para armazenar dados do usuario.
   *
   * @param credentials - Credenciais de login (username e password)
   * @returns Promise com mensagem de sucesso e dados basicos do usuario
   * @throws {AuthenticationError} Se credenciais invalidas
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>(API_CONFIG.ENDPOINTS.LOGIN, credentials);
  }

  /**
   * Registra um novo usuario.
   *
   * Usa fetch diretamente pois nao requer autenticacao.
   *
   * @param data - Dados do novo usuario
   * @returns Promise com dados do usuario criado
   * @throws {Error} Se registro falhar (email/documento duplicado, etc)
   */
  async register(data: {
    username: string;
    password: string;
    name: string;
    document: string;
    phone: string;
    email?: string;
  }): Promise<{
    message: string;
    user_id: number;
    member_id: number;
    username: string;
  }> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(errorData.error ?? 'Erro ao cadastrar usuario');
    }

    return response.json() as Promise<{
      message: string;
      user_id: number;
      member_id: number;
      username: string;
    }>;
  }

  /**
   * Busca permissoes do usuario autenticado.
   *
   * Transforma permissoes do formato "app_label.codename"
   * para objetos Permission.
   *
   * @returns Promise com lista de permissoes do usuario
   */
  async getUserPermissions(): Promise<{
    permissions: Permission[];
    is_superuser: boolean;
  }> {
    let response: {
      username: string;
      permissions: string[];
      is_staff: boolean;
      is_superuser: boolean;
    };

    try {
      response = await apiClient.get<{
        username: string;
        permissions: string[];
        is_staff: boolean;
        is_superuser: boolean;
      }>(API_CONFIG.ENDPOINTS.USER_PERMISSIONS);
    } catch (error) {
      // Backend retorna 403 para superusuários neste endpoint.
      // Tratamos isso como sinal de que o usuário é superusuário.
      if ((error as Error).name === 'PermissionError') {
        return { permissions: [], is_superuser: true };
      }
      throw error;
    }

    if (response.is_superuser) {
      return { permissions: [], is_superuser: true };
    }

    if (!Array.isArray(response.permissions)) {
      logger.error(
        'Invalid permissions format received from API:',
        response.permissions
      );
      return { permissions: [], is_superuser: false };
    }

    const permissions = response.permissions.map((perm: string) => {
      const [app_label, codename] = perm.split('.');
      return {
        app_label,
        codename,
        name: perm,
      };
    });

    return { permissions, is_superuser: false };
  }

  /**
   * Realiza logout do usuario.
   *
   * Limpa cookies locais e redireciona para pagina de login.
   * Os tokens httpOnly sao removidos pelo backend.
   */
  logout(): void {
    apiClient.clearTokens();
    window.location.href = '/login';
  }

  /**
   * Verifica se o usuario esta autenticado.
   *
   * Faz uma chamada ao backend para validar o token.
   * Resultado e cacheado por 5 segundos.
   *
   * @returns Promise<boolean> - true se autenticado
   */
  async isAuthenticated(): Promise<boolean> {
    return await apiClient.hasValidToken();
  }

  /**
   * Salva dados do usuario em cookie (nao-httpOnly).
   *
   * Usado para exibir informacoes do usuario na UI
   * sem precisar fazer requisicoes ao backend.
   *
   * @param user - Dados do usuario
   */
  saveUserData(user: User): void {
    Cookies.set('user_data', JSON.stringify(user), {
      expires: TOKEN_CONFIG.COOKIE_EXPIRE_DAYS,
      sameSite: 'Lax',
      secure: false,
    });
  }

  /**
   * Recupera dados do usuario do cookie.
   *
   * @returns Dados do usuario ou null se nao encontrado
   */
  getUserData(): User | null {
    const userData = Cookies.get('user_data');
    if (!userData) return null;

    try {
      return JSON.parse(userData) as User;
    } catch {
      return null;
    }
  }

  /**
   * Salva permissoes do usuario em cookie.
   *
   * @param permissions - Lista de permissoes
   */
  savePermissions(permissions: Permission[]): void {
    Cookies.set('user_permissions', JSON.stringify(permissions), {
      expires: TOKEN_CONFIG.COOKIE_EXPIRE_DAYS,
      sameSite: 'Lax',
      secure: false,
    });
  }

  /**
   * Recupera permissoes do usuario do cookie.
   *
   * @returns Lista de permissoes ou array vazio
   */
  getPermissions(): Permission[] {
    const permsData = Cookies.get('user_permissions');
    if (!permsData) return [];

    try {
      return JSON.parse(permsData) as Permission[];
    } catch {
      return [];
    }
  }

  /**
   * Verifica se o usuario tem uma permissao especifica.
   *
   * @param appName - Nome da app Django (ex: "accounts", "expenses")
   * @param action - Acao (ex: "view", "add", "change", "delete")
   * @returns true se o usuario tem a permissao
   *
   * @example
   * ```ts
   * // Verifica permissao de visualizar contas
   * if (authService.hasPermission('accounts', 'view')) {
   *   // Exibir lista de contas
   * }
   * ```
   */
  hasPermission(appName: string, action: string): boolean {
    const permissions = this.getPermissions();
    if (!Array.isArray(permissions)) return false;
    const codename = `${action}_${appName}`;

    return permissions.some((perm) => perm.codename === codename);
  }

  /**
   * Solicita redefinição de senha via e-mail.
   * Retorna 200 independente de o e-mail existir (anti-enumeração).
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PASSWORD_RESET_REQUEST}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }
    );
    return response.json() as Promise<{ message: string }>;
  }

  /**
   * Confirma redefinição de senha com uid + token do link enviado por e-mail.
   */
  async confirmPasswordReset(
    uid: string,
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PASSWORD_RESET_CONFIRM}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      }
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? 'Erro ao redefinir senha.');
    }
  }

  /**
   * Reenvia e-mail de verificação para o usuário autenticado.
   */
  async sendEmailVerification(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      API_CONFIG.ENDPOINTS.EMAIL_VERIFICATION_SEND
    );
  }

  /**
   * Confirma o token de verificação de e-mail.
   */
  async confirmEmailVerification(token: string): Promise<{ message: string }> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.EMAIL_VERIFICATION_CONFIRM}?token=${token}`
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      throw new Error(data.detail ?? 'Token inválido ou expirado.');
    }
    return response.json() as Promise<{ message: string }>;
  }

  /**
   * Altera a senha do usuário autenticado.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(API_CONFIG.ENDPOINTS.CHANGE_PASSWORD, {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
  }

  /**
   * Consulta o status do 2FA do usuário autenticado.
   */
  async getTwoFactorStatus(): Promise<{ is_active: boolean }> {
    return apiClient.get<{ is_active: boolean }>(
      API_CONFIG.ENDPOINTS.TWO_FACTOR_STATUS
    );
  }

  /**
   * Busca o QR code para setup inicial do 2FA.
   */
  async getTwoFactorSetup(): Promise<{
    secret: string;
    qr_code: string;
    manual_entry_key: string;
  }> {
    return apiClient.get<{ secret: string; qr_code: string; manual_entry_key: string }>(
      API_CONFIG.ENDPOINTS.TWO_FACTOR_SETUP
    );
  }

  /**
   * Ativa 2FA após confirmar o primeiro código TOTP.
   */
  async activateTwoFactor(
    code: string
  ): Promise<{ message: string; backup_codes: string[] }> {
    return apiClient.post<{ message: string; backup_codes: string[] }>(
      API_CONFIG.ENDPOINTS.TWO_FACTOR_ACTIVATE,
      { code }
    );
  }

  /**
   * Verifica o código TOTP durante o fluxo de login (2FA pendente).
   */
  async verifyTwoFactor(tempToken: string, code: string): Promise<{ message: string }> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TWO_FACTOR_VERIFY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ temp_token: tempToken, code }),
      }
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? 'Código inválido.');
    }
    return response.json() as Promise<{ message: string }>;
  }

  /**
   * Desativa 2FA confirmando com a senha atual.
   */
  async disableTwoFactor(password: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      API_CONFIG.ENDPOINTS.TWO_FACTOR_DISABLE,
      {
        password,
      }
    );
  }

  /**
   * Verifica se o usuario tem acesso ao sistema.
   *
   * Usuarios devem pertencer ao grupo "Membros" para ter acesso.
   *
   * @returns true se o usuario esta no grupo "Membros"
   */
  hasSystemAccess(): boolean {
    const user = this.getUserData();
    if (!user || !Array.isArray(user.groups)) return false;

    return user.groups.includes('Membros');
  }
}

export const authService = new AuthService();
