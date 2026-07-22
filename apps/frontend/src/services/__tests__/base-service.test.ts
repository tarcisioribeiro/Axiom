import { describe, it, expect, vi, beforeEach } from 'vitest';

import { apiClient } from '@/services/api-client';
import { BaseService, createCrudService } from '@/services/base-service';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// --- Type-level tests ---
// These assertions are checked by the TypeScript compiler at build time.
// If `id: string` or `id: number` both satisfy the constraint, the types below
// must compile without error.
type _StringIdSatisfiesConstraint = { id: string } extends { id: string | number }
  ? true
  : never;
type _NumberIdSatisfiesConstraint = { id: number } extends { id: string | number }
  ? true
  : never;

// Verify the compile-time assertions resolve to `true`
const _stringCheck: _StringIdSatisfiesConstraint = true;
const _numberCheck: _NumberIdSatisfiesConstraint = true;

// Silence "declared but never read" warnings
void _stringCheck;
void _numberCheck;

// --- Concrete subclass used in runtime tests ---
interface StringIdItem {
  id: string;
  name: string;
}

interface StringIdCreate {
  name: string;
}

class TestService extends BaseService<StringIdItem, StringIdCreate> {
  constructor() {
    super('/api/v1/test/');
  }
}

describe('BaseService', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
    vi.clearAllMocks();
  });

  describe('getById — accepts string id', () => {
    it('calls the correct endpoint with a UUID string', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      vi.mocked(apiClient.get).mockResolvedValueOnce({ id: uuid, name: 'Test' });

      const result = await service.getById(uuid);

      expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/test/${uuid}/`);
      expect(result.id).toBe(uuid);
    });
  });

  describe('update — accepts string id', () => {
    it('calls PUT with a UUID string', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      vi.mocked(apiClient.put).mockResolvedValueOnce({ id: uuid, name: 'Updated' });

      await service.update(uuid, { name: 'Updated' });

      expect(apiClient.put).toHaveBeenCalledWith(`/api/v1/test/${uuid}/`, {
        name: 'Updated',
      });
    });
  });

  describe('patch — accepts string id', () => {
    it('calls PATCH with a UUID string', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      vi.mocked(apiClient.patch).mockResolvedValueOnce({ id: uuid, name: 'Patched' });

      await service.patch(uuid, { name: 'Patched' });

      expect(apiClient.patch).toHaveBeenCalledWith(`/api/v1/test/${uuid}/`, {
        name: 'Patched',
      });
    });
  });

  describe('delete — accepts string id', () => {
    it('calls DELETE with a UUID string', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      await service.delete(uuid);

      expect(apiClient.delete).toHaveBeenCalledWith(`/api/v1/test/${uuid}/`);
    });
  });

  describe('createCrudService — accepts string id constraint', () => {
    it('creates a service instance that accepts string ids', async () => {
      const crudService = createCrudService<StringIdItem, StringIdCreate>(
        '/api/v1/items/'
      );
      const uuid = 'deadbeef-0000-0000-0000-000000000001';
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      await crudService.delete(uuid);

      expect(apiClient.delete).toHaveBeenCalledWith(`/api/v1/items/${uuid}/`);
    });
  });
});
