import { apiClient } from './api-client';
import { API_CONFIG } from '@/config/constants';
import type {
  Password, PasswordFormData, PasswordReveal, PaginatedResponse,
  PasswordGenerateRequest, PasswordGenerateResponse,
} from '@/types';

/**
 * Servico para gerenciamento de senhas armazenadas.
 *
 * As senhas sao armazenadas criptografadas no backend.
 * O metodo `reveal` descriptografa e retorna a senha real.
 *
 * IMPORTANTE: Cada chamada a `reveal` e registrada no log de auditoria.
 *
 * @example
 * ```ts
 * // Listar senhas (sem revelar valores)
 * const passwords = await passwordsService.getAll();
 *
 * // Revelar senha (logado em auditoria)
 * const { password } = await passwordsService.reveal(id);
 * ```
 */
class PasswordsService {
  /**
   * Lista todas as senhas do usuario.
   * As senhas retornadas NAO incluem o valor real (criptografado).
   */
  async getAll(): Promise<Password[]> {
    const response = await apiClient.get<PaginatedResponse<Password>>(API_CONFIG.ENDPOINTS.PASSWORDS);
    return response.results;
  }

  /**
   * Busca uma senha por ID (sem revelar valor).
   */
  async getById(id: number): Promise<Password> {
    return apiClient.get<Password>(`${API_CONFIG.ENDPOINTS.PASSWORDS}${id}/`);
  }

  /**
   * Cria uma nova senha armazenada.
   * O valor e criptografado antes de salvar.
   */
  async create(data: PasswordFormData): Promise<Password> {
    return apiClient.post<Password>(API_CONFIG.ENDPOINTS.PASSWORDS, data);
  }

  /**
   * Atualiza uma senha existente.
   */
  async update(id: number, data: Partial<PasswordFormData>): Promise<Password> {
    return apiClient.put<Password>(`${API_CONFIG.ENDPOINTS.PASSWORDS}${id}/`, data);
  }

  /**
   * Remove uma senha (soft delete).
   */
  async delete(id: number): Promise<void> {
    return apiClient.delete(`${API_CONFIG.ENDPOINTS.PASSWORDS}${id}/`);
  }

  /**
   * Revela a senha descriptografada.
   *
   * ATENCAO: Esta acao e registrada no log de auditoria
   * para fins de seguranca e conformidade.
   *
   * @param id - ID da senha
   * @returns Dados da senha incluindo o valor descriptografado
   */
  async reveal(id: number): Promise<PasswordReveal> {
    return apiClient.get<PasswordReveal>(`${API_CONFIG.ENDPOINTS.PASSWORDS}${id}/reveal/`);
  }

  /**
   * Gera uma senha criptograficamente segura.
   *
   * @param options - Opcoes de geracao (comprimento, tipos de caracteres)
   * @returns Senha gerada com informacao de forca
   */
  async generate(options: PasswordGenerateRequest = {}): Promise<PasswordGenerateResponse> {
    return apiClient.post<PasswordGenerateResponse>(API_CONFIG.ENDPOINTS.PASSWORD_GENERATE, options);
  }
}

export const passwordsService = new PasswordsService();
