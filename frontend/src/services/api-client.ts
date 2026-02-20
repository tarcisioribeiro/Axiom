import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import Cookies from 'js-cookie';
import { API_CONFIG } from '@/config/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Formato de resposta de erro do Django REST Framework.
 */
interface DRFErrorResponse {
  detail?: string;
  [field: string]: string | string[] | undefined;
}

/**
 * Tipo para dados de requisicao (body).
 * Aceita objetos, FormData, ou valores primitivos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RequestData = Record<string, any> | FormData | null | undefined;

/**
 * Tipo para parametros de query string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryParams = Record<string, any>;

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Erro de autenticacao (HTTP 401).
 * Lancado quando o usuario nao esta autenticado ou a sessao expirou.
 *
 * @example
 * ```ts
 * try {
 *   await apiClient.get('/api/v1/protected/');
 * } catch (error) {
 *   if (error instanceof AuthenticationError) {
 *     // Redirecionar para login
 *   }
 * }
 * ```
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Erro de validacao (HTTP 400).
 * Lancado quando os dados enviados falham na validacao do backend.
 *
 * @example
 * ```ts
 * try {
 *   await apiClient.post('/api/v1/accounts/', { name: '' });
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.log(error.errors); // { name: ['Este campo e obrigatorio.'] }
 *   }
 * }
 * ```
 */
export class ValidationError extends Error {
  /** Mapa de campo para lista de mensagens de erro */
  errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Erro de recurso nao encontrado (HTTP 404).
 * Lancado quando o recurso solicitado nao existe.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Erro de permissao (HTTP 403).
 * Lancado quando o usuario nao tem permissao para a acao.
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Cliente HTTP singleton para comunicacao com a API Django REST Framework.
 *
 * Funcionalidades:
 * - Autenticacao via cookies httpOnly (JWT)
 * - Refresh automatico de token em caso de 401
 * - Tratamento de erros com classes especificas
 * - Suporte a FormData para upload de arquivos
 *
 * @example
 * ```ts
 * // GET request
 * const accounts = await apiClient.get<Account[]>('/api/v1/accounts/');
 *
 * // POST request
 * const newAccount = await apiClient.post<Account>('/api/v1/accounts/', {
 *   name: 'Conta Corrente',
 *   balance: '1000.00'
 * });
 *
 * // Upload de arquivo
 * const formData = new FormData();
 * formData.append('file', file);
 * await apiClient.post('/api/v1/archives/', formData);
 * ```
 */
class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<() => void> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Importante: permite enviar cookies httpOnly
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - Os tokens são enviados automaticamente como httpOnly cookies
    // Não precisamos adicionar Authorization header manualmente
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        console.log(
          '[ApiClient] Request to',
          config.url,
          '(tokens enviados via httpOnly cookies)'
        );

        // Se o data é FormData, remove o Content-Type para que o axios defina automaticamente
        // o multipart/form-data com o boundary correto
        if (config.data instanceof FormData) {
          if (config.headers) {
            delete config.headers['Content-Type'];
          }
        }

        return config;
      },
      (error: unknown) => Promise.reject(error instanceof Error ? error : new Error(String(error)))
    );

    // Response interceptor - Handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        // NÃO tenta refresh para endpoints de autenticação
        const authEndpoints = [
          API_CONFIG.ENDPOINTS.LOGIN,
          API_CONFIG.ENDPOINTS.REFRESH_TOKEN,
          API_CONFIG.ENDPOINTS.VERIFY_TOKEN,
          API_CONFIG.ENDPOINTS.REGISTER,
        ];

        const isAuthEndpoint = authEndpoints.some((endpoint) =>
          originalRequest.url?.includes(endpoint)
        );

        // If error is 401 and we haven't retried yet and NOT an auth endpoint
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !isAuthEndpoint
        ) {
          if (this.isRefreshing) {
            // Wait for refresh to complete
            return new Promise((resolve) => {
              this.refreshSubscribers.push(() => {
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            console.log('[ApiClient] Attempting token refresh via httpOnly cookie');

            // O refresh token já está no cookie httpOnly
            // O backend vai lê-lo automaticamente
            await axios.post(
              `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REFRESH_TOKEN}`,
              {},
              { withCredentials: true } // Envia cookies
            );

            console.log('[ApiClient] Token refreshed successfully');

            // Notify all waiting requests
            this.refreshSubscribers.forEach((callback) => callback());
            this.refreshSubscribers = [];

            return this.client(originalRequest);
          } catch (refreshError) {
            console.error('[ApiClient] Token refresh failed:', refreshError);
            this.clearTokens();
            // Não redireciona aqui - deixa o erro ser tratado normalmente
            return Promise.reject(
              new AuthenticationError(
                'Sua sessão expirou. Por favor, faça login novamente.'
              )
            );
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Formata mensagem de erro do Django REST Framework.
   */
  private formatErrorMessage(data: unknown): string {
    if (typeof data === 'string') {
      return data;
    }

    if (data && typeof data === 'object') {
      const errorData = data as DRFErrorResponse;

      if (errorData.detail) {
        return errorData.detail;
      }

      // Handle Django REST Framework validation errors
      const errorMessages: string[] = [];

      for (const [field, errors] of Object.entries(errorData)) {
        if (Array.isArray(errors)) {
          errorMessages.push(`${field}: ${errors.join(', ')}`);
        } else if (typeof errors === 'string') {
          errorMessages.push(`${field}: ${errors}`);
        }
      }

      if (errorMessages.length > 0) {
        return errorMessages.join('\n');
      }
    }

    return 'Ocorreu um erro desconhecido';
  }

  private handleError(error: AxiosError): Error {
    const response = error.response;

    if (!response) {
      return new Error('Erro de rede. Por favor, verifique sua conexão.');
    }

    const data = response.data;

    switch (response.status) {
      case 400: {
        const errorData = data as Record<string, string[]> | undefined;
        return new ValidationError(
          this.formatErrorMessage(data) || 'Erro de validação',
          errorData && typeof errorData === 'object' && !('detail' in errorData)
            ? errorData
            : {}
        );
      }
      case 401:
        return new AuthenticationError(
          this.formatErrorMessage(data) || 'Falha na autenticação'
        );
      case 403:
        return new PermissionError(
          this.formatErrorMessage(data) ||
            'Você não tem permissão para realizar esta ação'
        );
      case 404:
        return new NotFoundError(
          this.formatErrorMessage(data) || 'Recurso não encontrado'
        );
      case 500:
        return new Error(
          this.formatErrorMessage(data) ||
            'Erro interno do servidor. Por favor, tente novamente mais tarde.'
        );
      default:
        return new Error(
          this.formatErrorMessage(data) || `Ocorreu um erro (${response.status})`
        );
    }
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  // NOTA: Os tokens access_token e refresh_token sao httpOnly cookies
  // gerenciados pelo backend. Nao podemos (e nao devemos) acessa-los via JavaScript.
  // Eles sao enviados automaticamente pelo navegador em cada requisicao.

  private tokenValidationCache: { isValid: boolean; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 5000; // 5 segundos

  /**
   * Limpa os cookies de usuario (nao-httpOnly).
   *
   * Os tokens httpOnly (access_token, refresh_token) sao removidos
   * pelo backend durante o logout.
   *
   * @example
   * ```ts
   * // No logout
   * await authService.logout();
   * apiClient.clearTokens();
   * ```
   */
  public clearTokens(): void {
    Cookies.remove('user_data');
    Cookies.remove('user_permissions');
    this.tokenValidationCache = null;
  }

  /**
   * Verifica se o usuario possui um token valido.
   *
   * Usa cache de 5 segundos para evitar multiplas chamadas ao backend.
   * Util para verificar autenticacao antes de renderizar rotas protegidas.
   *
   * @returns Promise<boolean> - true se autenticado, false caso contrario
   *
   * @example
   * ```ts
   * const isAuthenticated = await apiClient.hasValidToken();
   * if (!isAuthenticated) {
   *   navigate('/login');
   * }
   * ```
   */
  public async hasValidToken(): Promise<boolean> {
    // Usa cache se disponivel e recente (menos de 5 segundos)
    if (this.tokenValidationCache) {
      const age = Date.now() - this.tokenValidationCache.timestamp;
      if (age < this.CACHE_DURATION) {
        console.log(
          '[ApiClient] Using cached token validation:',
          this.tokenValidationCache.isValid
        );
        return this.tokenValidationCache.isValid;
      }
    }

    // Verifica se ha um token valido fazendo uma chamada ao endpoint de verify
    try {
      await this.client.post(API_CONFIG.ENDPOINTS.VERIFY_TOKEN);
      this.tokenValidationCache = { isValid: true, timestamp: Date.now() };
      return true;
    } catch {
      this.tokenValidationCache = { isValid: false, timestamp: Date.now() };
      return false;
    }
  }

  // ============================================================================
  // HTTP Methods
  // ============================================================================

  /**
   * Realiza uma requisicao GET.
   *
   * @template T - Tipo de retorno esperado
   * @param url - URL do endpoint (relativo ao BASE_URL)
   * @param params - Parametros de query string opcionais
   * @returns Promise com os dados da resposta
   * @throws {AuthenticationError} Se nao autenticado (401)
   * @throws {PermissionError} Se sem permissao (403)
   * @throws {NotFoundError} Se recurso nao encontrado (404)
   */
  async get<T>(url: string, params?: QueryParams): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  /**
   * Realiza uma requisicao POST.
   *
   * @template T - Tipo de retorno esperado
   * @param url - URL do endpoint (relativo ao BASE_URL)
   * @param data - Dados do corpo da requisicao (objeto ou FormData)
   * @returns Promise com os dados da resposta
   * @throws {ValidationError} Se dados invalidos (400)
   * @throws {AuthenticationError} Se nao autenticado (401)
   * @throws {PermissionError} Se sem permissao (403)
   */
  async post<T>(url: string, data?: RequestData): Promise<T> {
    if (import.meta.env.DEV) {
      console.log('POST Request:', { url, data });
    }
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  /**
   * Realiza uma requisicao PUT (substituicao completa).
   *
   * @template T - Tipo de retorno esperado
   * @param url - URL do endpoint (relativo ao BASE_URL)
   * @param data - Dados do corpo da requisicao
   * @returns Promise com os dados da resposta
   * @throws {ValidationError} Se dados invalidos (400)
   * @throws {NotFoundError} Se recurso nao encontrado (404)
   */
  async put<T>(url: string, data?: RequestData): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  /**
   * Realiza uma requisicao PATCH (atualizacao parcial).
   *
   * @template T - Tipo de retorno esperado
   * @param url - URL do endpoint (relativo ao BASE_URL)
   * @param data - Dados parciais para atualizar
   * @returns Promise com os dados da resposta
   * @throws {ValidationError} Se dados invalidos (400)
   * @throws {NotFoundError} Se recurso nao encontrado (404)
   */
  async patch<T>(url: string, data?: RequestData): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  /**
   * Realiza uma requisicao DELETE.
   *
   * @template T - Tipo de retorno esperado (geralmente void)
   * @param url - URL do endpoint (relativo ao BASE_URL)
   * @returns Promise com os dados da resposta (se houver)
   * @throws {NotFoundError} Se recurso nao encontrado (404)
   * @throws {PermissionError} Se sem permissao (403)
   */
  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  /**
   * Realiza uma requisicao GET que retorna um Blob (para download de arquivos).
   *
   * @param url - URL do endpoint (relativo ao BASE_URL)
   * @returns Promise com o Blob da resposta
   */
  async getBlob(url: string): Promise<Blob> {
    const response = await this.client.get<Blob>(url, { responseType: 'blob' });
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
