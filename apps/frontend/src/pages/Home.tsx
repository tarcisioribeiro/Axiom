/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
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
  GitFork,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { containerVariants, itemVariants } from '@/lib/animations';
import { STALE_TIMES } from '@/lib/query-client';
import { knowledgeGraphService } from '@/services/knowledge-graph-service';

interface ModuleCard {
  title: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  features: string[];
}

export default function Home() {
  const { t } = useTranslation();

  const { data: graphData } = useQuery({
    queryKey: ['knowledge-graph', 'summary'],
    queryFn: () => knowledgeGraphService.getGraph(false),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const modules: ModuleCard[] = [
    {
      title: t('pages.home.planning.title'),
      icon: <Calendar className="h-8 w-8" />,
      href: '/planning/dashboard',
      color: 'from-warning to-warning/70',
      features: t('pages.home.planning.features', { returnObjects: true }) as string[],
    },
    {
      title: t('pages.home.finance.title'),
      icon: <Wallet className="h-8 w-8" />,
      href: '/dashboard',
      color: 'from-success to-success/70',
      features: t('pages.home.finance.features', { returnObjects: true }) as string[],
    },
    {
      title: t('pages.home.security.title'),
      icon: <Shield className="h-8 w-8" />,
      href: '/security/passwords',
      color: 'from-info to-primary',
      features: t('pages.home.security.features', { returnObjects: true }) as string[],
    },
    {
      title: t('pages.home.library.title'),
      icon: <Library className="h-8 w-8" />,
      href: '/library/books',
      color: 'from-primary to-accent',
      features: t('pages.home.library.features', { returnObjects: true }) as string[],
    },
  ];

  const quickActions = [
    {
      icon: <TrendingDown className="h-5 w-5" />,
      label: t('pages.home.quickActions.newExpense'),
      href: '/expenses',
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: t('pages.home.quickActions.newRevenue'),
      href: '/revenues',
    },
    {
      icon: <ArrowLeftRight className="h-5 w-5" />,
      label: t('pages.home.quickActions.transfer'),
      href: '/transfers',
    },
    {
      icon: <CreditCard className="h-5 w-5" />,
      label: t('pages.home.quickActions.cards'),
      href: '/credit-cards',
    },
    {
      icon: <Key className="h-5 w-5" />,
      label: t('pages.home.quickActions.passwords'),
      href: '/security/passwords',
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      label: t('pages.home.quickActions.books'),
      href: '/library/books',
    },
  ];

  return (
    <PageContainer className="space-y-xl">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-sm">
            <LayoutDashboard className="h-5 w-5" />
            {t('pages.home.quickActionsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <motion.div
            className="grid grid-cols-2 gap-md md:grid-cols-3 lg:grid-cols-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {quickActions.map((action) => (
              <motion.div key={action.href} variants={itemVariants}>
                <Link
                  to={action.href}
                  className="flex flex-col items-center justify-center gap-sm rounded-lg border border-border p-md transition-all hover:scale-105 hover:border-primary hover:bg-accent"
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
      <div className="space-y-lg">
        <PageHeader title={t('pages.home.modulesTitle')} />
        <motion.div
          className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {modules.map((module) => (
            <motion.div key={module.href} variants={itemVariants}>
              <Link
                to={module.href}
                className="group block h-full"
                aria-label={t('pages.home.modules.navigateTo', {
                  module: module.title,
                })}
              >
                <Card className="h-full border-2 transition-all hover:scale-[1.02] hover:border-primary hover:shadow-xl">
                  <CardHeader>
                    <motion.div
                      className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${module.color} mb-md flex items-center justify-center text-white`}
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      {module.icon}
                    </motion.div>
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-sm">
                      {module.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-sm text-sm">
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

      {/* Knowledge Graph Widget */}
      <Link to="/library/knowledge-graph" className="block">
        <Card className="border-primary/20 transition-all hover:border-primary hover:shadow-md">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-sm font-medium">
              <GitFork className="h-4 w-4 text-primary" />
              {t('pages.home.knowledgeGraph.title')}
              <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-lg">
              <div className="flex flex-col gap-xs">
                <span className="text-2xl font-bold">
                  {graphData?.nodes?.length ?? '—'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('pages.home.knowledgeGraph.nodes')}
                </span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex flex-col gap-xs">
                <span className="text-2xl font-bold">
                  {graphData?.links?.length ?? '—'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('pages.home.knowledgeGraph.links')}
                </span>
              </div>
              <p className="ml-auto text-xs text-muted-foreground">
                {t('pages.home.knowledgeGraph.desc')}
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Info Cards */}
      <motion.div
        className="grid grid-cols-1 gap-md md:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div variants={itemVariants}>
          <Card className="border-success/20 bg-gradient-to-br from-success/10 to-success/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-sm text-success">
                <Wallet className="h-5 w-5" />
                {t('pages.home.infoCards.financeTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t('pages.home.infoCards.financeDesc')}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-info/20 bg-gradient-to-br from-info/10 to-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-sm text-info">
                <Lock className="h-5 w-5" />
                {t('pages.home.infoCards.securityTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t('pages.home.infoCards.securityDesc')}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-accent/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-sm text-primary">
                <BookMarked className="h-5 w-5" />
                {t('pages.home.infoCards.knowledgeTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t('pages.home.infoCards.knowledgeDesc')}</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </PageContainer>
  );
}
