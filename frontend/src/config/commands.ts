/* eslint-disable max-lines */
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Wallet,
  Shield,
  ShieldCheck,
  Library,
  Calendar,
  LayoutDashboard,
  CreditCard,
  Receipt,
  TrendingDown,
  TrendingUp,
  CalendarClock,
  ArrowLeftRight,
  HandCoins,
  Users,
  Key,
  Archive,
  BookOpen,
  UserPen,
  Building2,
  FileText,
  BookMarked,
  CheckCircle2,
  Target,
  Vault,
  LogOut,
  Moon,
  Sun,
  Plus,
  ShoppingCart,
  FileUp,
} from 'lucide-react';

export type CommandSection = 'navigation' | 'actions' | 'settings';

export interface Command {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  href?: string;
  action?: () => void;
  keywords: string[];
  section: CommandSection;
  shortcut?: string;
}

/**
 * Comandos de navegação - todas as rotas principais
 */
export const navigationCommands: Command[] = [
  {
    id: 'home',
    title: 'Início',
    description: 'Página inicial',
    icon: Home,
    href: '/',
    keywords: ['home', 'inicio', 'inicial', 'principal'],
    section: 'navigation',
  },
  // Personal Planning
  {
    id: 'planning-dashboard',
    title: 'Planejamento - Dashboard',
    description: 'Dashboard do planejamento pessoal',
    icon: LayoutDashboard,
    href: '/planning/dashboard',
    keywords: ['planning', 'planejamento', 'dashboard', 'pessoal'],
    section: 'navigation',
  },
  {
    id: 'planning-daily',
    title: 'Checklist Diário',
    description: 'Tarefas do dia',
    icon: CheckCircle2,
    href: '/planning/daily',
    keywords: ['checklist', 'diario', 'tarefas', 'dia', 'daily'],
    section: 'navigation',
  },
  {
    id: 'planning-routine',
    title: 'Tarefas Rotineiras',
    description: 'Gerenciar tarefas recorrentes',
    icon: Calendar,
    href: '/planning/routine-tasks',
    keywords: ['tarefas', 'rotineiras', 'rotina', 'recorrentes'],
    section: 'navigation',
  },
  {
    id: 'planning-goals',
    title: 'Objetivos Pessoais',
    description: 'Metas e objetivos pessoais',
    icon: Target,
    href: '/planning/goals',
    keywords: ['objetivos', 'metas', 'goals', 'pessoal'],
    section: 'navigation',
  },

  // Financial Control
  {
    id: 'financial-dashboard',
    title: 'Dashboard Financeiro',
    description: 'Visão geral das finanças',
    icon: LayoutDashboard,
    href: '/dashboard',
    keywords: ['dashboard', 'financeiro', 'financas', 'visao', 'geral'],
    section: 'navigation',
  },
  {
    id: 'accounts',
    title: 'Contas Bancárias',
    description: 'Gerenciar contas bancárias',
    icon: Wallet,
    href: '/accounts',
    keywords: ['contas', 'bancarias', 'banco', 'accounts'],
    section: 'navigation',
  },
  {
    id: 'credit-cards',
    title: 'Cartões de Crédito',
    description: 'Gerenciar cartões de crédito',
    icon: CreditCard,
    href: '/credit-cards',
    keywords: ['cartoes', 'credito', 'credit', 'cards'],
    section: 'navigation',
  },
  {
    id: 'credit-card-bills',
    title: 'Faturas',
    description: 'Faturas dos cartões de crédito',
    icon: Receipt,
    href: '/credit-cards',
    keywords: ['faturas', 'fatura', 'bills', 'cartao'],
    section: 'navigation',
  },
  {
    id: 'expenses',
    title: 'Despesas',
    description: 'Registrar e ver despesas',
    icon: TrendingDown,
    href: '/expenses',
    keywords: ['despesas', 'gastos', 'expenses', 'saida'],
    section: 'navigation',
  },
  {
    id: 'revenues',
    title: 'Receitas',
    description: 'Registrar e ver receitas',
    icon: TrendingUp,
    href: '/revenues',
    keywords: ['receitas', 'entradas', 'revenues', 'salario'],
    section: 'navigation',
  },
  {
    id: 'credit-card-expenses',
    title: 'Gastos do Cartão',
    description: 'Ver gastos no cartão de crédito',
    icon: ShoppingCart,
    href: '/credit-cards',
    keywords: ['gastos', 'cartao', 'compras', 'parcelas'],
    section: 'navigation',
  },
  {
    id: 'fixed-expenses',
    title: 'Gastos Fixos',
    description: 'Gerenciar gastos fixos mensais',
    icon: CalendarClock,
    href: '/fixed-expenses',
    keywords: ['gastos', 'fixos', 'mensais', 'recorrentes'],
    section: 'navigation',
  },
  {
    id: 'transfers',
    title: 'Transferências',
    description: 'Transferências entre contas',
    icon: ArrowLeftRight,
    href: '/transfers',
    keywords: ['transferencias', 'pix', 'ted', 'doc'],
    section: 'navigation',
  },
  {
    id: 'loans',
    title: 'Empréstimos',
    description: 'Gerenciar empréstimos',
    icon: HandCoins,
    href: '/loans',
    keywords: ['emprestimos', 'dividas', 'loans'],
    section: 'navigation',
  },
  {
    id: 'payables',
    title: 'Valores a Pagar',
    description: 'Contas a pagar',
    icon: Receipt,
    href: '/payables',
    keywords: ['valores', 'pagar', 'contas', 'payables'],
    section: 'navigation',
  },
  {
    id: 'vaults',
    title: 'Cofres',
    description: 'Gerenciar cofres de economia',
    icon: Vault,
    href: '/vaults',
    keywords: ['cofres', 'economia', 'poupanca', 'vaults'],
    section: 'navigation',
  },
  {
    id: 'financial-goals',
    title: 'Metas Financeiras',
    description: 'Metas e objetivos financeiros',
    icon: Target,
    href: '/financial-goals',
    keywords: ['metas', 'financeiras', 'objetivos', 'goals'],
    section: 'navigation',
  },
  {
    id: 'members',
    title: 'Beneficiários/Credores',
    description: 'Gerenciar beneficiários e credores',
    icon: Users,
    href: '/members',
    keywords: ['beneficiarios', 'credores', 'membros', 'pessoas'],
    section: 'navigation',
  },

  // Security Module
  {
    id: 'security-dashboard',
    title: 'Segurança - Dashboard',
    description: 'Dashboard de segurança',
    icon: Shield,
    href: '/security/dashboard',
    keywords: ['seguranca', 'dashboard', 'security'],
    section: 'navigation',
  },
  {
    id: 'passwords',
    title: 'Senhas',
    description: 'Gerenciador de senhas',
    icon: Key,
    href: '/security/passwords',
    keywords: ['senhas', 'passwords', 'seguranca'],
    section: 'navigation',
  },
  {
    id: 'stored-cards',
    title: 'Cartões Armazenados',
    description: 'Cartões salvos de forma segura',
    icon: CreditCard,
    href: '/security/stored-cards',
    keywords: ['cartoes', 'armazenados', 'salvos', 'seguro'],
    section: 'navigation',
  },
  {
    id: 'stored-accounts',
    title: 'Contas Armazenadas',
    description: 'Contas salvas de forma segura',
    icon: Wallet,
    href: '/security/stored-accounts',
    keywords: ['contas', 'armazenadas', 'salvas', 'seguro'],
    section: 'navigation',
  },
  {
    id: 'archives',
    title: 'Arquivos',
    description: 'Arquivos criptografados',
    icon: Archive,
    href: '/security/archives',
    keywords: ['arquivos', 'documentos', 'criptografados'],
    section: 'navigation',
  },
  {
    id: 'vault-health',
    title: 'Saúde do Cofre',
    description: 'Análise de segurança das senhas',
    icon: ShieldCheck,
    href: '/security/health',
    keywords: ['saude', 'cofre', 'seguranca', 'senhas', 'analise', 'health'],
    section: 'navigation',
  },
  {
    id: 'bank-statement-import',
    title: 'Importar Extrato Bancário',
    description: 'Importar transações de arquivo OFX ou CSV',
    icon: FileUp,
    href: '/bank-reconciliation/import',
    keywords: ['importar', 'extrato', 'bancario', 'ofx', 'csv', 'transacoes'],
    section: 'navigation',
  },
  {
    id: '2fa-setup',
    title: 'Autenticação de Dois Fatores',
    description: 'Configurar ou desativar 2FA/TOTP',
    icon: ShieldCheck,
    href: '/settings/two-factor',
    keywords: [
      '2fa',
      'totp',
      'autenticacao',
      'dois fatores',
      'seguranca',
      'configuracoes',
    ],
    section: 'settings',
  },

  // Library Module
  {
    id: 'library-dashboard',
    title: 'Leitura - Dashboard',
    description: 'Dashboard da biblioteca',
    icon: Library,
    href: '/library/dashboard',
    keywords: ['leitura', 'biblioteca', 'dashboard', 'library'],
    section: 'navigation',
  },
  {
    id: 'books',
    title: 'Livros',
    description: 'Gerenciar livros',
    icon: BookOpen,
    href: '/library/books',
    keywords: ['livros', 'books', 'biblioteca'],
    section: 'navigation',
  },
  {
    id: 'authors',
    title: 'Autores',
    description: 'Gerenciar autores',
    icon: UserPen,
    href: '/library/authors',
    keywords: ['autores', 'authors', 'escritores'],
    section: 'navigation',
  },
  {
    id: 'publishers',
    title: 'Editoras',
    description: 'Gerenciar editoras',
    icon: Building2,
    href: '/library/publishers',
    keywords: ['editoras', 'publishers', 'publicadoras'],
    section: 'navigation',
  },
  {
    id: 'summaries',
    title: 'Resumos',
    description: 'Resumos de livros',
    icon: FileText,
    href: '/library/summaries',
    keywords: ['resumos', 'summaries', 'anotacoes'],
    section: 'navigation',
  },
  {
    id: 'readings',
    title: 'Leituras',
    description: 'Histórico de leituras',
    icon: BookMarked,
    href: '/library/readings',
    keywords: ['leituras', 'readings', 'historico'],
    section: 'navigation',
  },
];

/**
 * Comandos de ação rápida (sem navegação)
 */
export const actionCommands: Command[] = [
  {
    id: 'new-expense',
    title: 'Nova Despesa',
    description: 'Registrar nova despesa',
    icon: Plus,
    href: '/expenses',
    keywords: ['nova', 'despesa', 'registrar', 'gasto', 'add'],
    section: 'actions',
    shortcut: 'N D',
  },
  {
    id: 'new-revenue',
    title: 'Nova Receita',
    description: 'Registrar nova receita',
    icon: Plus,
    href: '/revenues',
    keywords: ['nova', 'receita', 'registrar', 'entrada', 'add'],
    section: 'actions',
    shortcut: 'N R',
  },
];

/**
 * Comandos de configuração (ações dinâmicas)
 */
export const createSettingsCommands = (
  onLogout: () => void,
  onToggleTheme: () => void,
  isDark: boolean
): Command[] => [
  {
    id: 'toggle-theme',
    title: isDark ? 'Modo Claro' : 'Modo Escuro',
    description: `Alternar para tema ${isDark ? 'claro' : 'escuro'}`,
    icon: isDark ? Sun : Moon,
    action: onToggleTheme,
    keywords: ['tema', 'theme', 'claro', 'escuro', 'dark', 'light', 'modo'],
    section: 'settings',
    shortcut: 'T',
  },
  {
    id: 'logout',
    title: 'Sair',
    description: 'Fazer logout da conta',
    icon: LogOut,
    action: onLogout,
    keywords: ['sair', 'logout', 'deslogar', 'conta'],
    section: 'settings',
    shortcut: 'Q',
  },
];

/**
 * Retorna todos os comandos disponíveis
 */
export function getAllCommands(
  onLogout: () => void,
  onToggleTheme: () => void,
  isDark: boolean
): Command[] {
  return [
    ...navigationCommands,
    ...actionCommands,
    ...createSettingsCommands(onLogout, onToggleTheme, isDark),
  ];
}

/**
 * Busca fuzzy simples em comandos
 */
export function searchCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) {
    return commands;
  }

  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);

  return commands
    .map((command) => {
      const searchableText = [
        command.title.toLowerCase(),
        command.description?.toLowerCase() || '',
        ...command.keywords,
      ].join(' ');

      // Calcula score baseado em matches
      let score = 0;

      // Match exato no título = maior score
      if (command.title.toLowerCase().includes(normalizedQuery)) {
        score += 100;
      }

      // Match em keywords
      for (const keyword of command.keywords) {
        if (keyword.includes(normalizedQuery)) {
          score += 50;
        }
        for (const word of words) {
          if (keyword.includes(word)) {
            score += 10;
          }
        }
      }

      // Match parcial
      for (const word of words) {
        if (searchableText.includes(word)) {
          score += 5;
        }
      }

      return { command, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ command }) => command);
}

/**
 * Agrupa comandos por seção
 */
export function groupCommandsBySection(
  commands: Command[]
): Record<CommandSection, Command[]> {
  return {
    navigation: commands.filter((c) => c.section === 'navigation'),
    actions: commands.filter((c) => c.section === 'actions'),
    settings: commands.filter((c) => c.section === 'settings'),
  };
}

export const sectionLabels: Record<CommandSection, string> = {
  navigation: 'Navegação',
  actions: 'Ações Rápidas',
  settings: 'Configurações',
};
