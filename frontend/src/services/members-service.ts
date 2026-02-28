import { API_CONFIG } from '@/config/constants';
import type { Member, MemberFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

class MembersService extends BaseService<Member, MemberFormData> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.MEMBERS);
  }

  async getCurrentUserMember(): Promise<Member> {
    return apiClient.get<Member>(API_CONFIG.ENDPOINTS.CURRENT_USER_MEMBER);
  }
}

export const membersService = new MembersService();
