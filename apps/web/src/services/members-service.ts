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

  async uploadProfilePhoto(file: File): Promise<Member> {
    const formData = new FormData();
    formData.append('profile_photo', file);
    return apiClient.patch<Member>(API_CONFIG.ENDPOINTS.MEMBER_PROFILE_PHOTO, formData);
  }

  async deleteProfilePhoto(): Promise<Member> {
    return apiClient.delete<Member>(API_CONFIG.ENDPOINTS.MEMBER_PROFILE_PHOTO);
  }
}

export const membersService = new MembersService();
