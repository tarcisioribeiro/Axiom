import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  CreditCard,
  ArrowLeftRight,
  Key,
  Lock,
  BookOpen,
  BookMarked,
  LayoutDashboard,
  Shield,
  Library,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageContainer } from '@/components/common/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { containerVariants, itemVariants } from '@/lib/animations';


interface ModuleCard {
  title: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  features: string[];
}

export default function Home() {
  const modules: ModuleCard[] = [
    {
      title: 'Planejamento Pessoal',
      icon: <Calendar className="h-8 w-8" />,
      href: '/planning/dashboard',
      color: 'from-warning to-warning/70',
      features: [
        'Checklist Diário',
        'Tarefas Rotineiras',
        'Objetivos e Metas',
        'Acompanhamento de Progresso',
        'Organização Pessoal',
      ],
    },
    {
      title: 'Controle Financeiro',
      icon: <Wallet className="h-8 w-8" />,
      href: '/dashboard',
      color: 'from-success to-success/70',
      features: [
        'Controle de Contas Bancárias',
        'Gestão de Despesas e Receitas',
        'Cartões de Crédito e Faturas',
        'Empréstimos e Transferências',
        'Dashboard com Gráficos',
      ],
    },
    {
      title: 'Segurança',
      icon: <Shield className="h-8 w-8" />,
      href: '/security/passwords',
      color: 'from-info to-primary',
      features: [
        'Armazenamento Seguro de Senhas',
        'Cartões e Contas Bancárias',
        'Arquivos Criptografados',
        'Logs de Atividade',
        'Criptografia de Ponta',
      ],
    },
    {
      title: 'Leitura',
      icon: <Library className="h-8 w-8" />,
      href: '/library/books',
      color: 'from-primary to-accent',
      features: [
        'Catálogo de Livros',
        'Autores e Editoras',
        'Resumos e Anotações',
        'Controle de Leituras',
        'Estatísticas de Leitura',
      ],
    },
  ];

  const quickActions = [
    {
      icon: <TrendingDown className="h-5 w-5" />,
      label: 'Nova Despesa',
      href: '/expenses',
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: 'Nova Receita',
      href: '/revenues',
    },
    {
      icon: <ArrowLeftRight className="h-5 w-5" />,
      label: 'Transferência',
      href: '/transfers',
    },
    {
      icon: <CreditCard className="h-5 w-5" />,
      label: 'Cartões',
      href: '/credit-cards',
    },
    { icon: <Key className="h-5 w-5" />, label: 'Senhas', href: '/security/passwords' },
    { icon: <BookOpen className="h-5 w-5" />, label: 'Livros', href: '/library/books' },
  ];

  return (
    <PageContainer className="space-y-8">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <motion.div
            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {quickActions.map((action, index) => (
              <motion.div key={index} variants={itemVariants}>
                <Link
                  to={action.href}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-4 transition-all hover:scale-105 hover:border-primary hover:bg-accent"
                >
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    {action.icon}
                  </div>
                  <span className="text-center text-sm font-medium">
                    {action.label}
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </CardContent>
      </Card>

      {/* Modules */}
      <div>
        <h2 className="mb-6 text-2xl font-bold">Módulos Disponíveis</h2>
        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {modules.map((module, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Link to={module.href} className="group block h-full">
                <Card className="h-full border-2 transition-all hover:scale-[1.02] hover:border-primary hover:shadow-xl">
                  <CardHeader>
                    <motion.div
                      className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${module.color} mb-4 flex items-center justify-center text-white`}
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      {module.icon}
                    </motion.div>
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {module.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Info Cards */}
      <motion.div
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div variants={itemVariants}>
          <Card className="border-success/20 bg-gradient-to-br from-success/10 to-success/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <Wallet className="h-5 w-5" />
                Finanças Organizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Controle total das suas finanças pessoais com dashboards intuitivos e
                relatórios detalhados.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-info/20 bg-gradient-to-br from-info/10 to-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-info">
                <Lock className="h-5 w-5" />
                Segurança Máxima
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Seus dados protegidos com criptografia de ponta a ponta e armazenamento
                seguro.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-accent/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <BookMarked className="h-5 w-5" />
                Conhecimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Organize sua biblioteca pessoal e acompanhe seu progresso de leitura.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </PageContainer>
  );
}
