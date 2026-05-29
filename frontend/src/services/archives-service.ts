import { API_CONFIG } from '@/config/constants';
import type { Archive, ArchiveFormData, ArchiveReveal } from '@/types';

import { apiClient } from './api-client';
import { BaseService } from './base-service';

type ArchiveCreateData = ArchiveFormData & { file?: File };
type ArchiveUpdateData = Partial<ArchiveFormData> & { file?: File };

class ArchivesService extends BaseService<
  Archive,
  ArchiveCreateData,
  ArchiveUpdateData
> {
  constructor() {
    super(API_CONFIG.ENDPOINTS.ARCHIVES);
  }

  async create(data: ArchiveCreateData): Promise<Archive> {
    const formData = new FormData();

    formData.append('title', data.title);
    formData.append('category', data.category);
    formData.append('archive_type', data.archive_type);
    formData.append('owner', data.owner.toString());

    if (data.text_content) formData.append('text_content', data.text_content);
    if (data.notes) formData.append('notes', data.notes);
    if (data.tags) {
      data.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((tag) => formData.append('tags', tag));
    }
    if (data.file) formData.append('encrypted_file', data.file);

    // Axios automatically sets Content-Type to multipart/form-data when FormData is passed
    return apiClient.post<Archive>(this.endpoint, formData);
  }

  async update(id: number, data: ArchiveUpdateData): Promise<Archive> {
    const formData = new FormData();

    if (data.title !== undefined) formData.append('title', data.title);
    if (data.category !== undefined) formData.append('category', data.category);
    if (data.archive_type !== undefined)
      formData.append('archive_type', data.archive_type);
    if (data.owner !== undefined) formData.append('owner', data.owner.toString());
    if (data.text_content !== undefined)
      formData.append('text_content', data.text_content);
    if (data.notes !== undefined) formData.append('notes', data.notes);
    if (data.tags !== undefined) {
      data.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((tag) => formData.append('tags', tag));
    }
    if (data.file) formData.append('encrypted_file', data.file);

    // Axios automatically sets Content-Type to multipart/form-data when FormData is passed
    return apiClient.put<Archive>(`${this.endpoint}${id}/`, formData);
  }

  async reveal(id: number): Promise<ArchiveReveal> {
    return apiClient.get<ArchiveReveal>(`${this.endpoint}${id}/reveal/`);
  }

  async getDownloadUrl(id: number): Promise<{ url: string; filename: string }> {
    return apiClient.get<{ url: string; filename: string }>(
      `${this.endpoint}${id}/download/`
    );
  }
}

export const archivesService = new ArchivesService();
