import { apiClient } from './api-client';
import { BaseService } from './base-service';
import { API_CONFIG } from '@/config/constants';
import type {
  Password, PasswordFormData, PasswordReveal,
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
class PasswordsService extends BaseService<Password, PasswordFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.PASSWORDS);
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
    return apiClient.get<PasswordReveal>(`${this.endpoint}${id}/reveal/`);
  }

  /**
   * Gera uma senha criptograficamente segura.
   *
   * @param options - Opcoes de geracao (comprimento, tipos de caracteres)
   * @returns Senha gerada com informacao de forca
   */
  async generate(
    options: PasswordGenerateRequest = {}
  ): Promise<PasswordGenerateResponse> {
    return apiClient.post<PasswordGenerateResponse>(
      API_CONFIG.ENDPOINTS.PASSWORD_GENERATE,
      options
    );
  }
}

export const passwordsService = new PasswordsService();
