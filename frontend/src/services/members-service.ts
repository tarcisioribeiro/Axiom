import { API_CONFIG } from '@/config/constants';
import type { Member, MemberFinancialReport, MemberFormData } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

export interface MemberReportParams {
  start_date?: string;
  end_date?: string;
}

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

  async getFinancialReport(
    memberId: number,
    params?: MemberReportParams
  ): Promise<MemberFinancialReport> {
    const url = API_CONFIG.ENDPOINTS.MEMBER_FINANCIAL_REPORT.replace(
      ':id',
      String(memberId)
    );
    return apiClient.get<MemberFinancialReport>(url, params as Record<string, unknown>);
  }

  async exportFinancialReportCsv(
    memberId: number,
    params?: MemberReportParams
  ): Promise<void> {
    const url = API_CONFIG.ENDPOINTS.MEMBER_FINANCIAL_REPORT.replace(
      ':id',
      String(memberId)
    );
    const blob = await apiClient.getBlob(url, {
      ...(params as Record<string, unknown>),
      export_format: 'csv',
    });
    const date = new Date().toISOString().split('T')[0];
    const filename = `relatorio_membro_${memberId}_${date}.csv`;
    triggerDownload(blob, filename);
  }
}

export const membersService = new MembersService();

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
