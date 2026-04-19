import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useCrudPage } from '@/hooks/use-crud-page';
import type { CrudService } from '@/hooks/use-crud-page';

// vi.hoisted ensures these are defined before vi.mock factories run
const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn().mockReturnValue({ id: '1', dismiss: vi.fn(), update: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ToastAction is used via React.createElement — mock it as a minimal React component
vi.mock('@/components/ui/toast', () => ({
  ToastAction: vi.fn(),
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
    mockToast.mockReturnValue({ id: '1', dismiss: vi.fn(), update: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('handleSubmit (update) applies change optimistically and closes dialog before API call', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleEdit({ id: 1, name: 'Item 1' });
    });

    // service.update resolves after we can inspect state
    let resolveUpdate!: (value: TestItem) => void;
    vi.mocked(service.update).mockImplementation(
      (_id) =>
        new Promise<TestItem>((res) => {
          resolveUpdate = (data) => res(data);
        })
    );

    // Start submit — do NOT await yet
    act(() => {
      void result.current.handleSubmit({ name: 'Atualizado' });
    });

    // Dialog should be closed optimistically
    expect(result.current.isDialogOpen).toBe(false);
    // Item should reflect the optimistic value
    expect(result.current.items.find((i) => i.id === 1)?.name).toBe('Atualizado');

    // Resolve the API call
    await act(async () => {
      resolveUpdate({ id: 1, name: 'Atualizado' });
    });
  });

  it('handleSubmit (update) reverts item when API call fails', async () => {
    vi.mocked(service.update).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleEdit({ id: 1, name: 'Item 1' });
    });

    await act(async () => {
      await result.current.handleSubmit({ name: 'Falhou' });
    });

    // Item should be reverted to original
    expect(result.current.items.find((i) => i.id === 1)?.name).toBe('Item 1');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('handleDelete removes item immediately (optimistic) without calling service.delete', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(2);

    // Switch to fake timers AFTER data is loaded so waitFor above doesn't hang
    vi.useFakeTimers();

    act(() => {
      void result.current.handleDelete(1);
    });

    // Item removed immediately
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items.find((i) => i.id === 1)).toBeUndefined();
    // Service.delete NOT called yet
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('handleDelete calls service.delete after the 5-second undo window expires', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();

    act(() => {
      void result.current.handleDelete(1);
    });

    expect(service.delete).not.toHaveBeenCalled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(service.delete).toHaveBeenCalledWith(1);
  });

  it('handleDelete shows a toast with an undo action', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();

    act(() => {
      void result.current.handleDelete(1);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.anything() })
    );
  });

  it('handleDelete restores item when undo is clicked before timer fires', async () => {
    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();

    act(() => {
      void result.current.handleDelete(1);
    });

    expect(result.current.items).toHaveLength(1);

    // Extract the undo click handler from the React element passed as `action`
    const toastArg = mockToast.mock.lastCall?.[0] as {
      action: { props: { onClick: () => void } };
    };
    const undoClick = toastArg.action.props.onClick;

    act(() => {
      undoClick();
    });

    // Item should be restored
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.find((i) => i.id === 1)).toBeDefined();

    // Timer fires but delete should NOT be called
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(service.delete).not.toHaveBeenCalled();
  });

  it('handleDelete restores item when API delete fails after undo window', async () => {
    vi.mocked(service.delete).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();

    act(() => {
      void result.current.handleDelete(1);
    });

    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Item should be restored after error
    expect(result.current.items).toHaveLength(2);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
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
      expect.objectContaining({ title: 'Conta criado(a) com sucesso' })
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

  it('handleSubmit (create) shows error toast when API call fails', async () => {
    vi.mocked(service.create).mockRejectedValueOnce(new Error('Create error'));

    const { result } = renderHook(() => useCrudPage(service, { resourceName: 'item' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleCreate();
    });

    await act(async () => {
      await result.current.handleSubmit({ name: 'Falhou criação' });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
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
