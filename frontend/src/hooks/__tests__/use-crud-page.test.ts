import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useCrudPage } from '@/hooks/use-crud-page';
import type { CrudService } from '@/hooks/use-crud-page';

// vi.hoisted ensures these are defined before vi.mock factories run
const { mockToast, mockShowConfirm } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockShowConfirm: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/use-alert-dialog', () => ({
  useAlertDialog: () => ({ showConfirm: mockShowConfirm }),
}));

type TestItem = { id: number; name: string };
type TestCreate = Omit<TestItem, 'id'>;

function createMockService(): CrudService<TestItem, TestCreate> {
  return {
    getAll: vi.fn().mockResolvedValue([
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ]),
    create: vi
      .fn()
      .mockImplementation((data: TestCreate) => Promise.resolve({ id: 3, ...data })),
    update: vi
      .fn()
      .mockImplementation((id: number, data: TestCreate) =>
        Promise.resolve({ id, ...data })
      ),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('useCrudPage', () => {
  let service: CrudService<TestItem, TestCreate>;

  beforeEach(() => {
    service = createMockService();
    mockToast.mockClear();
    mockShowConfirm.mockClear();
    mockShowConfirm.mockResolvedValue(true);
  });

  it('starts with isLoading=true and loads items on mount', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(2);
    expect(service.getAll).toHaveBeenCalledOnce();
  });

  it('starts with dialog closed and no selected item', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.selectedItem).toBeUndefined();
  });

  it('handleCreate opens dialog with no selectedItem', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleCreate();
    });

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.selectedItem).toBeUndefined();
  });

  it('handleEdit opens dialog with the selected item', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const item = { id: 1, name: 'Item 1' };
    act(() => {
      result.current.handleEdit(item);
    });

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.selectedItem).toEqual(item);
  });

  it('closeDialog resets dialog state', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleCreate();
    });
    expect(result.current.isDialogOpen).toBe(true);

    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.selectedItem).toBeUndefined();
  });

  it('handleSubmit calls service.create when no selectedItem', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleCreate();
    });

    await act(async () => {
      await result.current.handleSubmit({ name: 'Novo item' });
    });

    expect(service.create).toHaveBeenCalledWith({ name: 'Novo item' });
    expect(service.update).not.toHaveBeenCalled();
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('handleSubmit calls service.update when selectedItem is set', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleEdit({ id: 1, name: 'Item 1' });
    });

    await act(async () => {
      await result.current.handleSubmit({ name: 'Atualizado' });
    });

    expect(service.update).toHaveBeenCalledWith(1, { name: 'Atualizado' });
    expect(service.create).not.toHaveBeenCalled();
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('handleDelete calls service.delete after confirmation', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleDelete(1);
    });

    expect(mockShowConfirm).toHaveBeenCalledOnce();
    expect(service.delete).toHaveBeenCalledWith(1);
  });

  it('handleDelete does not call service.delete when cancelled', async () => {
    mockShowConfirm.mockResolvedValue(false);

    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleDelete(1);
    });

    expect(mockShowConfirm).toHaveBeenCalledOnce();
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('shows a destructive toast when loadData fails', async () => {
    vi.mocked(service.getAll).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
    expect(result.current.items).toHaveLength(0);
  });

  it('shows a success toast after creating an item', async () => {
    const { result } = renderHook(() =>
      useCrudPage(service, { resourceName: 'conta' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleCreate();
    });

    await act(async () => {
      await result.current.handleSubmit({ name: 'Nova conta' });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'default' })
    );
  });

  it('uses custom resourceNamePlural in error messages', async () => {
    vi.mocked(service.getAll).mockRejectedValue(new Error('Fail'));

    const { result } = renderHook(() =>
      useCrudPage(service, { resourceName: 'conta', resourceNamePlural: 'contas' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Erro ao carregar contas' })
    );
  });

  it('calls onSuccess callback after a successful create', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useCrudPage(service, { resourceName: 'item', onSuccess })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleCreate();
    });

    await act(async () => {
      await result.current.handleSubmit({ name: 'Novo' });
    });

    expect(onSuccess).toHaveBeenCalledWith(
      'create',
      expect.objectContaining({ name: 'Novo' })
    );
  });

  it('refresh reloads items from service', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(service.getAll).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.refresh();
    });

    expect(service.getAll).toHaveBeenCalledTimes(2);
  });
});
