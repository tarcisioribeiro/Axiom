import { apiClient, type RequestData } from './api-client';
import type { PaginatedResponse } from '@/types';

/**
 * Classe base generica para services CRUD.
 *
 * Encapsula operacoes comuns de API:
 * - getAll: Lista todos os recursos (com paginacao)
 * - getById: Busca um recurso por ID
 * - create: Cria um novo recurso
 * - update: Atualiza um recurso existente (PUT)
 * - patch: Atualiza parcialmente um recurso (PATCH)
 * - delete: Remove um recurso
 *
 * @example
 * ```ts
 * // Definir tipos
 * interface Account { id: number; name: string; balance: string; }
 * interface AccountFormData { name:string; balance: string; }
 *
 * // Criar service
 * class AccountsService extends BaseService<Account, AccountFormData> {
 *   constructor() {
 *     super('/api/v1/accounts/');
 *   }
 *
 *   // Metodos adicionais especificos
 *   async getByType(type: string): Promise<Account[]> {
 *     const response = await apiClient.get<PaginatedResponse<Account>>(
 *       `${this.endpoint}?type=${type}`
 *     );
 *     return response.results;
 *   }
 * }
 *
 * export const accountsService = new AccountsService();
 * ```
 */
export abstract class BaseService<
  T extends { id: number },
  CreateData = Partial<T>,
  UpdateData = Partial<CreateData>,
> {
  protected readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  /**
   * Lista todos os recursos.
   * Retorna apenas os resultados da paginacao.
   */
  async getAll(params?: Record<string, unknown>): Promise<T[]> {
    const response = await apiClient.get<PaginatedResponse<T>>(this.endpoint, params);
    return response.results;
  }

  /**
   * Lista todos os recursos com dados de paginacao.
   */
  async getAllPaginated(
    params?: Record<string, unknown>
  ): Promise<PaginatedResponse<T>> {
    return apiClient.get<PaginatedResponse<T>>(this.endpoint, params);
  }

  /**
   * Busca um recurso por ID.
   */
  async getById(id: number): Promise<T> {
    return apiClient.get<T>(`${this.endpoint}${id}/`);
  }

  /**
   * Cria um novo recurso.
   */
  async create(data: CreateData): Promise<T> {
    return apiClient.post<T>(this.endpoint, data as RequestData);
  }

  /**
   * Atualiza um recurso existente (PUT - substituicao completa).
   */
  async update(id: number, data: UpdateData): Promise<T> {
    return apiClient.put<T>(`${this.endpoint}${id}/`, data as RequestData);
  }

  /**
   * Atualiza parcialmente um recurso (PATCH).
   */
  async patch(id: number, data: Partial<UpdateData>): Promise<T> {
    return apiClient.patch<T>(`${this.endpoint}${id}/`, data);
  }

  /**
   * Remove um recurso.
   */
  async delete(id: number): Promise<void> {
    return apiClient.delete(`${this.endpoint}${id}/`);
  }
}

/**
 * Cria um service CRUD simples para um endpoint.
 * Util para recursos que nao precisam de metodos adicionais.
 *
 * @example
 * ```ts
 * const categoriesService = createCrudService<Category, CategoryFormData>(
 *   '/api/v1/categories/'
 * );
 * ```
 */
export function createCrudService<
  T extends { id: number },
  CreateData = Partial<T>,
  UpdateData = CreateData,
>(endpoint: string) {
  return new (class extends BaseService<T, CreateData, UpdateData> {
    constructor() {
      super(endpoint);
    }
  })();
}

export default BaseService;
