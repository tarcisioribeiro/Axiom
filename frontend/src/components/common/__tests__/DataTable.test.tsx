import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { DataTable } from '@/components/common/DataTable/DataTable';
import type { Column } from '@/components/common/DataTable/DataTable';

type Item = { id: number; name: string; value: number };

const columns: Column<Item>[] = [
  { key: 'name', label: 'Nome' },
  { key: 'value', label: 'Valor', align: 'right' },
];

const items: Item[] = [
  { id: 1, name: 'Alpha', value: 100 },
  { id: 2, name: 'Beta', value: 200 },
];

const keyExtractor = (item: Item) => item.id;

describe('DataTable', () => {
  describe('loading state', () => {
    it('does not render data rows when isLoading is true', () => {
      render(
        <DataTable
          data={items}
          columns={columns}
          keyExtractor={keyExtractor}
          isLoading
        />
      );
      // Real item text should not appear — only skeleton placeholders
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
      expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    });

    it('renders a loading indicator (aria-busy) when isLoading is true', () => {
      const { container } = render(
        <DataTable data={[]} columns={columns} keyExtractor={keyExtractor} isLoading />
      );
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders default empty message when data is empty and no emptyState prop', () => {
      render(<DataTable data={[]} columns={columns} keyExtractor={keyExtractor} />);
      expect(screen.getByText('Nenhum registro encontrado.')).toBeInTheDocument();
    });

    it('renders custom EmptyState when emptyState prop is provided', () => {
      render(
        <DataTable
          data={[]}
          columns={columns}
          keyExtractor={keyExtractor}
          emptyState={{ message: 'Nenhuma conta cadastrada' }}
        />
      );
      expect(screen.getByText('Nenhuma conta cadastrada')).toBeInTheDocument();
    });

    it('renders EmptyState with title when provided', () => {
      render(
        <DataTable
          data={[]}
          columns={columns}
          keyExtractor={keyExtractor}
          emptyState={{ title: 'Vazio', message: 'Nenhum dado' }}
        />
      );
      expect(screen.getByText('Vazio')).toBeInTheDocument();
      expect(screen.getByText('Nenhum dado')).toBeInTheDocument();
    });

    it('renders EmptyState action button when provided', () => {
      const onClick = vi.fn();
      render(
        <DataTable
          data={[]}
          columns={columns}
          keyExtractor={keyExtractor}
          emptyState={{
            message: 'Nenhum dado',
            action: { label: 'Criar', onClick },
          }}
        />
      );
      expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
    });
  });

  describe('table rendering', () => {
    it('renders a table when data is provided', () => {
      render(<DataTable data={items} columns={columns} keyExtractor={keyExtractor} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders column headers', () => {
      render(<DataTable data={items} columns={columns} keyExtractor={keyExtractor} />);
      expect(screen.getByText('Nome')).toBeInTheDocument();
      expect(screen.getByText('Valor')).toBeInTheDocument();
    });

    it('renders a row for each data item', () => {
      render(<DataTable data={items} columns={columns} keyExtractor={keyExtractor} />);
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(items.length + 1); // +1 for header
    });

    it('renders cell content via custom render function', () => {
      const customColumns: Column<Item>[] = [
        {
          key: 'name',
          label: 'Nome',
          render: (item) => (
            <span data-testid={`name-${item.id}`}>{item.name.toUpperCase()}</span>
          ),
        },
      ];
      render(
        <DataTable data={items} columns={customColumns} keyExtractor={keyExtractor} />
      );
      expect(screen.getByTestId('name-1')).toHaveTextContent('ALPHA');
    });

    it('renders actions column header when actions prop is provided', () => {
      render(
        <DataTable
          data={items}
          columns={columns}
          keyExtractor={keyExtractor}
          actions={() => <button>Editar</button>}
        />
      );
      expect(screen.getByText('Ações')).toBeInTheDocument();
    });

    it('renders actions for each row', () => {
      render(
        <DataTable
          data={items}
          columns={columns}
          keyExtractor={keyExtractor}
          actions={(item) => <button data-testid={`action-${item.id}`}>Editar</button>}
        />
      );
      expect(screen.getByTestId('action-1')).toBeInTheDocument();
      expect(screen.getByTestId('action-2')).toBeInTheDocument();
    });

    it('does not render actions column when actions prop is not provided', () => {
      render(<DataTable data={items} columns={columns} keyExtractor={keyExtractor} />);
      expect(screen.queryByText('Ações')).not.toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('renders pagination info when pagination prop is provided', () => {
      render(
        <DataTable
          data={items}
          columns={columns}
          keyExtractor={keyExtractor}
          pagination={{
            page: 1,
            pageSize: 10,
            total: 25,
            onPageChange: vi.fn(),
          }}
        />
      );
      expect(screen.getByText(/25 registros/)).toBeInTheDocument();
    });
  });
});
