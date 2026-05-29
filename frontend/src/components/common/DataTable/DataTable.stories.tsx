import type { Meta, StoryObj } from '@storybook/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { DataTable, type Column } from './DataTable';

interface SampleRow {
  id: number;
  name: string;
  category: string;
  amount: string;
  date: string;
}

const sampleData: SampleRow[] = [
  {
    id: 1,
    name: 'Supermercado',
    category: 'Alimentação',
    amount: 'R$ 320,00',
    date: '01/03/2026',
  },
  {
    id: 2,
    name: 'Aluguel',
    category: 'Moradia',
    amount: 'R$ 1.500,00',
    date: '05/03/2026',
  },
  {
    id: 3,
    name: 'Plano de saúde',
    category: 'Saúde',
    amount: 'R$ 480,00',
    date: '10/03/2026',
  },
  {
    id: 4,
    name: 'Internet',
    category: 'Serviços',
    amount: 'R$ 99,00',
    date: '15/03/2026',
  },
  {
    id: 5,
    name: 'Gasolina',
    category: 'Transporte',
    amount: 'R$ 250,00',
    date: '18/03/2026',
  },
];

const columns: Column<SampleRow>[] = [
  { key: 'name', label: 'Descrição', sortable: true },
  { key: 'category', label: 'Categoria' },
  {
    key: 'amount',
    label: 'Valor',
    align: 'right',
    render: (item) => (
      <span className="font-medium text-destructive">{item.amount}</span>
    ),
  },
  { key: 'date', label: 'Data', align: 'center' },
];

const meta: Meta<typeof DataTable<SampleRow>> = {
  title: 'Common/DataTable',
  component: DataTable,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DataTable<SampleRow>>;

export const WithData: Story = {
  render: () => (
    <DataTable data={sampleData} columns={columns} keyExtractor={(item) => item.id} />
  ),
};

export const Loading: Story = {
  render: () => (
    <DataTable data={[]} columns={columns} keyExtractor={(item) => item.id} isLoading />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      data={[]}
      columns={columns}
      keyExtractor={(item) => item.id}
      emptyState={{
        title: 'Nenhuma despesa',
        message: 'Adicione sua primeira despesa para começar.',
        action: { label: 'Adicionar', onClick: () => alert('Nova despesa') },
      }}
    />
  ),
};

export const WithActions: Story = {
  render: () => (
    <DataTable
      data={sampleData}
      columns={columns}
      keyExtractor={(item) => item.id}
      actions={(item) => (
        <div className="flex justify-end gap-sm">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar ${item.name}`}
            onClick={() => alert(`Editar: ${item.name}`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Excluir ${item.name}`}
            onClick={() => alert(`Excluir: ${item.name}`)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}
    />
  ),
};

export const WithSorting: Story = {
  render: () => {
    const [sort, setSort] = useState<{
      column: string | null;
      direction: 'asc' | 'desc' | null;
    }>({
      column: null,
      direction: null,
    });

    const handleSort = (column: string) => {
      setSort((prev) => ({
        column,
        direction:
          prev.column === column ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc',
      }));
    };

    const sorted = [...sampleData].sort((a, b) => {
      if (!sort.column) return 0;
      const valA = String(a[sort.column as keyof SampleRow]);
      const valB = String(b[sort.column as keyof SampleRow]);
      return sort.direction === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });

    return (
      <DataTable
        data={sorted}
        columns={columns}
        keyExtractor={(item) => item.id}
        sorting={{ column: sort.column, direction: sort.direction, onSort: handleSort }}
      />
    );
  },
};

export const WithPagination: Story = {
  render: () => {
    const [page, setPage] = useState(1);
    return (
      <DataTable
        data={sampleData.slice((page - 1) * 3, page * 3)}
        columns={columns}
        keyExtractor={(item) => item.id}
        pagination={{
          page,
          pageSize: 3,
          total: sampleData.length,
          onPageChange: setPage,
        }}
      />
    );
  },
};
