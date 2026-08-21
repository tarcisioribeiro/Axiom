import { describe, it, expect, vi, beforeEach } from 'vitest';

import { apiClient } from '@/services/api-client';
import { loansService } from '@/services/loans-service';
import type { LoanFormData } from '@/types';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const baseFormData: LoanFormData = {
  description: 'Aporte Sicoob',
  value: 1000,
  payed_value: 0,
  date: '2026-08-21',
  horary: '10:00',
  category: 'loans',
  account: 1,
  benefited: 1,
  creditor: 2,
  payed: false,
  loan_type: 'borrowed',
};

describe('loansService', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.post).mockResolvedValue({});
  });

  it('sends loan_type in the FormData payload on create', async () => {
    await loansService.create(baseFormData);

    const sentFormData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(sentFormData.get('loan_type')).toBe('borrowed');
  });

  it('omits loan_type from the payload when not set', async () => {
    await loansService.create({ ...baseFormData, loan_type: undefined });

    const sentFormData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(sentFormData.get('loan_type')).toBeNull();
  });
});
