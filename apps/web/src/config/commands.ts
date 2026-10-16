/* eslint-disable max-lines */
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
  CheckCircle2,
  Target,
  Vault,
  LogOut,
  Moon,
  Sun,
  Plus,
  ShoppingCart,
} from 'lucide-react';

import type { IconComponent } from '@/types/icon';

export type CommandSection = 'navigation' | 'actions' | 'settings';

export interface Command {
  /** Também é a chave do título em `layout.commandPalette.commands`. */
  id: string;
  title: string;
  description?: string;
  icon: IconComponent;
  href?: string;
  action?: () => void;
  keywords: string[];
  section: CommandSection;
  shortcut?: string;
}

type CommandDef = Omit<Command, 'title'>;

/**
 * Comandos de navegação - todas as rotas principais
 */
const navigationCommands: CommandDef[] = [
  {
    id: 'home',
    description: 'Página inicial',
    icon: Home,
    href: '/',
    keywords: ['home', 'inicio', 'inicial', 'principal'],
    section: 'navigation',
  },
  // Personal Planning
  {
    id: 'planning-dashboard',
    description: 'Dashboard do planejamento pessoal',
    icon: LayoutDashboard,
    href: '/planning/dashboard',
    keywords: ['planning', 'planejamento', 'dashboard', 'pessoal'],
    section: 'navigation',
  },
  {
    id: 'planning-daily',
    description: 'Tarefas do dia',
    icon: CheckCircle2,
    href: '/planning/daily',
    keywords: ['checklist', 'diario', 'tarefas', 'dia', 'daily'],
    section: 'navigation',
  },
  {
    id: 'planning-routine',
    description: 'Gerenciar tarefas recorrentes',
    icon: Calendar,
    href: '/planning/routine-tasks',
    keywords: ['tarefas', 'rotineiras', 'rotina', 'recorrentes'],
    section: 'navigation',
  },
  {
    id: 'planning-goals',
    description: 'Metas e objetivos pessoais',
    icon: Target,
    href: '/planning/goals',
    keywords: ['objetivos', 'metas', 'goals', 'pessoal'],
    section: 'navigation',
  },

  // Financial Control
  {
    id: 'financial-dashboard',
    description: 'Visão geral das finanças',
    icon: LayoutDashboard,
    href: '/dashboard',
    keywords: ['dashboard', 'financeiro', 'financas', 'visao', 'geral'],
    section: 'navigation',
  },
  {
    id: 'accounts',
    description: 'Gerenciar contas bancárias',
    icon: Wallet,
    href: '/accounts',
    keywords: ['contas', 'bancarias', 'banco', 'accounts'],
    section: 'navigation',
  },
  {
    id: 'credit-cards',
    description: 'Gerenciar cartões de crédito',
    icon: CreditCard,
    href: '/credit-cards',
    keywords: ['cartoes', 'credito', 'credit', 'cards'],
    section: 'navigation',
  },
  {
    id: 'credit-card-bills',
    description: 'Faturas dos cartões de crédito',
    icon: Receipt,
    href: '/credit-cards',
    keywords: ['faturas', 'fatura', 'bills', 'cartao'],
    section: 'navigation',
  },
  {
    id: 'expenses',
    description: 'Registrar e ver despesas',
    icon: TrendingDown,
    href: '/expenses',
    keywords: ['despesas', 'gastos', 'expenses', 'saida'],
    section: 'navigation',
  },
  {
    id: 'revenues',
    description: 'Registrar e ver receitas',
    icon: TrendingUp,
    href: '/revenues',
    keywords: ['receitas', 'entradas', 'revenues', 'salario'],
    section: 'navigation',
  },
  {
    id: 'credit-card-expenses',
    description: 'Ver gastos no cartão de crédito',
    icon: ShoppingCart,
    href: '/credit-card-expenses',
    keywords: ['gastos', 'cartao', 'compras', 'parcelas'],
    section: 'navigation',
  },
  {
    id: 'fixed-expenses',
    description: 'Gerenciar gastos fixos mensais',
    icon: CalendarClock,
    href: '/fixed-expenses',
    keywords: ['gastos', 'fixos', 'mensais', 'recorrentes'],
    section: 'navigation',
  },
  {
    id: 'transfers',
    description: 'Transferências entre contas',
    icon: ArrowLeftRight,
    href: '/transfers',
    keywords: ['transferencias', 'pix', 'ted', 'doc'],
    section: 'navigation',
  },
  {
    id: 'loans',
    description: 'Gerenciar empréstimos',
    icon: HandCoins,
    href: '/loans',
    keywords: ['emprestimos', 'dividas', 'loans'],
    section: 'navigation',
  },
  {
    id: 'payables',
    description: 'Contas a pagar',
    icon: Receipt,
    href: '/payables',
    keywords: ['valores', 'pagar', 'contas', 'payables'],
    section: 'navigation',
  },
  {
    id: 'vaults',
    description: 'Gerenciar cofres de economia',
    icon: Vault,
    href: '/vaults',
    keywords: ['cofres', 'economia', 'poupanca', 'vaults'],
    section: 'navigation',
  },
  {
    id: 'financial-goals',
    description: 'Metas e objetivos financeiros',
    icon: Target,
    href: '/financial-goals',
    keywords: ['metas', 'financeiras', 'objetivos', 'goals'],
    section: 'navigation',
  },
  {
    id: 'members',
    description: 'Gerenciar beneficiários e credores',
    icon: Users,
    href: '/members',
    keywords: ['beneficiarios', 'credores', 'membros', 'pessoas'],
    section: 'navigation',
  },

  // Security Module
  {
    id: 'security-dashboard',
    description: 'Dashboard de segurança',
    icon: Shield,
    href: '/security/dashboard',
    keywords: ['seguranca', 'dashboard', 'security'],
    section: 'navigation',
  },
  {
    id: 'passwords',
    description: 'Gerenciador de senhas',
    icon: Key,
    href: '/security/passwords',
    keywords: ['senhas', 'passwords', 'seguranca'],
    section: 'navigation',
  },
  {
    id: 'stored-cards',
    description: 'Cartões salvos de forma segura',
    icon: CreditCard,
    href: '/security/stored-cards',
    keywords: ['cartoes', 'armazenados', 'salvos', 'seguro'],
    section: 'navigation',
  },
  {
    id: 'stored-accounts',
    description: 'Contas salvas de forma segura',
    icon: Wallet,
    href: '/security/stored-accounts',
    keywords: ['contas', 'armazenadas', 'salvas', 'seguro'],
    section: 'navigation',
  },
  {
    id: 'archives',
    description: 'Arquivos criptografados',
    icon: Archive,
    href: '/security/archives',
    keywords: ['arquivos', 'documentos', 'criptografados'],
    section: 'navigation',
  },
  {
    id: 'vault-health',
    description: 'Análise de segurança das senhas',
    icon: ShieldCheck,
    href: '/security/health',
    keywords: ['saude', 'cofre', 'seguranca', 'senhas', 'analise', 'health'],
    section: 'navigation',
  },

  // Library Module
  {
    id: 'library-dashboard',
    description: 'Dashboard da biblioteca',
    icon: Library,
    href: '/library/dashboard',
    keywords: ['leitura', 'biblioteca', 'dashboard', 'library'],
    section: 'navigation',
  },
  {
    id: 'books',
    description: 'Gerenciar livros',
    icon: BookOpen,
    href: '/library/books',
    keywords: ['livros', 'books', 'biblioteca'],
    section: 'navigation',
  },
  {
    id: 'authors',
    description: 'Gerenciar autores',
    icon: UserPen,
    href: '/library/authors',
    keywords: ['autores', 'authors', 'escritores'],
    section: 'navigation',
  },
  {
    id: 'publishers',
    description: 'Gerenciar editoras',
    icon: Building2,
    href: '/library/publishers',
    keywords: ['editoras', 'publishers', 'publicadoras'],
    section: 'navigation',
  },
];

/**
 * Comandos de ação rápida (sem navegação)
 */
const actionCommands: CommandDef[] = [
  {
    id: 'new-expense',
    description: 'Registrar nova despesa',
    icon: Plus,
    href: '/expenses',
    keywords: ['nova', 'despesa', 'registrar', 'gasto', 'add'],
    section: 'actions',
    shortcut: 'N D',
  },
  {
    id: 'new-revenue',
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
const createSettingsCommands = (
  onLogout: () => void,
  onToggleTheme: () => void,
  isDark: boolean
): CommandDef[] => [
  {
    id: isDark ? 'theme-light' : 'theme-dark',
    description: `Alternar para tema ${isDark ? 'claro' : 'escuro'}`,
    icon: isDark ? Sun : Moon,
    action: onToggleTheme,
    keywords: ['tema', 'theme', 'claro', 'escuro', 'dark', 'light', 'modo'],
    section: 'settings',
    shortcut: 'T',
  },
  {
    id: 'logout',
    description: 'Fazer logout da conta',
    icon: LogOut,
    action: onLogout,
    keywords: ['sair', 'logout', 'deslogar', 'conta'],
    section: 'settings',
    shortcut: 'Q',
  },
];

/**
 * Retorna todos os comandos disponíveis, com o título traduzido pelo `id`
 */
export function getAllCommands(
  onLogout: () => void,
  onToggleTheme: () => void,
  isDark: boolean,
  translateTitle: (id: string) => string
): Command[] {
  return [
    ...navigationCommands,
    ...actionCommands,
    ...createSettingsCommands(onLogout, onToggleTheme, isDark),
  ].map((command) => ({ ...command, title: translateTitle(command.id) }));
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
