import { apiClient } from './api-client';
import { API_CONFIG } from '@/config/constants';
import type { Archive, ArchiveFormData, ArchiveReveal, PaginatedResponse } from '@/types';

class ArchivesService {
  async getAll(): Promise<Archive[]> {
    const response = await apiClient.get<PaginatedResponse<Archive>>(API_CONFIG.ENDPOINTS.ARCHIVES);
    return response.results;
  }

  async getById(id: number): Promise<Archive> {
    return apiClient.get<Archive>(`${API_CONFIG.ENDPOINTS.ARCHIVES}${id}/`);
  }

  async create(data: ArchiveFormData & { file?: File }): Promise<Archive> {
    const formData = new FormData();

    // Append all form fields
    formData.append('title', data.title);
    formData.append('category', data.category);
    formData.append('archive_type', data.archive_type);
    formData.append('owner', data.owner.toString());

    if (data.text_content) formData.append('text_content', data.text_content);
    if (data.notes) formData.append('notes', data.notes);
    if (data.tags) formData.append('tags', data.tags);
    if (data.file) formData.append('encrypted_file', data.file);

    // Axios automatically sets Content-Type to multipart/form-data when FormData is passed
    return apiClient.post<Archive>(API_CONFIG.ENDPOINTS.ARCHIVES, formData);
  }

  async update(id: number, data: Partial<ArchiveFormData> & { file?: File }): Promise<Archive> {
    const formData = new FormData();

    // Append only provided fields
    if (data.title !== undefined) formData.append('title', data.title);
    if (data.category !== undefined) formData.append('category', data.category);
    if (data.archive_type !== undefined) formData.append('archive_type', data.archive_type);
    if (data.owner !== undefined) formData.append('owner', data.owner.toString());
    if (data.text_content !== undefined) formData.append('text_content', data.text_content);
    if (data.notes !== undefined) formData.append('notes', data.notes);
    if (data.tags !== undefined) formData.append('tags', data.tags);
    if (data.file) formData.append('encrypted_file', data.file);

    // Axios automatically sets Content-Type to multipart/form-data when FormData is passed
    return apiClient.put<Archive>(`${API_CONFIG.ENDPOINTS.ARCHIVES}${id}/`, formData);
  }

  async delete(id: number): Promise<void> {
    return apiClient.delete(`${API_CONFIG.ENDPOINTS.ARCHIVES}${id}/`);
  }

  async reveal(id: number): Promise<ArchiveReveal> {
    return apiClient.get<ArchiveReveal>(`${API_CONFIG.ENDPOINTS.ARCHIVES}${id}/reveal/`);
  }

  async download(id: number): Promise<Blob> {
    return apiClient.getBlob(`${API_CONFIG.ENDPOINTS.ARCHIVES}${id}/download/`);
  }
}

export const archivesService = new ArchivesService();
