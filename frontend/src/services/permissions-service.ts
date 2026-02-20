import { API_CONFIG } from '@/config/constants';

import { apiClient } from './api-client';

export interface Permission {
  id: number;
  name: string;
  codename: string;
  app: string;
}

export interface PermissionsByApp {
  [app: string]: Permission[];
}

export interface MemberPermissionsResponse {
  permissions: string[];
}

export interface UpdatePermissionsRequest {
  permission_codenames: string[];
}

export interface UpdatePermissionsResponse {
  message: string;
  permissions: string[];
}

class PermissionsService {
  /**
   * Obtém todas as permissões disponíveis organizadas por app
   */
  async getAvailablePermissions(): Promise<PermissionsByApp> {
    return apiClient.get<PermissionsByApp>(API_CONFIG.ENDPOINTS.AVAILABLE_PERMISSIONS);
  }

  /**
   * Obtém as permissões de um membro específico
   */
  async getMemberPermissions(memberId: number): Promise<MemberPermissionsResponse> {
    return apiClient.get<MemberPermissionsResponse>(
      `${API_CONFIG.ENDPOINTS.MEMBERS}${memberId}/permissions/`
    );
  }

  /**
   * Atualiza as permissões de um membro específico
   */
  async updateMemberPermissions(
    memberId: number,
    permissionCodenames: string[]
  ): Promise<UpdatePermissionsResponse> {
    const data: UpdatePermissionsRequest = {
      permission_codenames: permissionCodenames,
    };

    return apiClient.put<UpdatePermissionsResponse>(
      `${API_CONFIG.ENDPOINTS.MEMBERS}${memberId}/permissions/update/`,
      data
    );
  }
}

export const permissionsService = new PermissionsService();
