import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import Cookies from 'js-cookie';

import { API_CONFIG } from '@/config/constants';
import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';

import {
  AuthenticationError,
  handleAxiosError,
  type QueryParams,
  type RequestData,
} from './api-errors';

export type { RequestData, QueryParams };
export {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  PermissionError,
} from './api-errors';

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<() => void> = [];
  private tokenValidationCache: { isValid: boolean; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 5000;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      timeout: REQUEST_TIMEOUT_MS,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        logger.log('[ApiClient] Request to', config.url);

        if (config.data instanceof FormData) {
          if (config.headers) {
            delete config.headers['Content-Type'];
          }
        }

        return config;
      },
      (error: unknown) =>
        Promise.reject(error instanceof Error ? error : new Error(String(error)))
    );

    this.client.interceptors.response.use(
      (response) => {
        const method = response.config.method?.toUpperCase();
        if (method && method !== 'GET') {
          void queryClient.invalidateQueries();
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
          _retryCount?: number;
        };

        const isNetworkError = !error.response && !axios.isCancel(error);
        if (isNetworkError) {
          originalRequest._retryCount = (originalRequest._retryCount ?? 0) + 1;
          if (originalRequest._retryCount <= MAX_RETRIES) {
            const delayMs = Math.pow(2, originalRequest._retryCount - 1) * 1000;
            logger.log(
              `[ApiClient] Network error, retry ${originalRequest._retryCount}/${MAX_RETRIES} in ${delayMs}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return this.client(originalRequest);
          }
        }

        if (error.response?.status === 429) {
          originalRequest._retryCount = (originalRequest._retryCount ?? 0) + 1;
          if (originalRequest._retryCount <= MAX_RETRIES) {
            const retryAfterHeader = error.response.headers?.['retry-after'] as
              | string
              | undefined;
            const delayMs = retryAfterHeader
              ? parseInt(retryAfterHeader, 10) * 1000
              : Math.pow(2, originalRequest._retryCount) * 1000;
            logger.log(
              `[ApiClient] Rate limited (429), retry ${originalRequest._retryCount}/${MAX_RETRIES} in ${delayMs}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return this.client(originalRequest);
          }
        }

        const authEndpoints = [
          API_CONFIG.ENDPOINTS.LOGIN,
          API_CONFIG.ENDPOINTS.REFRESH_TOKEN,
          API_CONFIG.ENDPOINTS.VERIFY_TOKEN,
          API_CONFIG.ENDPOINTS.REGISTER,
        ];

        const isAuthEndpoint = authEndpoints.some((endpoint) =>
          originalRequest.url?.includes(endpoint)
        );

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !isAuthEndpoint
        ) {
          if (this.isRefreshing) {
            return new Promise((resolve) => {
              this.refreshSubscribers.push(() => {
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            logger.log('[ApiClient] Attempting token refresh via httpOnly cookie');

            await axios.post(
              `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REFRESH_TOKEN}`,
              {},
              { withCredentials: true }
            );

            logger.log('[ApiClient] Token refreshed successfully');

            this.refreshSubscribers.forEach((callback) => callback());
            this.refreshSubscribers = [];

            return this.client(originalRequest);
          } catch (refreshError) {
            logger.error('[ApiClient] Token refresh failed:', refreshError);
            this.clearTokens();
            return Promise.reject(
              new AuthenticationError(
                'Sua sessão expirou. Por favor, faça login novamente.'
              )
            );
          } finally {
            this.isRefreshing = false;
          }
        }

        if (error.response?.data instanceof Blob && error.response.data.size > 0) {
          try {
            const text = await error.response.data.text();
            error.response.data = JSON.parse(text);
          } catch {
            // Leave as Blob if parsing fails
          }
        }

        return Promise.reject(handleAxiosError(error));
      }
    );
  }

  public clearTokens(): void {
    Cookies.remove('user_data');
    Cookies.remove('user_permissions');
    this.tokenValidationCache = null;
  }

  public async hasValidToken(): Promise<boolean> {
    if (this.tokenValidationCache) {
      const age = Date.now() - this.tokenValidationCache.timestamp;
      if (age < this.CACHE_DURATION) {
        logger.log(
          '[ApiClient] Using cached token validation:',
          this.tokenValidationCache.isValid
        );
        return this.tokenValidationCache.isValid;
      }
    }

    try {
      await this.client.post(API_CONFIG.ENDPOINTS.VERIFY_TOKEN);
      this.tokenValidationCache = { isValid: true, timestamp: Date.now() };
      return true;
    } catch {
      this.tokenValidationCache = { isValid: false, timestamp: Date.now() };
      return false;
    }
  }

  async get<T>(url: string, params?: QueryParams): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: RequestData): Promise<T> {
    logger.log('POST Request:', { url, data });
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: RequestData): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: RequestData): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  async getBlob(url: string, params?: QueryParams): Promise<Blob> {
    const response = await this.client.get<Blob>(url, {
      responseType: 'blob',
      params,
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();
