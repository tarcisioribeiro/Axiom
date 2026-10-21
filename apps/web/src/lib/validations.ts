/* eslint-disable max-lines */
/**
 * Schemas de Validação com Zod
 *
 * VAL-03: Validação client-side robusta para todos os formulários
 *
 * Benefícios:
 * - Type-safe: TypeScript infere tipos automaticamente dos schemas
 * - Mensagens de erro sensíveis ao i18n (chamador passa o `t` do react-i18next)
 * - Validações complexas (regex, custom validators)
 * - Integração com react-hook-form via zodResolver
 *
 * Cada schema é exportado como uma função `make*Schema(t)` — o componente
 * monta o schema com `useMemo(() => makeXSchema(t), [t])` para que as
 * mensagens troquem de idioma junto com o app.
 */

import type { TFunction } from 'i18next';
import { z } from 'zod';

import { EXPENSE_CATEGORIES_CANONICAL } from '@/config/categories';

const EXPENSE_CATEGORY_KEYS = EXPENSE_CATEGORIES_CANONICAL.map((c) => c.key) as [
  string,
  ...string[],
];

// ============================================================================
// HELPERS DE MENSAGEM (i18n)
// ============================================================================

const requiredError = (t: TFunction, field: string) =>
  t('common.fieldRequired', { field });
const minError = (t: TFunction, field: string, min: number) =>
  t('common.fieldMinLength', { field, count: min });
const maxError = (t: TFunction, field: string, max: number) =>
  t('common.fieldMaxLength', { field, count: max });
const numberError = (t: TFunction, field: string) => t('common.fieldNumber', { field });
const integerError = (t: TFunction, field: string) =>
  t('common.fieldInteger', { field });
const positiveError = (t: TFunction, field: string) =>
  t('common.fieldPositive', { field });
const notNegativeError = (t: TFunction, field: string) =>
  t('common.fieldNotNegative', { field });
const notFutureError = (t: TFunction, field: string) =>
  t('common.fieldNotFuture', { field });
const minValueError = (t: TFunction, field: string, min: number) =>
  t('common.fieldMinValue', { field, min });
const maxValueError = (t: TFunction, field: string, max: number) =>
  t('common.fieldMaxValue', { field, max });

const f = (t: TFunction, key: string) => t(`common.fields.${key}`);

const ownerSchema = (t: TFunction) =>
  z
    .number({ message: t('validation.ownerInvalid') })
    .int(integerError(t, f(t, 'owner')))
    .positive(t('validation.selectOwner'));

// ============================================================================
// SCHEMAS DE CONTAS BANCÁRIAS
// ============================================================================

const makeAccountBaseSchema = (t: TFunction) =>
  z.object({
    account_name: z
      .string()
      .min(1, requiredError(t, f(t, 'accountName')))
      .max(255, maxError(t, f(t, 'name'), 255)),
    account_type: z.enum(['CC', 'CS', 'FG', 'VA', 'VR', 'CP', 'CM'], {
      message: t('validation.accountTypeInvalid'),
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
      { message: t('validation.institutionInvalid') }
    ),
    account_number: z
      .string()
      .min(1, requiredError(t, f(t, 'accountNumber')))
      .max(50, maxError(t, f(t, 'accountNumber'), 50)),
    balance: z.number({ message: numberError(t, f(t, 'balance')) }),
    overdraft_limit: z
      .number({ message: numberError(t, f(t, 'overdraft_limit')) })
      .min(0, notNegativeError(t, f(t, 'overdraft_limit'))),
    owner: ownerSchema(t),
  });

const refineAccountBalance =
  (t: TFunction) =>
  (data: { balance: number; overdraft_limit: number }, ctx: z.RefinementCtx) => {
    const minBalance = -(data.overdraft_limit ?? 0);
    if (data.balance < minBalance) {
      ctx.addIssue({
        code: 'too_small',
        minimum: minBalance,
        origin: 'number',
        inclusive: true,
        message: t('validation.balanceBelowOverdraft', {
          limit: data.overdraft_limit ?? 0,
        }),
        path: ['balance'],
      });
    }
  };

export const makeAccountSchema = (t: TFunction) =>
  makeAccountBaseSchema(t).superRefine(refineAccountBalance(t));

/** Na edição, o número (criptografado, não volta da API) em branco mantém o atual. */
export const makeAccountEditSchema = (t: TFunction) => {
  const base = makeAccountBaseSchema(t);
  return base
    .extend({
      account_number: base.shape.account_number.or(z.literal('')),
    })
    .superRefine(refineAccountBalance(t));
};

// ============================================================================
// SCHEMAS DE DESPESAS
// ============================================================================

export const makeExpenseSchema = (t: TFunction) =>
  z
    .object({
      value: z
        .number({ message: numberError(t, f(t, 'amount')) })
        .positive(positiveError(t, f(t, 'amount'))),
      category: z.enum(EXPENSE_CATEGORY_KEYS, {
        message: t('validation.categoryInvalid'),
      }),
      description: z
        .string()
        .min(1, requiredError(t, f(t, 'description')))
        .max(500, maxError(t, f(t, 'description'), 500)),
      date: z.string().min(1, requiredError(t, f(t, 'date'))),
      horary: z.string().min(1, requiredError(t, f(t, 'horary'))),
      payed: z.boolean().default(false),
      account: z
        .number({ message: t('validation.expenseAccountInvalid') })
        .int(integerError(t, f(t, 'account')))
        .positive(t('validation.selectAccount')),
      member: z.number().int().positive().optional().nullable(),
      merchant: z.string().optional(),
      related_loan: z.number().int().positive().optional().nullable(),
      related_payable: z.number().int().positive().optional().nullable(),
      fixed_expense_template: z.number().int().positive().optional().nullable(),
    })
    .refine(
      // `fixed_expense_template` fica fora desta checagem: uma despesa gerada
      // a partir de uma despesa fixa vinculada a um empréstimo/conta a pagar
      // sempre carrega o template junto com related_loan/related_payable
      // (herdado do template) — isso é esperado, não um vínculo duplo. O que
      // não pode coexistir é related_loan e related_payable ao mesmo tempo.
      (data) => [data.related_loan, data.related_payable].filter(Boolean).length <= 1,
      {
        message: t('validation.singleLink'),
        path: ['related_loan'],
      }
    );

// ============================================================================
// SCHEMAS DO MÓDULO DE SEGURANÇA
// ============================================================================

export const makePasswordSchema = (t: TFunction) =>
  z.object({
    title: z
      .string()
      .min(1, requiredError(t, f(t, 'title')))
      .max(255, maxError(t, f(t, 'title'), 255)),
    site: z
      .string()
      .url(t('common.fieldInvalidFormat', { field: f(t, 'site') }))
      .optional()
      .or(z.literal('')),
    username: z
      .string()
      .min(1, requiredError(t, f(t, 'username')))
      .max(255, maxError(t, f(t, 'username'), 255)),
    password: z.union([
      z.string().min(8, minError(t, f(t, 'password'), 8)),
      z.literal(''),
    ]),
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
      { message: t('validation.categoryInvalid') }
    ),
    notes: z
      .string()
      .max(1000, maxError(t, f(t, 'notes'), 1000))
      .optional()
      .or(z.literal('')),
    owner: ownerSchema(t),
    totp_enabled: z.boolean().optional(),
    totp_secret: z.string().max(255).optional().or(z.literal('')),
  });

const makeStoredCardBaseSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .min(1, requiredError(t, f(t, 'cardName')))
      .max(255, maxError(t, f(t, 'cardName'), 255)),
    card_number: z
      .string()
      .min(16, t('validation.cardNumberLength'))
      .max(16, t('validation.cardNumberLength'))
      .regex(/^\d{16}$/, t('validation.digitsOnly')),
    security_code: z
      .string()
      .min(3, t('validation.cvvLength'))
      .max(4, t('validation.cvvLength'))
      .regex(/^\d{3,4}$/, t('validation.digitsOnly')),
    cardholder_name: z
      .string()
      .min(1, requiredError(t, f(t, 'cardholderName')))
      .max(255, maxError(t, f(t, 'cardholderName'), 255)),
    expiration_month: z
      .number({ message: numberError(t, f(t, 'expirationMonth')) })
      .int(integerError(t, f(t, 'expirationMonth')))
      .min(1, minValueError(t, f(t, 'expirationMonth'), 1))
      .max(12, maxValueError(t, f(t, 'expirationMonth'), 12)),
    expiration_year: z
      .number({ message: numberError(t, f(t, 'expirationYear')) })
      .int(integerError(t, f(t, 'expirationYear')))
      .min(new Date().getFullYear(), notFutureError(t, f(t, 'expirationYear'))),
    flag: z.enum(['MSC', 'VSA', 'ELO', 'EXP', 'HCD', 'DIN', 'OTHER'], {
      message: t('validation.flagInvalid'),
    }),
    notes: z
      .string()
      .max(1000, maxError(t, f(t, 'notes'), 1000))
      .optional()
      .or(z.literal('')),
    owner: ownerSchema(t),
    finance_card: z.number().int().positive().optional().nullable(),
  });

export const makeStoredCardSchema = makeStoredCardBaseSchema;

export const makeStoredAccountBaseSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .min(1, requiredError(t, f(t, 'name')))
      .max(255, maxError(t, f(t, 'name'), 255)),
    institution_name: z
      .string()
      .min(1, requiredError(t, f(t, 'institutionName')))
      .max(255, maxError(t, f(t, 'institutionName'), 255)),
    institution_code: z
      .string()
      .max(10, maxError(t, f(t, 'institutionCode'), 10))
      .optional()
      .or(z.literal('')),
    account_type: z.enum(['CC', 'CS', 'CP', 'CI', 'OTHER'], {
      message: t('validation.accountTypeInvalid'),
    }),
    account_number: z
      .string()
      .min(1, requiredError(t, f(t, 'accountNumber')))
      .max(50, maxError(t, f(t, 'accountNumber'), 50)),
    agency: z
      .string()
      .max(20, maxError(t, f(t, 'agency'), 20))
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .max(255, maxError(t, f(t, 'password'), 255))
      .optional()
      .or(z.literal('')),
    digital_password: z
      .string()
      .max(255, maxError(t, f(t, 'digitalPassword'), 255))
      .optional()
      .or(z.literal('')),
    notes: z
      .string()
      .max(1000, maxError(t, f(t, 'notes'), 1000))
      .optional()
      .or(z.literal('')),
    owner: ownerSchema(t),
    finance_account: z.number().int().positive().optional().nullable(),
  });

export const makeStoredAccountSchema = makeStoredAccountBaseSchema;

export const makeArchiveSchema = (t: TFunction) =>
  z.object({
    title: z
      .string()
      .min(1, requiredError(t, f(t, 'title')))
      .max(255, maxError(t, f(t, 'title'), 255)),
    category: z.enum(
      ['personal', 'financial', 'legal', 'medical', 'tax', 'work', 'other'],
      { message: t('validation.categoryInvalid') }
    ),
    archive_type: z.enum(['text', 'pdf', 'image', 'document', 'other'], {
      message: t('validation.archiveTypeInvalid'),
    }),
    text_content: z
      .string()
      .max(50000, maxError(t, f(t, 'textContent'), 50000))
      .optional()
      .or(z.literal('')),
    notes: z
      .string()
      .max(1000, maxError(t, f(t, 'notes'), 1000))
      .optional()
      .or(z.literal('')),
    tags: z
      .string()
      .max(500, maxError(t, f(t, 'tags'), 500))
      .optional()
      .or(z.literal('')),
    owner: ownerSchema(t),
  });

// ============================================================================
// SCHEMAS DO MÓDULO DE BIBLIOTECA
// ============================================================================

export const makeAuthorSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .min(1, requiredError(t, f(t, 'name')))
      .max(200, maxError(t, f(t, 'name'), 200)),
    birth_year: z
      .union([
        z
          .number({ message: numberError(t, f(t, 'birthYear')) })
          .int(integerError(t, f(t, 'birthYear')))
          .positive(positiveError(t, f(t, 'birthYear')))
          .max(new Date().getFullYear(), notFutureError(t, f(t, 'birthYear'))),
        z.nan(),
        z.null(),
      ])
      .optional()
      .transform((val) => (typeof val === 'number' && !isNaN(val) ? val : null)),
    birth_era: z.enum(['AC', 'DC'], { message: t('validation.eraInvalid') }),
    death_year: z
      .union([
        z
          .number({ message: numberError(t, f(t, 'deathYear')) })
          .int(integerError(t, f(t, 'deathYear')))
          .positive(positiveError(t, f(t, 'deathYear'))),
        z.nan(),
        z.null(),
      ])
      .optional()
      .transform((val) => (typeof val === 'number' && !isNaN(val) ? val : null)),
    death_era: z
      .enum(['AC', 'DC'], { message: t('validation.eraInvalid') })
      .optional()
      .nullable(),
    nationality: z
      .string()
      .min(1, requiredError(t, f(t, 'nationality')))
      .max(100, maxError(t, f(t, 'nationality'), 100)),
    biography: z
      .string()
      .max(2000, maxError(t, f(t, 'biography'), 2000))
      .optional()
      .or(z.literal('')),
    owner: ownerSchema(t),
  });

export const makePublisherSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .min(1, requiredError(t, f(t, 'name')))
      .max(200, maxError(t, f(t, 'name'), 200)),
    description: z
      .string()
      .max(1000, maxError(t, f(t, 'description'), 1000))
      .optional()
      .or(z.literal('')),
    website: z
      .string()
      .max(500, maxError(t, f(t, 'website'), 500))
      .url(t('common.fieldInvalidFormat', { field: f(t, 'website') }))
      .optional()
      .or(z.literal('')),
    country: z
      .string()
      .min(1, requiredError(t, f(t, 'country')))
      .max(100, maxError(t, f(t, 'country'), 100)),
    founded_year: z
      .number({ message: numberError(t, f(t, 'foundedYear')) })
      .int(integerError(t, f(t, 'foundedYear')))
      .min(1000, minValueError(t, f(t, 'foundedYear'), 1000))
      .max(new Date().getFullYear(), notFutureError(t, f(t, 'foundedYear')))
      .optional(),
    owner: ownerSchema(t),
  });

export const makeBookSchema = (t: TFunction) =>
  z.object({
    title: z
      .string()
      .min(1, requiredError(t, f(t, 'title')))
      .max(300, maxError(t, f(t, 'title'), 300)),
    isbn: z
      .string()
      .max(13, maxError(t, f(t, 'isbn'), 13))
      .optional()
      .or(z.literal('')),
    series_name: z
      .string()
      .max(200, maxError(t, f(t, 'seriesName'), 200))
      .optional()
      .or(z.literal('')),
    series_order: z
      .number({ message: numberError(t, f(t, 'seriesOrder')) })
      .int()
      .positive()
      .nullable()
      .optional(),
    authors: z
      .array(z.number({ message: t('validation.authorInvalid') }))
      .min(1, t('validation.authorsMin')),
    pages: z
      .number({ message: numberError(t, f(t, 'pages')) })
      .int(integerError(t, f(t, 'pages')))
      .positive(positiveError(t, f(t, 'pages'))),
    publisher: z
      .number({ message: t('validation.publisherInvalid') })
      .int(integerError(t, f(t, 'publisher')))
      .positive(t('validation.selectPublisher')),
    language: z
      .string()
      .min(1, requiredError(t, f(t, 'language')))
      .max(50, maxError(t, f(t, 'language'), 50)),
    genre: z
      .string()
      .min(1, requiredError(t, f(t, 'genre')))
      .max(100, maxError(t, f(t, 'genre'), 100)),
    literarytype: z
      .string()
      .min(1, requiredError(t, f(t, 'literaryType')))
      .max(100, maxError(t, f(t, 'literaryType'), 100)),
    publish_date: z.string().optional().or(z.literal('')),
    synopsis: z
      .string()
      .min(1, requiredError(t, f(t, 'synopsis')))
      .max(5000, maxError(t, f(t, 'synopsis'), 5000)),
    edition: z
      .string()
      .min(1, requiredError(t, f(t, 'edition')))
      .max(100, maxError(t, f(t, 'edition'), 100)),
    media_type: z
      .string()
      .max(50, maxError(t, f(t, 'mediaType'), 50))
      .optional()
      .or(z.literal('')),
    rating: z
      .number({ message: numberError(t, f(t, 'rating')) })
      .int(integerError(t, f(t, 'rating')))
      .min(0, minValueError(t, f(t, 'rating'), 0))
      .max(5, maxValueError(t, f(t, 'rating'), 5))
      .nullable(),
    read_status: z
      .string()
      .min(1, requiredError(t, f(t, 'readStatus')))
      .max(50, maxError(t, f(t, 'readStatus'), 50)),
    pause_reason: z
      .string()
      .max(2000, maxError(t, f(t, 'pauseReason'), 2000))
      .optional()
      .or(z.literal('')),
    owner: ownerSchema(t),
  });

export const makeReadingSchema = (t: TFunction) =>
  z.object({
    book: z
      .number({ message: t('validation.bookInvalid') })
      .int(integerError(t, f(t, 'book')))
      .positive(t('validation.selectBook')),
    reading_date: z.string().min(1, requiredError(t, f(t, 'readingDate'))),
    reading_time: z
      .number({ message: numberError(t, f(t, 'readingTime')) })
      .int(integerError(t, f(t, 'readingTime')))
      .min(0, notNegativeError(t, f(t, 'readingTime'))),
    pages_read: z
      .number({ message: numberError(t, f(t, 'pagesRead')) })
      .int(integerError(t, f(t, 'pagesRead')))
      .positive(positiveError(t, f(t, 'pagesRead'))),
    notes: z
      .string()
      .max(2000, maxError(t, f(t, 'notes'), 2000))
      .optional()
      .or(z.literal('')),
    current_page: z
      .number({ message: numberError(t, f(t, 'currentPage')) })
      .int(integerError(t, f(t, 'currentPage')))
      .min(1, positiveError(t, f(t, 'currentPage')))
      .nullable()
      .optional(),
    time_of_day: z.string().nullable().optional(),
    owner: ownerSchema(t),
  });

// ============================================================================
// PERSONAL PLANNING SCHEMAS
// ============================================================================

export const makeRoutineTaskSchema = (t: TFunction) =>
  z
    .object({
      name: z
        .string()
        .min(3, minError(t, f(t, 'taskName'), 3))
        .max(200, maxError(t, f(t, 'taskName'), 200)),
      description: z
        .string()
        .max(1000, maxError(t, f(t, 'description'), 1000))
        .optional()
        .or(z.literal('')),
      category: z.string().min(1, requiredError(t, f(t, 'category'))),
      icon: z
        .string()
        .max(50, maxError(t, f(t, 'icon'), 50))
        .optional()
        .nullable(),
      periodicity: z.string().min(1, requiredError(t, f(t, 'periodicity'))),
      weekday: z.number().min(0).max(6).optional().nullable(),
      day_of_month: z
        .number()
        .min(1, minValueError(t, f(t, 'dayOfMonth'), 1))
        .max(31, maxValueError(t, f(t, 'dayOfMonth'), 31))
        .optional()
        .nullable(),
      custom_weekdays: z.array(z.number().min(0).max(6)).optional().nullable(),
      custom_month_days: z.array(z.number().min(1).max(31)).optional().nullable(),
      times_per_week: z
        .number()
        .min(1, minValueError(t, f(t, 'timesPerWeek'), 1))
        .max(7, maxValueError(t, f(t, 'timesPerWeek'), 7))
        .optional()
        .nullable(),
      times_per_month: z
        .number()
        .min(1, minValueError(t, f(t, 'timesPerMonth'), 1))
        .max(31, maxValueError(t, f(t, 'timesPerMonth'), 31))
        .optional()
        .nullable(),
      interval_days: z
        .number()
        .min(1, minValueError(t, f(t, 'intervalDays'), 1))
        .optional()
        .nullable(),
      interval_start_date: z.string().optional().nullable(),
      // Campos de agendamento de horário
      default_time: z
        .string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, t('validation.timeFormat'))
        .optional()
        .nullable(),
      closing_time: z
        .string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, t('validation.timeFormat'))
        .optional()
        .nullable(),
      daily_occurrences: z
        .number()
        .min(1, minValueError(t, f(t, 'dailyOccurrences'), 1))
        .max(24, maxValueError(t, f(t, 'dailyOccurrences'), 24)),
      interval_hours: z
        .number()
        .min(0, minValueError(t, f(t, 'intervalHours'), 0))
        .max(23, maxValueError(t, f(t, 'intervalHours'), 23))
        .optional()
        .nullable(),
      scheduled_times: z
        .array(z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/))
        .optional()
        .nullable(),
      is_active: z.boolean(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      is_optional: z.boolean(),
      allowed_skips_per_month: z
        .number()
        .min(0, minValueError(t, f(t, 'allowedSkips'), 0))
        .max(31, maxValueError(t, f(t, 'allowedSkips'), 31)),
      target_quantity: z
        .number()
        .min(1, positiveError(t, f(t, 'targetQuantity')))
        .positive(positiveError(t, f(t, 'targetQuantity'))),
      unit: z.enum(
        [
          'vez',
          'minuto',
          'hora',
          'ml',
          'copo',
          'litro',
          'página',
          'km',
          'metro',
          'passo',
          'repetição',
          'série',
          'capítulo',
          'exercício',
          'dose',
          'comprimido',
        ],
        { message: t('validation.unitInvalid') }
      ),
      owner: ownerSchema(t),
      linked_financial_goal: z.number().positive().optional().nullable(),
      linked_book: z.number().positive().optional().nullable(),
      linked_meal_type: z.number().positive().optional().nullable(),
      linked_hydration_goal: z.number().positive().optional().nullable(),
      linked_workout: z.boolean().optional(),
    })
    .refine(
      (data) => {
        if (data.periodicity === 'weekly' && !data.weekday && data.weekday !== 0) {
          return false;
        }
        return true;
      },
      {
        message: t('validation.weekdayRequired'),
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
        message: t('validation.dayOfMonthRequired'),
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
        message: t('validation.customPeriodicityRequired'),
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
        message: t('validation.intervalStartDateRequired'),
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
        message: t('validation.defaultTimeRequired'),
        path: ['default_time'],
      }
    )
    .refine(
      (data) => {
        if (data.closing_time && (data.daily_occurrences ?? 1) > 1) {
          return false;
        }
        return true;
      },
      {
        message: t('validation.closingTimeSingleOccurrence'),
        path: ['closing_time'],
      }
    )
    .refine(
      (data) =>
        !data.default_time ||
        !data.closing_time ||
        (data.daily_occurrences ?? 1) > 1 ||
        data.closing_time.padStart(5, '0') >= data.default_time.padStart(5, '0'),
      {
        message: t('validation.closingAfterDefault'),
        path: ['closing_time'],
      }
    )
    .refine(
      (data) => {
        if (data.linked_meal_type && data.linked_hydration_goal) {
          return false;
        }
        return true;
      },
      {
        message: t('validation.nutritionMutualExclusive'),
        path: ['linked_hydration_goal'],
      }
    );

export const makeGoalSchema = (t: TFunction) =>
  z.object({
    title: z
      .string()
      .min(3, minError(t, f(t, 'title'), 3))
      .max(200, maxError(t, f(t, 'title'), 200)),
    description: z
      .string()
      .max(1000, maxError(t, f(t, 'description'), 1000))
      .optional()
      .or(z.literal('')),
    goal_type: z.string().min(1, requiredError(t, f(t, 'goalType'))),
    goal_source: z.string().min(1, requiredError(t, f(t, 'goalSource'))),
    related_task: z.number().positive().optional().nullable(),
    target_value: z
      .number()
      .min(1, positiveError(t, f(t, 'targetValue')))
      .positive(positiveError(t, f(t, 'targetValue'))),
    current_value: z.number().min(0, notNegativeError(t, f(t, 'currentValue'))),
    start_date: z.string().min(1, requiredError(t, f(t, 'startDate'))),
    end_date: z.string().optional().nullable().or(z.literal('')),
    status: z.string().min(1, requiredError(t, f(t, 'status'))),
    owner: ownerSchema(t),
  });

export const makeDailyReflectionSchema = (t: TFunction) =>
  z.object({
    date: z.string().min(1, requiredError(t, f(t, 'date'))),
    reflection: z
      .string()
      .min(10, minError(t, f(t, 'reflection'), 10))
      .max(2000, maxError(t, f(t, 'reflection'), 2000)),
    mood: z.string().optional().or(z.literal('')),
    owner: ownerSchema(t),
  });

export type AccountFormData = z.infer<ReturnType<typeof makeAccountSchema>>;
export type StoredCreditCardFormData = z.infer<ReturnType<typeof makeStoredCardSchema>>;
export type StoredBankAccountFormData = z.infer<
  ReturnType<typeof makeStoredAccountSchema>
>;
export type ArchiveFormData = z.infer<ReturnType<typeof makeArchiveSchema>>;
export type PublisherFormData = z.infer<ReturnType<typeof makePublisherSchema>>;
export type BookFormData = z.infer<ReturnType<typeof makeBookSchema>>;
export type ReadingFormData = z.infer<ReturnType<typeof makeReadingSchema>>;

// ============================================================================
// READING GOAL SCHEMA
// ============================================================================

export const makeReadingGoalSchema = (t: TFunction) =>
  z.object({
    year: z
      .number({ message: numberError(t, f(t, 'year')) })
      .int(integerError(t, f(t, 'year')))
      .min(2000, minValueError(t, f(t, 'year'), 2000))
      .max(2100, maxValueError(t, f(t, 'year'), 2100)),
    name: z
      .string()
      .max(200, maxError(t, f(t, 'name'), 200))
      .optional()
      .or(z.literal('')),
    books_goal: z
      .number({ message: numberError(t, f(t, 'booksGoal')) })
      .int(integerError(t, f(t, 'booksGoal')))
      .min(1, minValueError(t, f(t, 'booksGoal'), 1))
      .max(365, maxValueError(t, f(t, 'booksGoal'), 365)),
    pages_goal: z
      .number({ message: numberError(t, f(t, 'pagesGoal')) })
      .int(integerError(t, f(t, 'pagesGoal')))
      .min(0, notNegativeError(t, f(t, 'pagesGoal')))
      .max(100000, maxValueError(t, f(t, 'pagesGoal'), 100000)),
    owner: ownerSchema(t),
  });

export type ReadingGoalFormData = z.infer<ReturnType<typeof makeReadingGoalSchema>>;
export type GoalFormData = z.infer<ReturnType<typeof makeGoalSchema>>;
export type RoutineTaskFormData = z.infer<ReturnType<typeof makeRoutineTaskSchema>>;
export type DailyReflectionFormData = z.infer<
  ReturnType<typeof makeDailyReflectionSchema>
>;

/** Na edição, campos sensíveis em branco mantêm o valor atual. */
export const makeStoredCardEditSchema = (t: TFunction) => {
  const base = makeStoredCardBaseSchema(t);
  return base.extend({
    card_number: base.shape.card_number.or(z.literal('')),
    security_code: base.shape.security_code.or(z.literal('')),
  });
};

export const makeStoredAccountEditSchema = (t: TFunction) => {
  const base = makeStoredAccountBaseSchema(t);
  return base.extend({
    account_number: base.shape.account_number.or(z.literal('')),
  });
};
