/**
 * Schemas de Validação com Zod
 *
 * VAL-03: Validação client-side robusta para todos os formulários
 *
 * Benefícios:
 * - Type-safe: TypeScript infere tipos automaticamente dos schemas
 * - Mensagens de erro em português
 * - Validações complexas (regex, custom validators)
 * - Integração com react-hook-form via zodResolver
 */

import { z } from 'zod';

// ============================================================================
// HELPERS E VALIDAÇÕES CUSTOMIZADAS
// ============================================================================

/**
 * Helper para mensagens de erro em português
 */
const requiredError = (field: string) => `${field} é obrigatório`;
const minError = (field: string, min: number) =>
  `${field} deve ter no mínimo ${min} caracteres`;
const maxError = (field: string, max: number) =>
  `${field} deve ter no máximo ${max} caracteres`;
const emailError = 'Email inválido';
const numberError = (field: string) => `${field} deve ser um número válido`;
const positiveError = (field: string) => `${field} deve ser maior que zero`;

/**
 * Validação de CPF (formato: 000.000.000-00 ou 00000000000)
 */
const cpfRegex = /^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})$/;
const isCPF = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length === 11 && cpfRegex.test(value);
};

/**
 * Validação de telefone (formato: (00) 00000-0000 ou (00) 0000-0000)
 */
const phoneRegex = /^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/;

// ============================================================================
// SCHEMAS DE AUTENTICAÇÃO
// ============================================================================

export const loginSchema = z.object({
  username: z
    .string()
    .min(3, minError('Usuário', 3))
    .max(150, maxError('Usuário', 150)),
  password: z
    .string()
    .min(1, requiredError('Senha'))
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, minError('Usuário', 3))
      .max(150, maxError('Usuário', 150))
      .regex(/^[a-zA-Z0-9_-]+$/, 'Apenas letras, números, traço e underscore'),
    password: z
      .string()
      .min(8, 'Senha deve ter no mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
      .regex(/[a-z]/, 'Senha deve conter ao menos uma letra minúscula')
      .regex(/[0-9]/, 'Senha deve conter ao menos um número'),
    confirmPassword: z.string(),
    name: z.string().min(3, minError('Nome', 3)).max(255, maxError('Nome', 255)),
    document: z.string().refine(isCPF, 'CPF inválido'),
    phone: z.string().regex(phoneRegex, 'Telefone inválido. Use: (00) 00000-0000'),
    email: z.string().email(emailError).optional().or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

// ============================================================================
// SCHEMAS DE CONTAS BANCÁRIAS
// ============================================================================

export const accountSchema = z.object({
  account_name: z
    .string()
    .min(1, requiredError('Nome da conta'))
    .max(255, maxError('Nome', 255)),
  account_type: z.enum(['CC', 'CS', 'FG', 'VA', 'VR', 'CP'], {
    message: 'Selecione um tipo de conta válido',
  }),
  institution: z.enum(
    [
      'NUB',
      'SIC',
      'MPG',
      'IFB',
      'CEF',
      'BTG',
      'ITA',
      'SAN',
      'BRB',
      'BBR',
      'BMG',
      'PAY',
      'C6B',
      'INT',
      'CAI',
      'PAN',
    ],
    {
      message: 'Selecione uma instituição válida',
    }
  ),
  account_number: z
    .string()
    .min(1, requiredError('Número da conta'))
    .max(50, maxError('Número da conta', 50)),
  balance: z
    .number({ message: numberError('Saldo') })
    .min(0, 'Saldo não pode ser negativo'),
  overdraft_limit: z
    .number({ message: numberError('Cheque especial') })
    .min(0, 'Limite de cheque especial não pode ser negativo'),
  owner: z
    .number({ message: 'Proprietário inválido' })
    .int('Proprietário deve ser um número inteiro')
    .positive('Selecione um proprietário'),
});

// ============================================================================
// SCHEMAS DE DESPESAS
// ============================================================================

export const expenseSchema = z.object({
  value: z.number({ message: numberError('Valor') }).positive(positiveError('Valor')),
  category: z.enum(
    [
      'food and drink',
      'bills and services',
      'electronics',
      'purchases',
      'transportation',
      'home',
      'education',
      'entertainment',
      'clothing',
      'health',
      'investment',
      'gifts and donations',
      'taxes',
      'personal care',
      'travel',
      'pets',
      'savings',
      'loans',
      'other',
    ],
    {
      message: 'Selecione uma categoria válida',
    }
  ),
  description: z
    .string()
    .min(1, requiredError('Descrição'))
    .max(500, maxError('Descrição', 500)),
  date: z.string().min(1, requiredError('Data')),
  is_paid: z.boolean().default(false),
  account: z
    .number({ message: 'Conta inválida' })
    .int('Conta deve ser um número inteiro')
    .positive('Selecione uma conta'),
});

// ============================================================================
// SCHEMAS DE RECEITAS
// ============================================================================

export const revenueSchema = z.object({
  value: z.number({ message: numberError('Valor') }).positive(positiveError('Valor')),
  category: z.enum(
    [
      'deposit',
      'salary',
      'award',
      'investment return',
      'sale',
      'gift',
      'refund',
      'cashback',
      'other',
    ],
    {
      message: 'Selecione uma categoria válida',
    }
  ),
  description: z
    .string()
    .min(1, requiredError('Descrição'))
    .max(500, maxError('Descrição', 500)),
  date: z.string().min(1, requiredError('Data')),
  account: z
    .number({ message: 'Conta inválida' })
    .int('Conta deve ser um número inteiro')
    .positive('Selecione uma conta'),
});

// ============================================================================
// SCHEMAS DE CARTÕES DE CRÉDITO
// ============================================================================

export const creditCardSchema = z.object({
  name: z
    .string()
    .min(1, requiredError('Nome do cartão'))
    .max(255, maxError('Nome', 255)),
  card_number: z
    .string()
    .length(4, 'Últimos 4 dígitos do cartão')
    .regex(/^\d{4}$/, 'Apenas números'),
  security_code: z
    .string()
    .min(3, 'CVV deve ter 3 ou 4 dígitos')
    .max(4, 'CVV deve ter 3 ou 4 dígitos')
    .regex(/^\d{3,4}$/, 'Apenas números'),
  card_brand: z.enum(['MSC', 'VSA', 'ELO', 'EXP', 'HCD'], {
    message: 'Selecione uma bandeira válida',
  }),
  credit_limit: z
    .number({ message: numberError('Limite') })
    .positive(positiveError('Limite')),
  billing_due_day: z
    .number({ message: numberError('Dia de vencimento') })
    .int('Dia deve ser um número inteiro')
    .min(1, 'Dia deve estar entre 1 e 31')
    .max(31, 'Dia deve estar entre 1 e 31'),
  associated_account: z
    .number({ message: 'Conta inválida' })
    .int('Conta deve ser um número inteiro')
    .positive('Selecione uma conta de cobrança'),
  status: z
    .enum(['active', 'blocked', 'cancelled'], {
      message: 'Selecione um status válido',
    })
    .default('active'),
});

// ============================================================================
// SCHEMAS DE TRANSFERÊNCIAS
// ============================================================================

export const transferSchema = z
  .object({
    value: z.number({ message: numberError('Valor') }).positive(positiveError('Valor')),
    date: z.string().min(1, requiredError('Data')),
    transfer_type: z.enum(['doc', 'ted', 'pix'], {
      message: 'Selecione um tipo de transferência válido',
    }),
    description: z
      .string()
      .min(1, requiredError('Descrição'))
      .max(500, maxError('Descrição', 500)),
    origin_account: z
      .number({ message: 'Conta de origem inválida' })
      .int('Conta deve ser um número inteiro')
      .positive('Selecione uma conta de origem'),
    destiny_account: z
      .number({ message: 'Conta de destino inválida' })
      .int('Conta deve ser um número inteiro')
      .positive('Selecione uma conta de destino'),
  })
  .refine((data) => data.origin_account !== data.destiny_account, {
    message: 'Conta de destino deve ser diferente da conta de origem',
    path: ['destiny_account'],
  });

// ============================================================================
// SCHEMAS DE EMPRÉSTIMOS
// ============================================================================

export const loanSchema = z
  .object({
    value: z.number({ message: numberError('Valor') }).positive(positiveError('Valor')),
    payed_value: z
      .number({ message: numberError('Valor pago') })
      .min(0, 'Valor pago não pode ser negativo')
      .optional()
      .or(z.literal(0)),
    date: z.string().min(1, requiredError('Data')),
    due_date: z.string().min(1, requiredError('Data de vencimento')),
    is_creditor: z.boolean(),
    description: z
      .string()
      .min(1, requiredError('Descrição'))
      .max(500, maxError('Descrição', 500)),
    status: z
      .enum(['pending', 'in_progress', 'paid', 'late', 'cancelled'], {
        message: 'Selecione um status válido',
      })
      .default('pending'),
    linked_member: z
      .number({ message: 'Membro inválido' })
      .int('Membro deve ser um número inteiro')
      .positive('Selecione um membro'),
  })
  .refine(
    (data) => {
      if (data.payed_value && data.payed_value > data.value) {
        return false;
      }
      return true;
    },
    {
      message: 'Valor pago não pode ser maior que o valor total',
      path: ['payed_value'],
    }
  );

// ============================================================================
// SCHEMAS DE MEMBROS
// ============================================================================

export const memberSchema = z.object({
  name: z.string().min(3, minError('Nome', 3)).max(255, maxError('Nome', 255)),
  document: z.string().refine(isCPF, 'CPF inválido'),
  phone: z.string().regex(phoneRegex, 'Telefone inválido. Use: (00) 00000-0000'),
  email: z.string().email(emailError).optional().or(z.literal('')),
  sex: z.enum(['M', 'F', 'O'], {
    message: 'Selecione um sexo válido',
  }),
  is_creditor: z.boolean().default(false),
  is_benefited: z.boolean().default(false),
  active: z.boolean().default(true),
});

// ============================================================================
// SCHEMAS DE FATURAS DE CARTÃO DE CRÉDITO
// ============================================================================

export const creditCardBillSchema = z.object({
  card: z
    .number({ message: 'Cartão inválido' })
    .int('Cartão deve ser um número inteiro')
    .positive('Selecione um cartão'),
  reference_month: z
    .number({ message: numberError('Mês de referência') })
    .int('Mês deve ser um número inteiro')
    .min(1, 'Mês deve estar entre 1 e 12')
    .max(12, 'Mês deve estar entre 1 e 12'),
  reference_year: z
    .number({ message: numberError('Ano de referência') })
    .int('Ano deve ser um número inteiro')
    .min(2000, 'Ano deve ser maior que 2000'),
  due_date: z.string().min(1, requiredError('Data de vencimento')),
  total_value: z
    .number({ message: numberError('Valor total') })
    .min(0, 'Valor total não pode ser negativo'),
  status: z
    .enum(['pending', 'paid', 'partial', 'late'], {
      message: 'Selecione um status válido',
    })
    .default('pending'),
});

export const creditCardExpenseSchema = z.object({
  value: z.number({ message: numberError('Valor') }).positive(positiveError('Valor')),
  description: z
    .string()
    .min(1, requiredError('Descrição'))
    .max(500, maxError('Descrição', 500)),
  date: z.string().min(1, requiredError('Data')),
  category: z.enum(
    [
      'food and drink',
      'bills and services',
      'electronics',
      'purchases',
      'transportation',
      'home',
      'education',
      'entertainment',
      'clothing',
      'health',
      'investment',
      'gifts and donations',
      'taxes',
      'personal care',
      'travel',
      'pets',
      'savings',
      'loans',
      'other',
    ],
    {
      message: 'Selecione uma categoria válida',
    }
  ),
  installments: z
    .number({ message: numberError('Parcelas') })
    .int('Parcelas deve ser um número inteiro')
    .min(1, 'Mínimo 1 parcela')
    .max(48, 'Máximo 48 parcelas')
    .default(1),
  card: z
    .number({ message: 'Cartão inválido' })
    .int('Cartão deve ser um número inteiro')
    .positive('Selecione um cartão'),
});

// ============================================================================
// SCHEMAS DO MÓDULO DE SEGURANÇA
// ============================================================================

export const passwordSchema = z.object({
  title: z.string().min(1, requiredError('Título')).max(255, maxError('Título', 255)),
  site: z.string().url('URL inválida').optional().or(z.literal('')),
  username: z
    .string()
    .min(1, requiredError('Usuário'))
    .max(255, maxError('Usuário', 255)),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  category: z.enum(
    [
      'social',
      'email',
      'banking',
      'work',
      'entertainment',
      'shopping',
      'streaming',
      'gaming',
      'other',
    ],
    {
      message: 'Selecione uma categoria válida',
    }
  ),
  notes: z
    .string()
    .max(1000, maxError('Observações', 1000))
    .optional()
    .or(z.literal('')),
  owner: z
    .number({ message: 'Proprietário inválido' })
    .int('Proprietário deve ser um número inteiro')
    .positive('Selecione um proprietário'),
});

export const storedCardSchema = z.object({
  name: z
    .string()
    .min(1, requiredError('Nome do cartão'))
    .max(255, maxError('Nome', 255)),
  card_number: z
    .string()
    .min(16, 'Número do cartão deve ter 16 dígitos')
    .max(16, 'Número do cartão deve ter 16 dígitos')
    .regex(/^\d{16}$/, 'Apenas números'),
  security_code: z
    .string()
    .min(3, 'CVV deve ter 3 ou 4 dígitos')
    .max(4, 'CVV deve ter 3 ou 4 dígitos')
    .regex(/^\d{3,4}$/, 'Apenas números'),
  cardholder_name: z
    .string()
    .min(1, requiredError('Nome do titular'))
    .max(255, maxError('Nome do titular', 255)),
  expiration_month: z
    .number({ message: numberError('Mês de validade') })
    .int('Mês deve ser um número inteiro')
    .min(1, 'Mês deve estar entre 1 e 12')
    .max(12, 'Mês deve estar entre 1 e 12'),
  expiration_year: z
    .number({ message: numberError('Ano de validade') })
    .int('Ano deve ser um número inteiro')
    .min(new Date().getFullYear(), 'Ano não pode ser no passado'),
  flag: z.enum(['MSC', 'VSA', 'ELO', 'EXP', 'HCD', 'DIN', 'OTHER'], {
    message: 'Selecione uma bandeira válida',
  }),
  notes: z
    .string()
    .max(1000, maxError('Observações', 1000))
    .optional()
    .or(z.literal('')),
  owner: z
    .number({ message: 'Proprietário inválido' })
    .int('Proprietário deve ser um número inteiro')
    .positive('Selecione um proprietário'),
  finance_card: z.number().int().positive().optional().nullable(),
});

export const storedAccountSchema = z.object({
  name: z.string().min(1, requiredError('Nome')).max(255, maxError('Nome', 255)),
  institution_name: z
    .string()
    .min(1, requiredError('Nome da instituição'))
    .max(255, maxError('Nome da instituição', 255)),
  account_type: z.enum(['CC', 'CS', 'CP', 'CI', 'OTHER'], {
    message: 'Selecione um tipo de conta válido',
  }),
  account_number: z
    .string()
    .min(1, requiredError('Número da conta'))
    .max(50, maxError('Número da conta', 50)),
  agency: z.string().max(20, maxError('Agência', 20)).optional().or(z.literal('')),
  password: z.string().max(255, maxError('Senha', 255)).optional().or(z.literal('')),
  digital_password: z
    .string()
    .max(255, maxError('Senha digital', 255))
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, maxError('Observações', 1000))
    .optional()
    .or(z.literal('')),
  owner: z
    .number({ message: 'Proprietário inválido' })
    .int('Proprietário deve ser um número inteiro')
    .positive('Selecione um proprietário'),
  finance_account: z.number().int().positive().optional().nullable(),
});

export const archiveSchema = z.object({
  title: z.string().min(1, requiredError('Título')).max(255, maxError('Título', 255)),
  category: z.enum(
    ['personal', 'financial', 'legal', 'medical', 'tax', 'work', 'other'],
    {
      message: 'Selecione uma categoria válida',
    }
  ),
  archive_type: z.enum(['text', 'pdf', 'image', 'document', 'other'], {
    message: 'Selecione um tipo válido',
  }),
  text_content: z
    .string()
    .max(50000, maxError('Conteúdo de texto', 50000))
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, maxError('Observações', 1000))
    .optional()
    .or(z.literal('')),
  tags: z.string().max(500, maxError('Tags', 500)).optional().or(z.literal('')),
  owner: z
    .number({ message: 'Proprietário inválido' })
    .int('Proprietário deve ser um número inteiro')
    .positive('Selecione um proprietário'),
});

// ============================================================================
// SCHEMAS DO MÓDULO DE BIBLIOTECA
// ============================================================================

export const authorSchema = z.object({
  name: z.string().min(1, requiredError('Nome')).max(200, maxError('Nome', 200)),
  birth_year: z
    .union([
      z
        .number({ message: numberError('Ano de nascimento') })
        .int('Ano deve ser um número inteiro')
        .positive('Ano deve ser positivo')
        .max(new Date().getFullYear(), 'Ano não pode ser no futuro'),
      z.nan(),
      z.null(),
    ])
    .optional()
    .transform((val) => (typeof val === 'number' && !isNaN(val) ? val : null)),
  birth_era: z.enum(['AC', 'DC'], {
    message: 'Selecione uma era válida',
  }),
  death_year: z
    .union([
      z
        .number({ message: numberError('Ano de falecimento') })
        .int('Ano deve ser um número inteiro')
        .positive('Ano deve ser positivo'),
      z.nan(),
      z.null(),
    ])
    .optional()
    .transform((val) => (typeof val === 'number' && !isNaN(val) ? val : null)),
  death_era: z
    .enum(['AC', 'DC'], {
      message: 'Selecione uma era válida',
    })
    .optional()
    .nullable(),
  nationality: z
    .string()
    .min(1, requiredError('Nacionalidade'))
    .max(100, maxError('Nacionalidade', 100)),
  biography: z
    .string()
    .max(2000, maxError('Biografia', 2000))
    .optional()
    .or(z.literal('')),
  owner: z
    .number({ message: 'Proprietário inválido' })
    .int('Proprietário deve ser um número inteiro')
    .positive('Selecione um proprietário'),
});

export const publisherSchema = z.object({
  name: z.string().min(1, requiredError('Nome')).max(200, maxError('Nome', 200)),
  description: z
    .string()
    .max(1000, maxError('Descrição', 1000))
    .optional()
    .or(z.literal('')),
  website: z
    .string()
    .max(500, maxError('Website', 500))
    .url('URL inválida')
    .optional()
    .or(z.literal('')),
  country: z.string().min(1, requiredError('País')).max(100, maxError('País', 100)),
  founded_year: z
    .number({ message: numberError('Ano de fundação') })
    .int('Ano deve ser um número inteiro')
    .min(1000, 'Ano inválido')
    .max(new Date().getFullYear(), 'Ano não pode ser no futuro')
    .optional(),
  owner: z
    .number({ message: 'Proprietário inválido' })
    .int('Proprietário deve ser um número inteiro')
    .positive('Selecione um proprietário'),
});

export const bookSchema = z.object({
  title: z.string().min(1, requiredError('Título')).max(300, maxError('Título', 300)),
  authors: z
    .array(z.number({ message: 'Autor inválido' }))
    .min(1, 'Selecione pelo menos um autor'),
  pages: z
    .number({ message: numberError('Páginas') })
    .int('Páginas deve ser um número inteiro')
    .positive(positiveError('Páginas')),
  publisher: z
    .number({ message: 'Editora inválida' })
    .int('Editora deve ser um número inteiro')
    .positive('Selecione uma editora'),
  language: z.string().min(1, requiredError('Idioma')).max(50, maxError('Idioma', 50)),
  genre: z.string().min(1, requiredError('Gênero')).max(100, maxError('Gênero', 100)),
  literarytype: z
    .string()
    .min(1, requiredError('Tipo literário'))
    .max(100, maxError('Tipo literário', 100)),
  publish_date: z.string().optional().or(z.literal('')),
  synopsis: z
    .string()
    .min(1, requiredError('Sinopse'))
    .max(5000, maxError('Sinopse', 5000)),
  edition: z.string().min(1, requiredError('Edição')).max(100, maxError('Edição', 100)),
  media_type: z
    .string()
    .max(50, maxError('Tipo de mídia', 50))
    .optional()
    .or(z.literal('')),
  rating: z
    .number({ message: numberError('Avaliação') })
    .int('Avaliação deve ser um número inteiro')
    .min(0, 'Avaliação mínima é 0')
    .max(5, 'Avaliação máxima é 5')
    .nullable(),
  read_status: z
    .string()
    .min(1, requiredError('Status de leitura'))
    .max(50, maxError('Status de leitura', 50)),
  owner: z
    .number({ message: 'Proprietário inválido' })
    .int('Proprietário deve ser um número inteiro')
    .positive('Selecione um proprietário'),
});

export const readingSchema = z.object({
  book: z
    .number({ message: 'Livro inválido' })
    .int('Livro deve ser um número inteiro')
    .positive('Selecione um livro'),
  reading_date: z.string().min(1, requiredError('Data de leitura')),
  reading_time: z
    .number({ message: numberError('Tempo de leitura') })
    .int('Tempo deve ser um número inteiro')
    .min(0, 'Tempo não pode ser negativo'),
  pages_read: z
    .number({ message: numberError('Páginas lidas') })
    .int('Páginas deve ser um número inteiro')
    .positive(positiveError('Páginas lidas')),
  notes: z.string().max(2000, maxError('Anotações', 2000)).optional().or(z.literal('')),
  owner: z
    .number({ message: 'Proprietário inválido' })
    .int('Proprietário deve ser um número inteiro')
    .positive('Selecione um proprietário'),
});

// ============================================================================
// PERSONAL PLANNING SCHEMAS
// ============================================================================

export const routineTaskSchema = z
  .object({
    name: z
      .string()
      .min(3, minError('Nome da tarefa', 3))
      .max(200, maxError('Nome da tarefa', 200)),
    description: z
      .string()
      .max(1000, maxError('Descricao', 1000))
      .optional()
      .or(z.literal('')),
    category: z.string().min(1, requiredError('Categoria')),
    icon: z.string().max(50, maxError('Icone', 50)).optional().nullable(),
    periodicity: z.string().min(1, requiredError('Periodicidade')),
    weekday: z.number().min(0).max(6).optional().nullable(),
    day_of_month: z
      .number()
      .min(1, 'Dia deve ser entre 1 e 31')
      .max(31, 'Dia deve ser entre 1 e 31')
      .optional()
      .nullable(),
    custom_weekdays: z.array(z.number().min(0).max(6)).optional().nullable(),
    custom_month_days: z.array(z.number().min(1).max(31)).optional().nullable(),
    times_per_week: z.number().min(1).max(7).optional().nullable(),
    times_per_month: z.number().min(1).max(31).optional().nullable(),
    interval_days: z.number().min(1).optional().nullable(),
    interval_start_date: z.string().optional().nullable(),
    // Campos de agendamento de horário
    default_time: z
      .string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato invalido. Use HH:MM')
      .optional()
      .nullable(),
    daily_occurrences: z
      .number()
      .min(1, 'Minimo 1 ocorrencia')
      .max(24, 'Maximo 24 ocorrencias'),
    interval_hours: z
      .number()
      .min(1, 'Intervalo minimo de 1 hora')
      .max(12, 'Intervalo maximo de 12 horas')
      .optional()
      .nullable(),
    scheduled_times: z
      .array(z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/))
      .optional()
      .nullable(),
    is_active: z.boolean(),
    target_quantity: z
      .number()
      .min(1, positiveError('Quantidade alvo'))
      .positive(positiveError('Quantidade alvo')),
    unit: z.string().min(1, requiredError('Unidade')).max(50, maxError('Unidade', 50)),
    owner: z.number().positive(requiredError('Proprietario')),
  })
  .refine(
    (data) => {
      if (data.periodicity === 'weekly' && !data.weekday && data.weekday !== 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Dia da semana e obrigatorio para tarefas semanais',
      path: ['weekday'],
    }
  )
  .refine(
    (data) => {
      if (data.periodicity === 'monthly' && !data.day_of_month) {
        return false;
      }
      return true;
    },
    {
      message: 'Dia do mes e obrigatorio para tarefas mensais',
      path: ['day_of_month'],
    }
  )
  .refine(
    (data) => {
      if (data.periodicity === 'custom') {
        const hasWeekdays = data.custom_weekdays && data.custom_weekdays.length > 0;
        const hasMonthDays =
          data.custom_month_days && data.custom_month_days.length > 0;
        const hasFrequency =
          data.times_per_week || data.times_per_month || data.interval_days;

        if (!hasWeekdays && !hasMonthDays && !hasFrequency) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Periodicidade personalizada requer pelo menos uma opcao',
      path: ['periodicity'],
    }
  )
  .refine(
    (data) => {
      if (data.interval_days && !data.interval_start_date) {
        return false;
      }
      return true;
    },
    {
      message: 'Data de inicio e obrigatoria quando intervalo esta definido',
      path: ['interval_start_date'],
    }
  )
  .refine(
    (data) => {
      if (data.interval_hours && !data.default_time) {
        return false;
      }
      return true;
    },
    {
      message: 'Horario padrao e obrigatorio quando intervalo de horas esta definido',
      path: ['default_time'],
    }
  );

export const goalSchema = z.object({
  title: z.string().min(3, minError('Titulo', 3)).max(200, maxError('Titulo', 200)),
  description: z
    .string()
    .max(1000, maxError('Descricao', 1000))
    .optional()
    .or(z.literal('')),
  goal_type: z.string().min(1, requiredError('Tipo de objetivo')),
  related_task: z.number().positive().optional().nullable(),
  target_value: z
    .number()
    .min(1, positiveError('Meta'))
    .positive(positiveError('Meta')),
  current_value: z.number().min(0, 'Valor atual nao pode ser negativo'),
  start_date: z.string().min(1, requiredError('Data de inicio')),
  end_date: z.string().optional().or(z.literal('')),
  status: z.string().min(1, requiredError('Status')),
  owner: z.number().positive(requiredError('Proprietario')),
});

export const dailyReflectionSchema = z.object({
  date: z.string().min(1, requiredError('Data')),
  reflection: z
    .string()
    .min(10, minError('Reflexao', 10))
    .max(2000, maxError('Reflexao', 2000)),
  mood: z.string().optional().or(z.literal('')),
  owner: z.number().positive(requiredError('Proprietario')),
});

// ============================================================================
// TYPE INFERENCE (Types automáticos dos schemas)
// ============================================================================

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type AccountFormData = z.infer<typeof accountSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type RevenueFormData = z.infer<typeof revenueSchema>;
export type CreditCardFormData = z.infer<typeof creditCardSchema>;
export type CreditCardBillFormData = z.infer<typeof creditCardBillSchema>;
export type CreditCardExpenseFormData = z.infer<typeof creditCardExpenseSchema>;
export type TransferFormData = z.infer<typeof transferSchema>;
export type LoanFormData = z.infer<typeof loanSchema>;
export type MemberFormData = z.infer<typeof memberSchema>;
export type PasswordFormData = z.infer<typeof passwordSchema>;
export type StoredCardFormData = z.infer<typeof storedCardSchema>;
export type StoredCreditCardFormData = z.infer<typeof storedCardSchema>;
export type StoredAccountFormData = z.infer<typeof storedAccountSchema>;
export type StoredBankAccountFormData = z.infer<typeof storedAccountSchema>;
export type ArchiveFormData = z.infer<typeof archiveSchema>;
export type AuthorFormData = z.infer<typeof authorSchema>;
export type PublisherFormData = z.infer<typeof publisherSchema>;
export type BookFormData = z.infer<typeof bookSchema>;
export type ReadingFormData = z.infer<typeof readingSchema>;
