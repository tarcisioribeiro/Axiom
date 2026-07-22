import { API_CONFIG } from '@/config/constants';

import { apiClient } from './api-client';

export type ImportFormat =
  | 'bitwarden_json'
  | 'lastpass_csv'
  | 'onepassword_csv'
  | 'dashlane_csv'
  | 'keepass_xml';

export interface ImportPreviewEntry {
  index: number;
  title: string;
  username: string;
  password: string;
  site: string;
  category: string;
  suggested_category: string;
  notes: string;
  is_duplicate: boolean;
}

export interface ImportPreviewResponse {
  format: ImportFormat;
  total: number;
  duplicates_count: number;
  entries: ImportPreviewEntry[];
}

export interface ImportConfirmEntry {
  title: string;
  username: string;
  password: string;
  site: string;
  category: string;
  notes: string;
}

export interface ImportConfirmResponse {
  imported: number;
  duplicates_skipped: number;
  errors: number;
}

class PasswordImportService {
  async preview(file: File, format: ImportFormat): Promise<ImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    return apiClient.post<ImportPreviewResponse>(
      API_CONFIG.ENDPOINTS.PASSWORD_IMPORT_PREVIEW,
      formData
    );
  }

  async confirm(
    entries: ImportConfirmEntry[],
    categoryMapping?: Record<string, string>
  ): Promise<ImportConfirmResponse> {
    return apiClient.post<ImportConfirmResponse>(
      API_CONFIG.ENDPOINTS.PASSWORD_IMPORT_CONFIRM,
      { entries, category_mapping: categoryMapping ?? {} }
    );
  }
}

export const passwordImportService = new PasswordImportService();
