/**
 * Componente para renderizar respostas do AI Assistant.
 *
 * Suporta diferentes tipos de exibição: texto, tabela, lista, moeda, senha.
 */
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { autoTranslate } from '@/config/constants';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface ResponseRendererProps {
  content: string;
  displayType: string;
  data?: Record<string, unknown>[];
}

export function ResponseRenderer({
  content,
  displayType,
  data,
}: ResponseRendererProps) {
  // Renderiza o texto principal
  const renderText = () => (
    <div className="whitespace-pre-wrap leading-relaxed text-foreground">
      {content.split('\n').map((line, i) => {
        // Detecta linhas com bullet points
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="my-1 flex gap-2">
              <span className="text-primary">•</span>
              <span>{line.substring(2)}</span>
            </div>
          );
        }
        // Detecta linhas numeradas
        const numberedMatch = line.match(/^(\d+)\.\s/);
        if (numberedMatch) {
          return (
            <div key={i} className="my-1 flex gap-2">
              <span className="min-w-[1.5rem] font-medium text-primary">
                {numberedMatch[1]}.
              </span>
              <span>{line.substring(numberedMatch[0].length)}</span>
            </div>
          );
        }
        // Linha normal
        return line ? (
          <p key={i} className="my-1">
            {line}
          </p>
        ) : (
          <br key={i} />
        );
      })}
    </div>
  );

  // Renderiza tabela de dados
  const renderTable = () => {
    if (!data || data.length === 0) return renderText();

    const columns = Object.keys(data[0]);

    return (
      <div className="space-y-3">
        {/* Texto de contexto */}
        {content && !content.startsWith('1.') && (
          <p className="mb-3 text-foreground">{content}</p>
        )}

        {/* Tabela */}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.map((col) => (
                  <TableHead key={col} className="font-semibold capitalize">
                    {formatColumnName(col)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col}>{formatCellValue(col, row[col])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // Renderiza valor monetário destacado
  const renderCurrency = () => {
    // Tenta extrair o valor do primeiro item de data
    let valorPrincipal: number | null = null;

    if (data && data.length > 0) {
      const firstItem = data[0];
      // Procura por campos comuns de valor
      const valueFields = ['total', 'saldo_total', 'valor', 'media', 'total_guardado'];
      for (const field of valueFields) {
        if (firstItem[field] !== undefined && typeof firstItem[field] === 'number') {
          valorPrincipal = firstItem[field];
          break;
        }
      }
    }

    return (
      <div className="space-y-3">
        {valorPrincipal !== null && (
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(valorPrincipal)}
            </div>
          </div>
        )}
        <div className="whitespace-pre-wrap text-foreground">{content}</div>
      </div>
    );
  };

  // Renderiza informações de senha (com cuidado)
  const renderPassword = () => {
    return (
      <div className="space-y-3">
        <div className="whitespace-pre-wrap text-foreground">{content}</div>

        {data && data.length > 0 && (
          <div className="space-y-2">
            {data.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
              >
                <div>
                  <div className="font-medium">
                    {String((item.titulo || item.title || '') as string)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {String((item.usuario || item.username || '') as string)}
                    {item.site ? ` • ${String(item.site as string)}` : null}
                  </div>
                </div>
                {item.categoria || item.category ? (
                  <Badge variant="secondary">
                    {autoTranslate(String(item.categoria || item.category))}
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Por segurança, acesse o módulo de Segurança para ver as senhas completas.
        </p>
      </div>
    );
  };

  // Escolhe o renderizador baseado no tipo
  switch (displayType) {
    case 'table':
      return renderTable();
    case 'currency':
      return renderCurrency();
    case 'password':
      return renderPassword();
    case 'list':
    case 'text':
    default:
      return renderText();
  }
}

/**
 * Formata nome de coluna para exibição.
 */
function formatColumnName(name: string): string {
  const translations: Record<string, string> = {
    // Campos comuns
    descricao: 'Descrição',
    description: 'Descrição',
    valor: 'Valor',
    value: 'Valor',
    data: 'Data',
    date: 'Data',
    categoria: 'Categoria',
    category: 'Categoria',
    nome: 'Nome',
    name: 'Nome',
    titulo: 'Título',
    title: 'Título',
    tipo: 'Tipo',
    type: 'Tipo',
    status: 'Status',

    // Contas
    conta: 'Conta',
    account_name: 'Conta',
    banco: 'Banco',
    institution_name: 'Banco',
    account_type: 'Tipo de Conta',
    saldo: 'Saldo',
    current_balance: 'Saldo',
    saldo_total: 'Saldo Total',

    // Cartões
    cartao: 'Cartão',
    card_name: 'Cartão',
    bandeira: 'Bandeira',
    flag: 'Bandeira',
    limite: 'Limite',
    credit_limit: 'Limite',
    limite_disponivel: 'Limite Disponível',
    limite_total: 'Limite Total',
    dia_vencimento: 'Dia Vencimento',
    due_day: 'Dia Vencimento',
    dia_fechamento: 'Dia Fechamento',
    closing_day: 'Dia Fechamento',
    valor_fatura: 'Valor da Fatura',
    total_amount: 'Valor Total',
    mes: 'Mês',
    month: 'Mês',
    ano: 'Ano',
    year: 'Ano',

    // Empréstimos
    credor: 'Credor',
    creditor: 'Credor',
    devedor: 'Devedor',
    benefited: 'Beneficiado',
    valor_total: 'Valor Total',
    valor_pago: 'Valor Pago',
    payed_value: 'Valor Pago',
    valor_restante: 'Restante',
    valor_recebido: 'Recebido',
    valor_a_receber: 'A Receber',

    // Agregações
    quantidade: 'Quantidade',
    count: 'Quantidade',
    quantidade_contas: 'Qtd. Contas',
    total: 'Total',
    media: 'Média',
    average: 'Média',

    // Livros e leitura
    livro: 'Livro',
    book: 'Livro',
    paginas: 'Páginas',
    pages: 'Páginas',
    paginas_lidas: 'Páginas Lidas',
    pages_read: 'Páginas Lidas',
    genero: 'Gênero',
    genre: 'Gênero',
    read_status: 'Status de Leitura',
    avaliacao: 'Avaliação',
    rating: 'Avaliação',
    minutos: 'Minutos',
    reading_time: 'Tempo de Leitura',
    reading_date: 'Data da Leitura',
    autor: 'Autor',
    author: 'Autor',
    editora: 'Editora',
    publisher: 'Editora',
    total_paginas: 'Total de Páginas',

    // Tarefas e planejamento
    tarefa: 'Tarefa',
    task_name: 'Tarefa',
    horario: 'Horário',
    scheduled_time: 'Horário',
    scheduled_date: 'Data Agendada',
    meta: 'Meta',
    target_quantity: 'Meta',
    target_value: 'Meta',
    realizado: 'Realizado',
    quantity_completed: 'Realizado',
    current_value: 'Atual',
    atual: 'Atual',
    objetivo: 'Objetivo',
    goal_type: 'Tipo de Objetivo',
    inicio: 'Início',
    start_date: 'Início',
    end_date: 'Término',
    concluidas: 'Concluídas',
    taxa_conclusao: 'Taxa de Conclusão',
    periodicidade: 'Periodicidade',
    periodicity: 'Periodicidade',
    unidade: 'Unidade',
    unit: 'Unidade',
    ativa: 'Ativa',
    is_active: 'Ativa',

    // Cofres
    cofre: 'Cofre',
    vault: 'Cofre',
    rendimentos: 'Rendimentos',
    accumulated_yield: 'Rendimentos',
    taxa_rendimento: 'Taxa de Rendimento',
    yield_rate: 'Taxa de Rendimento',
    total_guardado: 'Total Guardado',
    total_rendimentos: 'Total de Rendimentos',
    quantidade_cofres: 'Qtd. Cofres',

    // Transferências
    origem: 'Origem',
    origin: 'Origem',
    origin_account: 'Conta Origem',
    destino: 'Destino',
    destiny: 'Destino',
    destiny_account: 'Conta Destino',
    total_transferido: 'Total Transferido',

    // Senhas
    usuario: 'Usuário',
    username: 'Usuário',
    site: 'Site',
    senha: 'Senha',
    senha_criptografada: 'Senha',
    ultima_alteracao: 'Última Alteração',
    last_password_change: 'Última Alteração',
    password_strength: 'Força da Senha',

    // Outros
    created_at: 'Criado em',
    updated_at: 'Atualizado em',
    deleted_at: 'Excluído em',
  };

  const key = name.toLowerCase();
  if (translations[key]) {
    return translations[key];
  }

  // Se não encontrou, formata o nome (remove underscores, capitaliza)
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formata número para o padrão brasileiro.
 */
function formatNumberBR(value: number, decimals: number = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formata data para o padrão brasileiro (DD/MM/AAAA).
 */
function formatDateBR(value: string | Date): string {
  try {
    let date: Date;
    if (typeof value === 'string') {
      // Tenta parsear ISO format (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss)
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        date = new Date(value + (value.includes('T') ? '' : 'T00:00:00'));
      } else if (value.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        // Já está no formato brasileiro
        return value;
      } else {
        return value;
      }
    } else {
      date = value;
    }

    if (isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString('pt-BR');
  } catch {
    return String(value);
  }
}

/**
 * Formata valor de célula para exibição.
 */
function formatCellValue(column: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  const columnLower = column.toLowerCase();

  // Valores monetários
  const currencyColumns = [
    'valor',
    'value',
    'saldo',
    'balance',
    'total',
    'limite',
    'limit',
    'limite_disponivel',
    'limite_total',
    'credit_limit',
    'current_balance',
    'valor_total',
    'valor_pago',
    'payed_value',
    'valor_restante',
    'valor_recebido',
    'valor_a_receber',
    'media',
    'average',
    'rendimentos',
    'accumulated_yield',
    'valor_fatura',
    'total_amount',
    'total_guardado',
    'total_rendimentos',
    'total_transferido',
  ];
  if (
    currencyColumns.some((col) => columnLower.includes(col)) &&
    typeof value === 'number'
  ) {
    return (
      <span className={cn(value < 0 ? 'text-destructive' : 'text-success')}>
        {formatCurrency(value)}
      </span>
    );
  }

  // Datas
  const dateColumns = [
    'data',
    'date',
    'inicio',
    'start',
    'fim',
    'end',
    'created_at',
    'updated_at',
    'ultima_alteracao',
    'last_password_change',
    'scheduled_date',
    'reading_date',
    'start_date',
    'end_date',
  ];
  if (dateColumns.some((col) => columnLower.includes(col))) {
    if (typeof value === 'string' || value instanceof Date) {
      return formatDateBR(value);
    }
  }

  // Horários
  const timeColumns = ['horario', 'scheduled_time', 'time'];
  if (
    timeColumns.some((col) => columnLower.includes(col)) &&
    typeof value === 'string'
  ) {
    return value.substring(0, 5); // HH:MM
  }

  // Status
  if (columnLower === 'status' || columnLower === 'read_status') {
    const statusColors: Record<string, string> = {
      // Sucesso / Positivo
      active: 'bg-success/20 text-success',
      ativo: 'bg-success/20 text-success',
      completed: 'bg-success/20 text-success',
      concluido: 'bg-success/20 text-success',
      paid: 'bg-success/20 text-success',
      pago: 'bg-success/20 text-success',
      read: 'bg-success/20 text-success',
      lido: 'bg-success/20 text-success',

      // Aviso / Em andamento
      pending: 'bg-warning/20 text-warning',
      pendente: 'bg-warning/20 text-warning',
      in_progress: 'bg-info/20 text-info',
      em_andamento: 'bg-info/20 text-info',
      reading: 'bg-info/20 text-info',
      lendo: 'bg-info/20 text-info',
      open: 'bg-warning/20 text-warning',
      aberta: 'bg-warning/20 text-warning',
      closed: 'bg-muted text-muted-foreground',
      fechada: 'bg-muted text-muted-foreground',

      // Negativo / Problema
      overdue: 'bg-destructive/20 text-destructive',
      atrasado: 'bg-destructive/20 text-destructive',
      cancelled: 'bg-muted text-muted-foreground',
      cancelado: 'bg-muted text-muted-foreground',
      abandoned: 'bg-muted text-muted-foreground',
      abandonado: 'bg-muted text-muted-foreground',

      // Neutro
      to_read: 'bg-muted text-muted-foreground',
      para_ler: 'bg-muted text-muted-foreground',
      on_hold: 'bg-muted text-muted-foreground',
      em_pausa: 'bg-muted text-muted-foreground',
      inactive: 'bg-muted text-muted-foreground',
      inativo: 'bg-muted text-muted-foreground',
    };
    const statusKey = String(value as string).toLowerCase().replace(/ /g, '_');
    return (
      <Badge className={cn('font-normal', statusColors[statusKey] || '')}>
        {autoTranslate(String(value as string))}
      </Badge>
    );
  }

  // Categorias e tipos - traduz
  const translateColumns = [
    'categoria',
    'category',
    'tipo',
    'type',
    'genero',
    'genre',
    'periodicidade',
    'periodicity',
    'bandeira',
    'flag',
    'goal_type',
  ];
  if (
    translateColumns.some((col) => columnLower === col || columnLower.includes(col))
  ) {
    return autoTranslate(String(value as string));
  }

  // Booleanos
  if (typeof value === 'boolean') {
    return (
      <Badge variant={value ? 'default' : 'secondary'} className="font-normal">
        {value ? 'Sim' : 'Não'}
      </Badge>
    );
  }

  // Booleanos representados como string
  if (columnLower === 'ativa' || columnLower === 'is_active') {
    const isActive = value === true || value === 'true' || value === 1;
    return (
      <Badge variant={isActive ? 'default' : 'secondary'} className="font-normal">
        {isActive ? 'Sim' : 'Não'}
      </Badge>
    );
  }

  // Avaliação (rating)
  const ratingColumns = ['avaliacao', 'rating'];
  if (
    ratingColumns.some((col) => columnLower.includes(col)) &&
    typeof value === 'number'
  ) {
    if (value >= 1 && value <= 5) {
      return '⭐'.repeat(value);
    }
    return String(value);
  }

  // Percentuais e taxas
  const percentColumns = ['taxa', 'rate', 'percent', 'taxa_conclusao', 'yield_rate'];
  if (
    percentColumns.some((col) => columnLower.includes(col)) &&
    typeof value === 'number'
  ) {
    // Se o valor já está em formato decimal (0.15 = 15%)
    if (value >= -1 && value <= 1 && !columnLower.includes('conclusao')) {
      return `${formatNumberBR(value * 100, 2)}%`;
    }
    // Se já está em formato percentual
    return `${formatNumberBR(value, 2)}%`;
  }

  // Quantidades e contagens (números inteiros)
  const countColumns = [
    'quantidade',
    'count',
    'paginas',
    'pages',
    'minutos',
    'minutes',
  ];
  if (
    countColumns.some((col) => columnLower.includes(col)) &&
    typeof value === 'number'
  ) {
    if (Number.isInteger(value)) {
      return value.toLocaleString('pt-BR');
    }
    return formatNumberBR(value, 0);
  }

  // Meses (número para nome)
  if ((columnLower === 'mes' || columnLower === 'month') && typeof value === 'number') {
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    if (value >= 1 && value <= 12) {
      return monthNames[value - 1];
    }
  }

  // Números genéricos
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toLocaleString('pt-BR');
    }
    return formatNumberBR(value, 2);
  }

  // Strings - verifica se precisa traduzir
  if (typeof value === 'string') {
    // Verifica se é uma string que parece ser um termo em inglês comum
    const lowerValue = value.toLowerCase();
    const commonEnglishTerms = [
      'pending',
      'active',
      'inactive',
      'completed',
      'cancelled',
      'overdue',
      'paid',
      'open',
      'closed',
      'reading',
      'read',
      'to_read',
      'abandoned',
      'fiction',
      'non_fiction',
      'philosophy',
      'psychology',
      'history',
      'salary',
      'income',
      'refund',
      'cashback',
      'award',
      'bonus',
      'food and drink',
      'transport',
      'health',
      'education',
      'entertainment',
    ];
    if (
      commonEnglishTerms.includes(lowerValue) ||
      commonEnglishTerms.includes(lowerValue.replace(/_/g, ' '))
    ) {
      return autoTranslate(value);
    }
  }

  return String(value as string);
}
