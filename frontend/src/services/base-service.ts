import type { PaginatedResponse } from '@/types';

import { apiClient, type RequestData } from './api-client';

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
 * interface Account { id: string; name: string; balance: string; }
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
  T extends { id: string | number },
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
   * Lista todos os recursos percorrendo todas as paginas automaticamente.
   * Util quando o total de registros pode exceder o PAGE_SIZE do backend (50).
   */
  async getAllPages(params?: Record<string, unknown>): Promise<T[]> {
    const first = await apiClient.get<PaginatedResponse<T>>(this.endpoint, params);
    const results = [...first.results];

    let nextUrl = first.next;
    while (nextUrl) {
      const page = await apiClient.get<PaginatedResponse<T>>(nextUrl);
      results.push(...page.results);
      nextUrl = page.next;
    }

    return results;
  }

  /**
   * Busca um recurso por ID.
   */
  async getById(id: string | number): Promise<T> {
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
  async update(id: string | number, data: UpdateData): Promise<T> {
    return apiClient.put<T>(`${this.endpoint}${id}/`, data as RequestData);
  }

  /**
   * Atualiza parcialmente um recurso (PATCH).
   */
  async patch(id: string | number, data: Partial<UpdateData>): Promise<T> {
    return apiClient.patch<T>(`${this.endpoint}${id}/`, data);
  }

  /**
   * Remove um recurso.
   */
  async delete(id: string | number): Promise<void> {
    return apiClient.delete(`${this.endpoint}${id}/`);
  }

  /**
   * Cria múltiplos recursos em paralelo.
   * Envia uma requisição POST por item de forma concorrente.
   */
  async batchCreate(items: CreateData[]): Promise<T[]> {
    return Promise.all(items.map((item) => this.create(item)));
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
  T extends { id: string | number },
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
